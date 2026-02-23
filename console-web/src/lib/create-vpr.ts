/**
 * Shared VPR (Verifiable Presentation Request) creation logic.
 *
 * Extracted so that both:
 *   - POST /api/worker/initiate  (pre-creates VPR at session init)
 *   - POST /api/worker/create-vp-request/:sessionId  (fallback)
 * can reuse the same code.
 */

/**
 * Encode a string as a CBOR text string in hex.
 * CBOR major type 3 (text string): 0x60 + length for short strings,
 * or 0x78 + 1-byte length for strings up to 255 chars.
 */
export function cborEncodeStringHex(str: string): string {
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

/** Build the request body the credential-verifier expects. */
export function buildRequestBody(challenge: string, sessionId: string) {
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

/**
 * Call the verify-gateway to create a VPR and return the response data.
 * Returns the full VPR object or throws on failure.
 */
export async function createVpRequest(
  challenge: string,
  sessionId: string
): Promise<any> {
  const GATEWAY_URL =
    process.env.GATEWAY_INTERNAL_URL || "http://verify-gateway:3002";
  const SYSTEM_API_KEY = process.env.SYSTEM_API_KEY || "";

  if (!SYSTEM_API_KEY) {
    throw new Error("SYSTEM_API_KEY not configured on server");
  }

  const reqBody = buildRequestBody(challenge, sessionId);

  console.log("[create-vpr] Calling gateway for session:", sessionId);

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
    console.error("[create-vpr] Gateway error:", resp.status, errText);
    throw new Error(`Gateway error ${resp.status}: ${errText}`);
  }

  return resp.json();
}
