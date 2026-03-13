/**
 * GET /api/worker-keys/:id/download?type=worker|wrangler
 *
 * Generates a pre-configured CF Worker script or wrangler.toml for a given
 * worker key. The actual key value is NOT embedded — it stays as an env var
 * (VA_WORKER_KEY) that the user sets in the CF dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { getWorkerKeyById }          from "@/lib/worker-keys";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = await getWorkerKeyById(params.id, session.user.email);
  if (!key) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "worker";

  if (type === "wrangler") {
    const content = buildWranglerToml(key.siteName, key.siteUrl);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="wrangler.toml"`,
      },
    });
  }

  // Default: worker.js
  const content = buildWorkerScript(key.siteUrl, key.callbackPath);
  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Content-Disposition": `attachment; filename="worker.js"`,
    },
  });
}

/* ── Templates ──────────────────────────────────────────────────────────── */

function buildWorkerScript(siteUrl: string, callbackPath: string): string {
  // Derive the callback URL (siteUrl + callbackPath)
  const normalCallback = callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
  const callbackUrl = `${siteUrl}${normalCallback === "/" ? "" : normalCallback}`;

  return `// Concordium Verify & Access — CloudFlare Worker
// Site: ${siteUrl}
//
// Required environment variables (set in CF dashboard — never hardcode):
//   VA_CONSOLE_URL  e.g. https://console.concordium.com
//   VA_WORKER_KEY   your worker key (secret)
//
// Wrangler CLI secret setup:
//   wrangler secret put VA_WORKER_KEY

// ── Config ───────────────────────────────────────────────────────────────
// Paths that require age verification. "/" protects the entire site.
// Use specific paths to protect only certain sections, e.g. ["/members/"].
const PROTECTED_PATHS = ["/"];

// How long the verification cookie stays valid (seconds). Default: 24 hours.
const COOKIE_MAX_AGE = 86400;

// ── Helpers ──────────────────────────────────────────────────────────────
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) cookies[k.trim()] = v.join("=").trim();
  }
  return cookies;
}

// ── Main handler ─────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── Step 1: Returning from verification ──────────────────────────────
    const vaSession = url.searchParams.get("va_session");
    const vaStatus  = url.searchParams.get("va_status");

    if (vaSession && vaStatus === "verified") {
      try {
        const statusResp = await fetch(
          \`\${env.VA_CONSOLE_URL}/api/worker/status/\${vaSession}\`,
          { headers: { "X-Worker-Key": env.VA_WORKER_KEY } }
        );
        const statusData = await statusResp.json();

        if (statusData.status === "verified" && statusData.result === true) {
          // Strip va_ params from URL before serving
          url.searchParams.delete("va_session");
          url.searchParams.delete("va_status");
          const cleanRequest = new Request(url.toString(), request);
          const resp = await fetch(cleanRequest);
          const newResp = new Response(resp.body, resp);
          newResp.headers.set(
            "Set-Cookie",
            \`va_verified=\${vaSession}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=\${COOKIE_MAX_AGE}\`
          );
          return newResp;
        }
      } catch (err) {
        console.error("VA status check failed:", err);
      }
    }

    // ── Step 2: Already verified (cookie present) ─────────────────────────
    const cookies = parseCookies(request.headers.get("Cookie"));
    if (cookies.va_verified) {
      return fetch(request);
    }

    // ── Step 3: Check if this path requires verification ──────────────────
    const requiresVerification = PROTECTED_PATHS.some(p => url.pathname.startsWith(p));
    if (!requiresVerification) {
      return fetch(request);
    }

    // ── Step 4: Initiate verification ─────────────────────────────────────
    try {
      const initResp = await fetch(\`\${env.VA_CONSOLE_URL}/api/worker/initiate\`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Key": env.VA_WORKER_KEY,
        },
        body: JSON.stringify({
          challenge: "age_over_18",
          callbackUrl: request.url,
        }),
      });

      const { verifyUrl } = await initResp.json();
      if (verifyUrl) return Response.redirect(verifyUrl, 302);
    } catch (err) {
      console.error("VA initiate failed:", err);
    }

    // Fallback: pass through if verification service is unavailable
    return fetch(request);
  },
};
`;
}

function buildWranglerToml(siteName: string, siteUrl: string): string {
  // Convert site URL to a CF route pattern
  const host = siteUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  // Slugify site name for CF worker name
  const workerName = siteName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63) || "verify-and-access";

  return `# wrangler.toml — Concordium Verify & Access
# Worker: ${siteName}
# Site:   ${siteUrl}
#
# Deploy:
#   1. wrangler secret put VA_WORKER_KEY
#   2. wrangler deploy

name = "${workerName}"
main = "worker.js"
compatibility_date = "2024-01-01"

[[routes]]
pattern = "${host}/*"
zone_name = "${host}"

[vars]
VA_CONSOLE_URL = "https://console.concordium.com"

# Set your worker key as a secret (never commit it):
#   wrangler secret put VA_WORKER_KEY
`;
}
