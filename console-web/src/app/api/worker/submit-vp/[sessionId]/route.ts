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
import { randomUUID } from "crypto";

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

  try {
    // Build verify payload matching the credential-verifier format
    const verifyPayload = {
      auditRecordId: randomUUID(),
      publicInfo: {},
      presentation:
        typeof presentation === "string"
          ? presentation
          : JSON.stringify(presentation),
      verificationRequest: body?.verificationRequest || null,
    };

    console.log("[submit-vp] Verifying VP for session:", params.sessionId);

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
      return NextResponse.json({
        verified: true,
        callbackUrl: session.callbackUrl,
        sessionId: params.sessionId,
      });
    } else {
      markFailed(params.sessionId, "ZKP proof did not satisfy the challenge");
      return NextResponse.json({
        verified: false,
        reason: "ZKP proof did not satisfy the challenge",
      });
    }
  } catch (err: any) {
    console.error("submit-vp error:", err);
    markFailed(params.sessionId, err.message || "Internal error");
    return NextResponse.json(
      { verified: false, reason: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
