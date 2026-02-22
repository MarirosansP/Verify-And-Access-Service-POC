/**
 * CORS helper for worker API routes.
 *
 * CloudFlare Workers call from arbitrary origins,
 * so the /api/worker/* endpoints need permissive CORS.
 */

import { NextResponse } from "next/server";

export function corsHeaders(origin?: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Worker-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export function withCors(response: NextResponse, origin?: string | null): NextResponse {
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}
