/**
 * POST /api/worker/submit-vp/:sessionId
 * ----------------------------------------
 * Called by VerifyClient after receiving the Verifiable Presentation
 * from the Concordium ID app via the SDK.
 *
 * Body: { presentation, verificationRequest }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, markVerified, markFailed } from "@/lib/worker-sessions";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const session = getSession(params.sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or expired" },
      { status: 404 }
    );
  }
  if (session.status !== "pending") {
    return NextResponse.json(
      { error: `Session already ${session.status}` },
      { status: 409 }
    );
  }

  const GATEWAY_URL =
    process.env.GATEWAY_INTERNAL_URL || "http://verify-gateway:3002";
  const SYSTEM_API_KEY = process.env.SYSTEM_API_KEY || "";

  if (!SYSTEM_API_KEY) {
    return NextResponse.json(
      { error: "SYSTEM_API_KEY not configured on server" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const presentation =
    body?.presentation || body?.verifiablePresentation;

  if (!presentation) {
    return NextResponse.json(
      { error: "presentation is required in request body" },
      { status: 400 }
    );
  }

  const auditRecordId = randomUUID();

  try {
    // The credential-verifier expects `presentation` as a raw JSON object,
    // NOT a JSON-encoded string. If we receive a string (e.g. the SDK returned
    // verifiablePresentationJson and it wasn't parsed), parse it first.
    let presentationValue: any = presentation;
    if (typeof presentation === "string") {
      try {
        presentationValue = JSON.parse(presentation);
      } catch {
        // keep as-is if it can't be parsed
      }
    }

    // Build verify payload matching the credential-verifier format
    const verifyPayload = {
      auditRecordId,
      publicInfo: {},
      presentation: presentationValue,          // object, not a string
      verificationRequest: body?.verificationRequest || null,
    };

    console.log("[submit-vp] Verifying VP for session:", params.sessionId);
    console.log("[submit-vp] presentation type:", typeof presentationValue);
    console.log("[submit-vp] presentation keys:", presentationValue && typeof presentationValue === "object" ? Object.keys(presentationValue) : "n/a");
    console.log("[submit-vp] verifyPayload (truncated):", JSON.stringify(verifyPayload)?.slice(0, 500));

    const resp = await fetch(
      `${GATEWAY_URL}/v1/verifiable-presentations/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": SYSTEM_API_KEY,
        },
        body: JSON.stringify(verifyPayload),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("VP verification failed:", resp.status, errText);
      markFailed(params.sessionId, `Verification rejected: ${errText}`);

      // Record failed verification (non-fatal)
      prisma.verificationRecord.create({
        data: {
          userId: session.accountId,
          workerKeyId: session.workerKeyId,
          sessionId: params.sessionId,
          challenge: session.challenge,
          siteName: session.siteName,
          siteUrl: session.siteUrl,
          status: "failed",
          auditRecordId,
          presentationJson: JSON.stringify(presentationValue),
          failureReason: `Verification rejected: ${errText}`,
        },
      }).catch((e: Error) => console.error("[submit-vp] Failed to save record:", e.message));

      return NextResponse.json({
        verified: false,
        reason: "Verification rejected by credential verifier",
        detail: errText,
      });
    }

    const result = await resp.json();
    console.log("[submit-vp] Verification result:", result);

    const isValid = Boolean(
      result?.verified === true ||
        result?.isValid === true ||
        result?.result === "verified" ||
        result?.result === true ||
        result?.outcome === true ||
        result?.decision === true
    );

    if (isValid) {
      markVerified(params.sessionId);

      // Record successful verification (non-fatal)
      prisma.verificationRecord.create({
        data: {
          userId: session.accountId,
          workerKeyId: session.workerKeyId,
          sessionId: params.sessionId,
          challenge: session.challenge,
          siteName: session.siteName,
          siteUrl: session.siteUrl,
          status: "verified",
          auditRecordId,
          presentationJson: JSON.stringify(presentationValue),
          failureReason: null,
        },
      }).catch((e: Error) => console.error("[submit-vp] Failed to save record:", e.message));

      return NextResponse.json({
        verified: true,
        callbackUrl: session.callbackUrl,
        sessionId: params.sessionId,
      });
    } else {
      markFailed(params.sessionId, "ZKP proof did not satisfy the challenge");

      prisma.verificationRecord.create({
        data: {
          userId: session.accountId,
          workerKeyId: session.workerKeyId,
          sessionId: params.sessionId,
          challenge: session.challenge,
          siteName: session.siteName,
          siteUrl: session.siteUrl,
          status: "failed",
          auditRecordId,
          presentationJson: JSON.stringify(presentationValue),
          failureReason: "ZKP proof did not satisfy the challenge",
        },
      }).catch((e: Error) => console.error("[submit-vp] Failed to save record:", e.message));

      return NextResponse.json({
        verified: false,
        reason: "ZKP proof did not satisfy the challenge",
      });
    }
  } catch (err: any) {
    console.error("submit-vp error:", err);
    markFailed(params.sessionId, err.message || "Internal error");

    prisma.verificationRecord.create({
      data: {
        userId: session.accountId,
        workerKeyId: session.workerKeyId,
        sessionId: params.sessionId,
        challenge: session.challenge,
        siteName: session.siteName,
        siteUrl: session.siteUrl,
        status: "failed",
        auditRecordId,
        presentationJson: null,
        failureReason: err.message || "Internal error",
      },
    }).catch((e: Error) => console.error("[submit-vp] Failed to save record:", e.message));

    return NextResponse.json(
      { verified: false, reason: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
