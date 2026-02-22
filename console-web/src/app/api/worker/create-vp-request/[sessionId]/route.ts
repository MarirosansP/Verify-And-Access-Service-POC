/**
 * POST /api/worker/create-vp-request/:sessionId
 * -----------------------------------------------
 * Called by the client-side VerifyClient component to create a
 * credential-verification request via the verify-gateway.
 *
 * The route calls the verify-gateway with the SYSTEM_API_KEY using
 * the correct ConcordiumVerificationRequestV1 format.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, setVerificationRequestUrl } from "@/lib/worker-sessions";

/**
 * Encode a string as a CBOR text string in hex.
 * CBOR major type 3 (text string): 0x60 + length for short strings,
 * or 0x78 + 1-byte length for strings up to 255 chars.
 */
function cborEncodeStringHex(str: string): string {
  const buf = Buffer.from(str, "utf-8");
  const len = buf.length;
  let header: Buffer;
  if (len < 24) {
    header = Buffer.from([0x60 + len]);
  } else if (len < 256) {
    header = Buffer.from([0x78, len]);
  } else {
    // 2-byte length
    header = Buffer.from([0x79, (len >> 8) & 0xff, len & 0xff]);
  }
  return Buffer.concat([header, buf]).toString("hex");
}

/* Build the request body the credential-verifier expects */
function buildRequestBody(challenge: string, sessionId: string) {
  if (challenge === "age_over_18") {
    const eighteenYearsAgo = new Date(
      Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000
    );
    const upper = eighteenYearsAgo
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

    return {
      connectionId: `worker-session-${sessionId}`,
      resourceId: "verify-and-access.local",
      contextString: "over18",
      publicInfo: {
        sessionIdRef: cborEncodeStringHex(sessionId),
      },
      requestedClaims: [
        {
          type: "identity",
          source: ["identityCredential", "accountCredential"],
          issuers: [
            "did:ccd:mainnet:idp:0",
            "did:ccd:mainnet:idp:1",
            "did:ccd:mainnet:idp:2",
            "did:ccd:mainnet:idp:3",
            "did:ccd:mainnet:idp:4",
          ],
          statements: [
            {
              type: "AttributeInRange",
              attributeTag: "dob",
              lower: "18000101",
              upper,
            },
          ],
        },
      ],
    };
  }

  throw new Error(`Unsupported challenge: ${challenge}`);
}

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

  // Read env vars at request time
  const GATEWAY_URL =
    process.env.GATEWAY_INTERNAL_URL || "http://verify-gateway:3002";
  const SYSTEM_API_KEY = process.env.SYSTEM_API_KEY || "";

  if (!SYSTEM_API_KEY) {
    console.error("SYSTEM_API_KEY is not set");
    return NextResponse.json(
      { error: "SYSTEM_API_KEY not configured on server" },
      { status: 500 }
    );
  }

  try {
    const reqBody = buildRequestBody(session.challenge, params.sessionId);

    console.log(
      "[create-vp-request] Calling gateway for session:",
      params.sessionId
    );

    const resp = await fetch(
      `${GATEWAY_URL}/v1/verifiable-presentations/create-verification-request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": SYSTEM_API_KEY,
        },
        body: JSON.stringify(reqBody),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Gateway error:", resp.status, errText);
      return NextResponse.json(
        { error: "Failed to create verification request", detail: errText },
        { status: 502 }
      );
    }

    const data = await resp.json();

    // Store the verification request for later reference
    if (data.transactionRef) {
      setVerificationRequestUrl(params.sessionId, data.transactionRef);
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("create-vp-request error:", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
