/**
 * POST /api/worker/create-vp-request/:sessionId
 * -----------------------------------------------
 * FALLBACK route: Called by the client-side VerifyClient component
 * only if the pre-created VPR (from initiate) is not available.
 *
 * In normal operation, the VPR is pre-created at session initiation
 * and passed to the client as a prop, so this route is rarely called.
 *
 * Kept for backward compatibility and as a safety net.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, setVerificationRequestUrl } from "@/lib/worker-sessions";
import { createVpRequest } from "@/lib/create-vpr";

export async function POST(
  _req: NextRequest,
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

  try {
    const data = await createVpRequest(session.challenge, params.sessionId);

    // Store the verification request for later reference
    if (data.transactionRef) {
      setVerificationRequestUrl(params.sessionId, data.transactionRef);
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("create-vp-request error:", err);

    if (err.message?.includes("SYSTEM_API_KEY")) {
      return NextResponse.json(
        { error: "SYSTEM_API_KEY not configured on server" },
        { status: 500 }
      );
    }

    if (err.message?.includes("Gateway error")) {
      return NextResponse.json(
        { error: "Failed to create verification request", detail: err.message },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
