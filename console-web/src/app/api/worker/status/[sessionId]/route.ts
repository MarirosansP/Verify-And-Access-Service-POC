/**
 * GET /api/worker/status/:sessionId
 * ----------------------------------
 * Polled by the CloudFlare Worker (or test page) to check the
 * outcome of a verification session.
 *
 * Headers:
 *   X-Worker-Key: wk_<hex>
 *
 * Response 200:
 *   {
 *     "sessionId":     "<hex>",
 *     "status":        "pending" | "verified" | "failed" | "expired",
 *     "result":        true | false | null,
 *     "failureReason": "..." | null,
 *     "challenge":     "age_over_18",
 *     "siteUrl":       "https://...",
 *     "siteName":      "My Site"
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { validateWorkerKey }         from "@/lib/worker-keys";
import { getSessionStatus }          from "@/lib/worker-sessions";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  /* ---- Authenticate ---- */
  const rawKey = req.headers.get("x-worker-key") || req.headers.get("X-Worker-Key") || "";
  if (!rawKey) {
    return NextResponse.json({ error: "Missing X-Worker-Key header" }, { status: 401 });
  }

  const wk = await validateWorkerKey(rawKey);
  if (!wk) {
    return NextResponse.json({ error: "Invalid or inactive worker key" }, { status: 403 });
  }

  /* ---- Look up session ---- */
  const status = getSessionStatus(params.sessionId);
  if (!status) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(status, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "X-Worker-Key, Content-Type",
    },
  });
}

/* ---- CORS preflight ---- */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "X-Worker-Key, Content-Type",
    },
  });
}
