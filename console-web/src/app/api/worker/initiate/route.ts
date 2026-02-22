/**
 * POST /api/worker/initiate
 * -------------------------
 * Called by a CloudFlare Worker (or test harness) to start a
 * verification session.
 *
 * Headers:
 *   X-Worker-Key: wk_<hex>          ← the worker key
 *
 * Body (JSON):
 *   {
 *     "challenge":    "age_over_18",       // verification type
 *     "callbackUrl":  "https://mysite.com/__va_callback"  // optional override
 *   }
 *
 * Response 201:
 *   {
 *     "sessionId":  "<hex>",
 *     "verifyUrl":  "https://<console>/verify/<sessionId>",
 *     "statusUrl":  "https://<console>/api/worker/status/<sessionId>",
 *     "expiresAt":  "<ISO>"
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { validateWorkerKey }         from "@/lib/worker-keys";
import { createSession }             from "@/lib/worker-sessions";

const SUPPORTED_CHALLENGES = ["age_over_18"];

export async function POST(req: NextRequest) {
  /* ---- Authenticate with worker key ---- */
  const rawKey = req.headers.get("x-worker-key") || req.headers.get("X-Worker-Key") || "";
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

  /* ---- Parse body ---- */
  const body = await req.json().catch(() => ({}));
  const challenge = body.challenge || "age_over_18";

  if (!SUPPORTED_CHALLENGES.includes(challenge)) {
    return NextResponse.json(
      { error: `Unsupported challenge. Supported: ${SUPPORTED_CHALLENGES.join(", ")}` },
      { status: 400 }
    );
  }

  // callbackUrl: default to siteUrl + callbackPath from key config
  const callbackUrl =
    body.callbackUrl ||
    `${wk.siteUrl}${wk.callbackPath === "/" ? "" : wk.callbackPath}`;

  /* ---- Create session ---- */
  const session = createSession({
    workerKeyId: wk.id,
    accountId:   wk.accountId,
    challenge,
    siteUrl:     wk.siteUrl,
    siteName:    wk.siteName,
    callbackUrl,
  });

  /* ---- Build response URLs ---- */
  const origin = process.env.NEXTAUTH_URL || `http://localhost:3001`;
  const verifyUrl = `${origin}/verify/${session.sessionId}`;
  const statusUrl = `${origin}/api/worker/status/${session.sessionId}`;

  return NextResponse.json(
    {
      sessionId: session.sessionId,
      verifyUrl,
      statusUrl,
      expiresAt: session.expiresAt,
    },
    { status: 201 }
  );
}
