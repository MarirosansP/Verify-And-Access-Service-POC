/**
 * Next.js Middleware — CORS for /api/worker/* routes
 *
 * This file should be MERGED with any existing middleware.ts.
 * If there's no existing middleware, use this as-is.
 */

import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Only apply CORS to worker API routes
  if (request.nextUrl.pathname.startsWith("/api/worker")) {
    // Handle preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Worker-Key",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // For actual requests, add CORS headers to the response
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Worker-Key");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/worker/:path*"],
};
