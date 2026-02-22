/**
 * POST /api/worker/create-vp-request/:sessionId
 * -----------------------------------------------
 * Called by the client-side VerifyClient component to create a
 * credential-verification request via the verify-gateway.
 *
 * This is an INTERNAL route — no auth header required because
 * the sessionId itself acts as a capability token (it is unguessable
 * and short-lived).
 *
 * The route calls the verify-gateway with the SYSTEM_API_KEY to
 * create a verifiable presentation request for the appropriate challenge.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, setVerificationRequestUrl } from "@/lib/worker-sessions";

const GATEWAY_URL    = process.env.GATEWAY_INTERNAL_URL || "http://verify-gateway:3002";
const SYSTEM_API_KEY = process.env.SYSTEM_API_KEY || "";

/* Challenge → verification request payload mapping */
function buildVPRequestBody(challenge: string) {
  if (challenge === "age_over_18") {
    return {
      challenge: `age-verify-${Date.now()}`,
      credentialStatements: [
        {
          idQualifier: {
            type: "cred",
            issuers: [0, 1, 2, 3, 4]      // accepted identity providers
          },
          statement: [
            {
              type: "AttributeInRange",
              attributeTag: "dob",
              lower: "18000101",           // effectively: born before <18 years ago>
              upper: new Date(
                Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000
              )
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, ""),
            },
          ],
        },
      ],
    };
  }

  // Default / unknown challenge
  throw new Error(`Unsupported challenge: ${challenge}`);
}

export async function POST(
  _req: NextRequest,
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

  try {
    const vpBody = buildVPRequestBody(session.challenge);

    const resp = await fetch(
      `${GATEWAY_URL}/v1/verifiable-presentations/create-verification-request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": SYSTEM_API_KEY,
        },
        body: JSON.stringify(vpBody),
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

    // Store the URL for later reference
    if (data.url) {
      setVerificationRequestUrl(params.sessionId, data.url);
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
