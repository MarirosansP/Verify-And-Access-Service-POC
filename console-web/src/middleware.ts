import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Auth guard: redirect unauthenticated users to /login ──────────────────
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Admin-only: non-admins visiting /admin/* are bounced to /dashboard
    if (pathname.startsWith("/admin") && !token.isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // ── CORS for /api/worker/* routes ─────────────────────────────────────────
  if (pathname.startsWith("/api/worker")) {
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
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Worker-Key");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/worker/:path*",
  ],
};
