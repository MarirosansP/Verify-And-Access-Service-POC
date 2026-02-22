/**
 * POST /api/worker/submit-vp/:sessionId
 * ----------------------------------------
 * Called by the client-side VerifyClient after receiving the
 * Verifiable Presentation from the Concordium ID app via WalletConnect.
 *
 * Body (JSON):
 *   { "verifiablePresentation": { ... } }
 *
 * This route submits the VP to the credential-verifier (through the
 * gateway) for validation, then marks the session verified / failed.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, markVerified, markFailed } from "@/lib/worker-sessions";

const GATEWAY_URL    = process.env.GATEWAY_INTERNAL_URL || "http://verify-gateway:3002";
const SYSTEM_API_KEY = process.env.SYSTEM_API_KEY || "";

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const session = getSession(params.sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }
  if (session.status !== "pending") {
    return NextResponse.json({ error: `Session already ${session.status}` }, { status: 409 });
  }
  if (!SYSTEM_API_KEY) {
    return NextResponse.json(
      { error: "SYSTEM_API_KEY not configured on server" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.verifiablePresentation) {
    return NextResponse.json(
      { error: "verifiablePresentation is required" },
      { status: 400 }
    );
  }

  try {
    // Build the payload the credential-verifier expects.
    // It needs the VP wrapped with the challenge context.
    const verifyPayload = {
      verifiablePresentationJson: JSON.stringify(body.verifiablePresentation),
      auditRecordId: `worker-session-${params.sessionId}`,
    };

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

    // The verifier returns something like { "result": true/false }
    // or it returns 200 if the proof is valid.
    const isValid = result.result !== false;

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
