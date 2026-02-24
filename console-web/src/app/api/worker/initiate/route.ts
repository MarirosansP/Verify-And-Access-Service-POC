/**
 * POST /api/worker/initiate
 * -------------------------
 * Called by a CloudFlare Worker (or test harness) to start a
 * verification session.
 *
 * Headers:
 *   X-Worker-Key: wk_<hex>   ← the worker key
 *
 * Body (JSON):
 *   {
 *     "challenge": "age_over_18",
 *     "callbackUrl": "https://mysite.com/__va_callback"  // optional
 *   }
 *
 * Response 201:
 *   { sessionId, verifyUrl, statusUrl, expiresAt }
 *
 * CHANGE: Pre-creates the VPR at initiation to avoid race conditions.
 * CHANGE: Enforces 50-calls-per-hour quota per worker key (HTTP 429).
 * CHANGE: Records every successful initiation in WorkerUsageEvent.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateWorkerKey } from "@/lib/worker-keys";
import {
  createSession,
  setVpRequest,
  setVerificationRequestUrl,
} from "@/lib/worker-sessions";
import { createVpRequest } from "@/lib/create-vpr";
import { prisma } from "@/lib/db";

const SUPPORTED_CHALLENGES = ["age_over_18"];
const QUOTA_LIMIT = 50; // sessions per rolling hour per worker key

export async function POST(req: NextRequest) {
  /* ---- Authenticate with worker key ---- */
  const rawKey =
    req.headers.get("x-worker-key") ||
    req.headers.get("X-Worker-Key") ||
    "";
  if (!rawKey) {
    return NextResponse.json(
      { error: "Missing X-Worker-Key header" },
      { status: 401 }
    );
  }

  const wk = await validateWorkerKey(rawKey);
  if (!wk) {
    return NextResponse.json(
      { error: "Invalid or inactive worker key" },
      { status: 403 }
    );
  }

  /* ---- Hourly quota check ---- */
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const quotaUsed = await prisma.workerUsageEvent.count({
    where: { workerKeyId: wk.id, ts: { gte: oneHourAgo } },
  });
  if (quotaUsed >= QUOTA_LIMIT) {
    return NextResponse.json(
      {
        error: "quota_exceeded",
        message: `Hourly limit of ${QUOTA_LIMIT} sessions reached. Resets on the next hour.`,
        quotaUsed,
        quotaLimit: QUOTA_LIMIT,
      },
      { status: 429 }
    );
  }

  /* ---- Parse body ---- */
  const body = await req.json().catch(() => ({}));
  const challenge = body.challenge || "age_over_18";

  if (!SUPPORTED_CHALLENGES.includes(challenge)) {
    return NextResponse.json(
      {
        error: `Unsupported challenge. Supported: ${SUPPORTED_CHALLENGES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const callbackUrl =
    body.callbackUrl ||
    `${wk.siteUrl}${wk.callbackPath === "/" ? "" : wk.callbackPath}`;

  /* ---- Create session ---- */
  const session = createSession({
    workerKeyId: wk.id,
    accountId: wk.accountId,
    challenge,
    siteUrl: wk.siteUrl,
    siteName: wk.siteName,
    callbackUrl,
  });

  /* ---- Record usage event (non-fatal if it fails) ---- */
  prisma.workerUsageEvent.create({
    data: {
      userId: wk.userId,
      workerKeyId: wk.id,
      sessionId: session.sessionId,
    },
  }).catch((err: any) => {
    console.warn("[initiate] Failed to record WorkerUsageEvent:", err.message);
  });

  /* ---- Pre-create VPR ---- */
  try {
    const vpData = await createVpRequest(challenge, session.sessionId);
    console.log(
      "[initiate] VPR pre-created for session:", session.sessionId,
      "transactionRef:", vpData.transactionRef ? "yes" : "no"
    );
    setVpRequest(session.sessionId, vpData);
    if (vpData.transactionRef) {
      setVerificationRequestUrl(session.sessionId, vpData.transactionRef);
    }
  } catch (err: any) {
    console.warn("[initiate] Failed to pre-create VPR (will use fallback):", err.message);
  }

  /* ---- Build response ---- */
  const origin = process.env.NEXTAUTH_URL || `http://localhost:3001`;
  const verifyUrl = `${origin}/verify/${session.sessionId}`;
  const statusUrl = `${origin}/api/worker/status/${session.sessionId}`;

  return NextResponse.json(
    { sessionId: session.sessionId, verifyUrl, statusUrl, expiresAt: session.expiresAt },
    { status: 201 }
  );
}
