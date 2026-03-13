"use client";

/**
 * /dashboard/worker-keys  — Manage CloudFlare Worker Keys
 *
 * Concordium-branded dark theme. Lets users create, pause, revoke, and delete
 * worker keys, view per-key usage stats inline, and download a pre-configured
 * CF Worker script + wrangler.toml for each key.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";

interface WorkerKeyRow {
  id: string;
  siteName: string;
  siteUrl: string;
  callbackPath: string;
  status: "active" | "paused" | "revoked";
  createdAt: string;
}

type WorkerKeyStats = {
  quotaUsed: number;
  quotaLimit: number;
  dailyRows: { date: string; count: number }[];
  totalCalls: number;
};

type PanelType = "stats" | "setup" | null;

/* ── Shared styles ──────────────────────────────────────────────────────── */

const codeBlock: React.CSSProperties = {
  background: "#090E1A",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: 12,
  lineHeight: 1.7,
  overflowX: "auto",
  margin: 0,
  color: "#a5f3fc",
  fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
  whiteSpace: "pre",
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#9FB2D3",
  textTransform: "uppercase",
  letterSpacing: "0.6px",
  marginBottom: 6,
};

/* ── Copy button ─────────────────────────────────────────────────────────── */
function CopyButton({ text, style }: { text: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button onClick={handleCopy} style={{
      background: copied ? "rgba(38,103,255,0.15)" : "rgba(255,255,255,0.06)",
      border: `1px solid ${copied ? "rgba(38,103,255,0.4)" : "rgba(255,255,255,0.12)"}`,
      color: copied ? "#2667FF" : "#9FB2D3",
      padding: "4px 10px",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 12,
      fontFamily: "inherit",
      fontWeight: 500,
      transition: "all 0.15s",
      ...style,
    }}>
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

/* ── Per-key stats panel ── */
function StatsPanel({ data }: { data: WorkerKeyStats | "loading" | undefined }) {
  if (data === undefined || data === "loading") {
    return (
      <div style={{
        background: "#0D1825", borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "14px 18px", color: "#9FB2D3", fontSize: 13,
      }}>
        Loading stats…
      </div>
    );
  }

  const quotaPct = data.quotaLimit > 0
    ? Math.min(100, Math.round((data.quotaUsed / data.quotaLimit) * 100))
    : 0;
  const barColor = quotaPct >= 100 ? "#ef4444" : quotaPct >= 80 ? "#f59e0b" : "#2667FF";
  const maxDay = Math.max(...data.dailyRows.map(r => r.count), 1);

  return (
    <div style={{
      background: "#0D1825",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      padding: "16px 18px",
      display: "grid",
      gap: 16,
    }}>
      {/* Quota bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={sectionLabel}>Hourly Quota</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>
            {data.quotaUsed} / {data.quotaLimit}
          </span>
        </div>
        <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 999 }}>
          <div style={{
            height: 5, borderRadius: 999, background: barColor,
            width: `${quotaPct}%`, transition: "width 0.4s ease",
          }} />
        </div>
        {quotaPct >= 100 && (
          <div style={{ marginTop: 5, fontSize: 11, color: "#ef4444" }}>
            Quota reached — requests returning 429
          </div>
        )}
      </div>

      {/* Daily bar chart */}
      <div>
        <div style={{ ...sectionLabel, marginBottom: 8 }}>Calls — last 14 days</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 52 }}>
          {data.dailyRows.map(r => {
            const h = r.count > 0 ? Math.max((r.count / maxDay) * 46, 3) : 0;
            return (
              <div
                key={r.date}
                title={`${r.date}: ${r.count} call${r.count !== 1 ? "s" : ""}`}
                style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
              >
                <div style={{ height: h, background: "#2667FF", opacity: 0.7, borderRadius: "2px 2px 0 0" }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
          <span style={{ fontSize: 10, color: "#9FB2D3" }}>{data.dailyRows[0]?.date?.slice(5)}</span>
          <span style={{ fontSize: 10, color: "#9FB2D3" }}>{data.dailyRows[data.dailyRows.length - 1]?.date?.slice(5)}</span>
        </div>
      </div>

      {/* Total */}
      <div>
        <div style={sectionLabel}>Total (14d)</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#e7edf7", marginTop: 2 }}>
          {data.totalCalls}
        </div>
      </div>
    </div>
  );
}

/* ── Per-key setup panel ── */
function SetupPanel({ keyRow }: { keyRow: WorkerKeyRow }) {
  const consoleUrl = typeof window !== "undefined" ? window.location.origin : "https://console.concordium.com";

  const workerScript = buildWorkerScript(keyRow.siteUrl, keyRow.callbackPath, consoleUrl);
  const wranglerToml = buildWranglerToml(keyRow.siteName, keyRow.siteUrl, consoleUrl);
  const pageSnippet  = buildPageSnippet();
  const secretCmd    = `wrangler secret put VA_WORKER_KEY`;
  const deployCmd    = `wrangler deploy`;

  return (
    <div style={{
      background: "#0D1825",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      padding: "20px 20px",
      display: "grid",
      gap: 24,
    }}>

      {/* Intro */}
      <div style={{ fontSize: 13, color: "#9FB2D3", lineHeight: 1.6 }}>
        Deploy a CloudFlare Worker that intercepts requests to <strong style={{ color: "#e7edf7" }}>{keyRow.siteUrl}</strong> and
        gates access behind Concordium age verification.
      </div>

      {/* Step 1 */}
      <SetupStep number={1} title="Install Wrangler CLI">
        <div style={{ fontSize: 13, color: "#9FB2D3", marginBottom: 8 }}>
          Install the Cloudflare Wrangler CLI if you haven't already:
        </div>
        <div style={{ position: "relative" }}>
          <pre style={codeBlock}>{`npm install -g wrangler\nwrangler login`}</pre>
          <CopyButton text={`npm install -g wrangler\nwrangler login`} style={{ position: "absolute", top: 8, right: 8 }} />
        </div>
      </SetupStep>

      {/* Step 2 */}
      <SetupStep number={2} title="Download your Worker script">
        <div style={{ fontSize: 13, color: "#9FB2D3", marginBottom: 10 }}>
          Download the pre-configured files for <strong style={{ color: "#e7edf7" }}>{keyRow.siteName}</strong>.
          The Worker script handles verification callbacks, cookie checks, and initiating new verification flows.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <a
            href={`/api/worker-keys/${keyRow.id}/download?type=worker`}
            download="worker.js"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", background: "#2667FF", color: "#fff",
              borderRadius: 7, fontSize: 13, fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ↓ Download worker.js
          </a>
          <a
            href={`/api/worker-keys/${keyRow.id}/download?type=wrangler`}
            download="wrangler.toml"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#e7edf7", borderRadius: 7, fontSize: 13, fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ↓ Download wrangler.toml
          </a>
        </div>
        <details style={{ cursor: "pointer" }}>
          <summary style={{ fontSize: 12, color: "#9FB2D3", userSelect: "none", marginBottom: 8 }}>
            Preview worker.js
          </summary>
          <div style={{ position: "relative", marginTop: 8 }}>
            <pre style={{ ...codeBlock, maxHeight: 300, overflowY: "auto" }}>{workerScript}</pre>
            <CopyButton text={workerScript} style={{ position: "absolute", top: 8, right: 8 }} />
          </div>
        </details>
        <details style={{ cursor: "pointer", marginTop: 8 }}>
          <summary style={{ fontSize: 12, color: "#9FB2D3", userSelect: "none", marginBottom: 8 }}>
            Preview wrangler.toml
          </summary>
          <div style={{ position: "relative", marginTop: 8 }}>
            <pre style={{ ...codeBlock }}>{wranglerToml}</pre>
            <CopyButton text={wranglerToml} style={{ position: "absolute", top: 8, right: 8 }} />
          </div>
        </details>
      </SetupStep>

      {/* Step 3 */}
      <SetupStep number={3} title="Set your Worker Key as a secret">
        <div style={{ fontSize: 13, color: "#9FB2D3", marginBottom: 8 }}>
          Your Worker Key must be set as a Cloudflare secret — <strong style={{ color: "#ef4444" }}>never hardcode it</strong>.
          Run this from the same directory as your <code style={{ color: "#a5f3fc" }}>wrangler.toml</code>:
        </div>
        <div style={{ position: "relative" }}>
          <pre style={codeBlock}>{secretCmd}</pre>
          <CopyButton text={secretCmd} style={{ position: "absolute", top: 8, right: 8 }} />
        </div>
        <div style={{ fontSize: 12, color: "#9FB2D3", marginTop: 8, lineHeight: 1.6 }}>
          When prompted, paste your Worker Key. You can also set{" "}
          <code style={{ color: "#a5f3fc" }}>VA_CONSOLE_URL</code> in the{" "}
          <code style={{ color: "#a5f3fc" }}>wrangler.toml</code>{" "}
          <code style={{ color: "#a5f3fc" }}>[vars]</code> section (it's not secret).
        </div>
      </SetupStep>

      {/* Step 4 */}
      <SetupStep number={4} title="Deploy your Worker">
        <div style={{ fontSize: 13, color: "#9FB2D3", marginBottom: 8 }}>
          Deploy from your project directory:
        </div>
        <div style={{ position: "relative" }}>
          <pre style={codeBlock}>{deployCmd}</pre>
          <CopyButton text={deployCmd} style={{ position: "absolute", top: 8, right: 8 }} />
        </div>
        <div style={{ fontSize: 12, color: "#9FB2D3", marginTop: 8, lineHeight: 1.6 }}>
          Wrangler will route <code style={{ color: "#a5f3fc" }}>{keyRow.siteUrl.replace(/^https?:\/\//, "")}/*</code> through your Worker.
          Make sure your domain is on Cloudflare (proxied ☁) for the Worker to intercept requests.
        </div>
      </SetupStep>

      {/* Step 5 — optional page snippet */}
      <SetupStep number={5} title="Optional: show content only to verified users">
        <div style={{ fontSize: 13, color: "#9FB2D3", marginBottom: 8, lineHeight: 1.6 }}>
          Add this snippet to pages where you want to show or hide content based on verification status.
          Tag elements with <code style={{ color: "#a5f3fc" }}>data-va-protected</code> — they'll be hidden until verified.
          Place the script just before <code style={{ color: "#a5f3fc" }}>&lt;/body&gt;</code>:
        </div>
        <div style={{ position: "relative" }}>
          <pre style={codeBlock}>{pageSnippet}</pre>
          <CopyButton text={pageSnippet} style={{ position: "absolute", top: 8, right: 8 }} />
        </div>
        <div style={{ fontSize: 12, color: "#9FB2D3", marginTop: 10, lineHeight: 1.6 }}>
          Example usage:
        </div>
        <div style={{ position: "relative", marginTop: 6 }}>
          <pre style={codeBlock}>{`<!-- This content is hidden until the user is age-verified -->\n<div data-va-protected>\n  <h2>Members Only Content</h2>\n  <p>You're verified! Welcome.</p>\n</div>`}</pre>
          <CopyButton text={`<!-- This content is hidden until the user is age-verified -->\n<div data-va-protected>\n  <h2>Members Only Content</h2>\n  <p>You're verified! Welcome.</p>\n</div>`} style={{ position: "absolute", top: 8, right: 8 }} />
        </div>
      </SetupStep>

    </div>
  );
}

/* ── Setup step wrapper ── */
function SetupStep({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          background: "#2667FF", color: "#fff",
          fontSize: 11, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {number}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#e7edf7" }}>{title}</div>
      </div>
      <div style={{ paddingLeft: 32 }}>{children}</div>
    </div>
  );
}

/* ── Script builders (client-side, using window.location.origin) ── */

function buildWorkerScript(siteUrl: string, callbackPath: string, consoleUrl: string): string {
  const normalCallback = callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
  void normalCallback; // used for context only

  return `// Concordium Verify & Access — CloudFlare Worker
// Site: ${siteUrl}
//
// Required environment variables (set via wrangler secret / CF dashboard):
//   VA_CONSOLE_URL  = "${consoleUrl}"
//   VA_WORKER_KEY   = <your worker key>

const PROTECTED_PATHS = ["/"];
const COOKIE_MAX_AGE  = 86400; // 24 hours

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) cookies[k.trim()] = v.join("=").trim();
  }
  return cookies;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── Callback: returning from verification ────────────────────────────
    const vaSession = url.searchParams.get("va_session");
    const vaStatus  = url.searchParams.get("va_status");

    if (vaSession && vaStatus === "verified") {
      try {
        const statusResp = await fetch(
          \`\${env.VA_CONSOLE_URL}/api/worker/status/\${vaSession}\`,
          { headers: { "X-Worker-Key": env.VA_WORKER_KEY } }
        );
        const { status, result } = await statusResp.json();
        if (status === "verified" && result === true) {
          url.searchParams.delete("va_session");
          url.searchParams.delete("va_status");
          const cleanResp = await fetch(new Request(url.toString(), request));
          const newResp = new Response(cleanResp.body, cleanResp);
          newResp.headers.set("Set-Cookie",
            \`va_verified=\${vaSession}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=\${COOKIE_MAX_AGE}\`);
          return newResp;
        }
      } catch (err) {
        console.error("VA status check failed:", err);
      }
    }

    // ── Already verified ─────────────────────────────────────────────────
    const cookies = parseCookies(request.headers.get("Cookie"));
    if (cookies.va_verified) return fetch(request);

    // ── Path not protected ───────────────────────────────────────────────
    if (!PROTECTED_PATHS.some(p => url.pathname.startsWith(p))) {
      return fetch(request);
    }

    // ── Initiate verification ────────────────────────────────────────────
    try {
      const initResp = await fetch(\`\${env.VA_CONSOLE_URL}/api/worker/initiate\`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Worker-Key": env.VA_WORKER_KEY },
        body: JSON.stringify({ challenge: "age_over_18", callbackUrl: request.url }),
      });
      const { verifyUrl } = await initResp.json();
      if (verifyUrl) return Response.redirect(verifyUrl, 302);
    } catch (err) {
      console.error("VA initiate failed:", err);
    }

    return fetch(request); // fallback: pass through
  },
};`;
}

function buildWranglerToml(siteName: string, siteUrl: string, consoleUrl: string): string {
  const host = siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const workerName = siteName
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63) || "verify-and-access";

  return `# wrangler.toml — Concordium Verify & Access
# Worker: ${siteName}
# Site:   ${siteUrl}

name = "${workerName}"
main = "worker.js"
compatibility_date = "2024-01-01"

[[routes]]
pattern = "${host}/*"
zone_name = "${host}"

[vars]
VA_CONSOLE_URL = "${consoleUrl}"

# Set your worker key as a secret (never commit it):
#   wrangler secret put VA_WORKER_KEY`;
}

function buildPageSnippet(): string {
  return `<script>
(function () {
  function getCookie(name) {
    var m = document.cookie.match("(^|;)\\\\s*" + name + "\\\\s*=\\\\s*([^;]+)");
    return m ? m.pop() : null;
  }
  if (!getCookie("va_verified")) {
    document.querySelectorAll("[data-va-protected]").forEach(function (el) {
      el.style.display = "none";
    });
  }
})();
</script>`;
}

/* ── Worker Keys Page ── */
export default function WorkerKeysPage() {
  const [keys, setKeys]             = useState<WorkerKeyRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [newKeyVisible, setNewKey]  = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Per-key panel state: "stats" | "setup" | null
  const [openPanel, setOpenPanel]   = useState<{ id: string; type: PanelType } | null>(null);
  const [keyStats, setKeyStats]     = useState<Record<string, WorkerKeyStats | "loading">>({});

  // Form state
  const [siteName, setSiteName]         = useState("");
  const [siteUrl, setSiteUrl]           = useState("");
  const [callbackPath, setCallbackPath] = useState("/");

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/worker-keys");
      const data = await resp.json();
      setKeys(data.keys || []);
    } catch (err) {
      console.error("Failed to load worker keys:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  async function togglePanel(id: string, type: PanelType) {
    // Close if same panel is open
    if (openPanel?.id === id && openPanel?.type === type) {
      setOpenPanel(null);
      return;
    }
    setOpenPanel({ id, type });

    // Load stats on first open
    if (type === "stats" && !keyStats[id]) {
      setKeyStats(prev => ({ ...prev, [id]: "loading" }));
      try {
        const data = await fetch(`/api/worker-keys/${id}/usage?days=14`).then(r => r.json());
        setKeyStats(prev => ({ ...prev, [id]: data }));
      } catch {
        setKeyStats(prev => { const n = { ...prev }; delete n[id]; return n; });
      }
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatedKey(null);
    try {
      const resp = await fetch("/api/worker-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteName, siteUrl, callbackPath }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(`Error: ${err.error}`);
        return;
      }
      const data = await resp.json();
      setCreatedKey(data.key);
      setSiteName(""); setSiteUrl(""); setCallbackPath("/");
      fetchKeys();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/worker-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchKeys();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this worker key?")) return;
    try {
      await fetch(`/api/worker-keys/${id}`, { method: "DELETE" });
      fetchKeys();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const statusColor = (s: string) =>
    s === "active" ? "#2667FF" : s === "paused" ? "#f59e0b" : "#f87171";

  const actionBtn = (active = false, color = "#9FB2D3"): React.CSSProperties => ({
    background: active ? "rgba(38,103,255,0.12)" : "transparent",
    border: `1px solid ${active ? "rgba(38,103,255,0.4)" : "rgba(255,255,255,0.12)"}`,
    color: active ? "#2667FF" : color,
    padding: "4px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "inherit",
    fontWeight: 500,
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.12)", background: "#0D1825",
    color: "#e7edf7", fontSize: 14, fontFamily: "inherit",
    boxSizing: "border-box", outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "#9FB2D3",
    display: "block", marginBottom: 4,
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>

      {/* ── Header ── */}
      <div>
        <a href="/dashboard" style={{ fontSize: 13, color: "#9FB2D3", textDecoration: "none" }}>
          ← Dashboard
        </a>
        <h1 style={{ margin: "8px 0 4px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.4px" }}>
          Worker Keys
        </h1>
        <div style={{ fontSize: 13, color: "#9FB2D3" }}>
          Integrate Verify &amp; Access into any CloudFlare-protected site. Each key is bound to one site URL.
        </div>
      </div>

      {/* ── Create form ── */}
      <div style={{
        background: "#1B2735",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        overflow: "hidden",
      }}>
        <div
          onClick={() => setNewKey(!newKeyVisible)}
          style={{
            padding: "16px 20px", cursor: "pointer",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15 }}>Create New Worker Key</span>
          <span style={{ color: "#9FB2D3", fontSize: 13 }}>{newKeyVisible ? "▲" : "▼"}</span>
        </div>

        {newKeyVisible && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "16px 20px" }}>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Site Name</label>
                <input
                  style={inputStyle} placeholder="My Awesome Blog"
                  value={siteName} onChange={e => setSiteName(e.target.value)} required
                />
              </div>
              <div>
                <label style={labelStyle}>Site URL</label>
                <input
                  style={inputStyle} placeholder="https://mysite.com"
                  value={siteUrl} onChange={e => setSiteUrl(e.target.value)} required type="url"
                />
              </div>
              <div>
                <label style={labelStyle}>Callback Path</label>
                <input
                  style={inputStyle} placeholder="/"
                  value={callbackPath} onChange={e => setCallbackPath(e.target.value)}
                />
                <div style={{ fontSize: 11, color: "#9FB2D3", marginTop: 4 }}>
                  Where verified users are redirected to on your site
                </div>
              </div>
              <div>
                <button type="submit" style={{
                  padding: "8px 18px", background: "#2667FF", color: "#fff",
                  border: "none", borderRadius: 8, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                }}>
                  Create Worker Key
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Show-once key banner */}
        {createdKey && (
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            padding: "16px 20px", background: "#0D1825",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 8 }}>
              ⚠️ Copy this key now — it will not be shown again:
            </div>
            <code style={{
              wordBreak: "break-all", display: "block", padding: "10px 12px",
              background: "#090E1A", border: "1px solid rgba(38,103,255,0.25)",
              borderRadius: 8, fontSize: 13, color: "#2667FF", marginBottom: 10,
            }}>
              {createdKey}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(createdKey); }}
              style={{
                padding: "6px 14px", background: "#2667FF", color: "#fff",
                border: "none", borderRadius: 6, cursor: "pointer",
                fontWeight: 600, fontFamily: "inherit", fontSize: 13,
              }}
            >
              Copy to Clipboard
            </button>
          </div>
        )}
      </div>

      {/* ── Keys list ── */}
      <div style={{
        background: "#1B2735",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 20,
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Your Worker Keys</div>

        {loading ? (
          <div style={{ fontSize: 13, color: "#9FB2D3" }}>Loading…</div>
        ) : keys.length === 0 ? (
          <div style={{ fontSize: 13, color: "#9FB2D3" }}>No worker keys yet. Create one above.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {keys.map(k => {
              const statsOpen = openPanel?.id === k.id && openPanel?.type === "stats";
              const setupOpen = openPanel?.id === k.id && openPanel?.type === "setup";
              return (
                <div key={k.id} style={{
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}>
                  {/* Key card header */}
                  <div style={{
                    padding: "12px 14px", background: "#0D1825",
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", gap: 10, flexWrap: "wrap",
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{k.siteName}</div>
                      <div style={{ fontSize: 12, color: "#9FB2D3", marginTop: 3 }}>
                        <code style={{ color: "#9FB2D3" }}>{k.siteUrl}</code>
                        {" · "}
                        <span style={{ color: statusColor(k.status) }}>●</span>
                        {" "}
                        <b style={{ color: statusColor(k.status) }}>{k.status}</b>
                        {" · callback: "}
                        <code style={{ color: "#9FB2D3" }}>{k.callbackPath}</code>
                      </div>
                      <div style={{ fontSize: 11, color: "#9FB2D3", marginTop: 2 }}>
                        Created {new Date(k.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        onClick={() => togglePanel(k.id, "stats")}
                        style={actionBtn(statsOpen)}
                      >
                        {statsOpen ? "▲ Stats" : "▼ Stats"}
                      </button>
                      <button
                        onClick={() => togglePanel(k.id, "setup")}
                        style={actionBtn(setupOpen, "#a5f3fc")}
                      >
                        {setupOpen ? "▲ Setup" : "▼ Setup"}
                      </button>
                      {k.status === "active" && (
                        <button onClick={() => updateStatus(k.id, "paused")} style={actionBtn()}>Pause</button>
                      )}
                      {k.status === "paused" && (
                        <button onClick={() => updateStatus(k.id, "active")} style={actionBtn()}>Activate</button>
                      )}
                      {k.status !== "revoked" && (
                        <button onClick={() => updateStatus(k.id, "revoked")} style={actionBtn(false, "#f87171")}>Revoke</button>
                      )}
                      <button onClick={() => handleDelete(k.id)} style={actionBtn(false, "#f87171")}>Delete</button>
                    </div>
                  </div>

                  {/* Expandable panels */}
                  {statsOpen && <StatsPanel data={keyStats[k.id]} />}
                  {setupOpen && <SetupPanel keyRow={k} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
