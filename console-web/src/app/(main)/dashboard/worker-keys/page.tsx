"use client";

/**
 * /dashboard/worker-keys  — Manage CloudFlare Worker Keys
 *
 * Concordium-branded dark theme. Lets users create, pause, revoke, and delete
 * worker keys, and view per-key usage stats inline.
 */

import React, { useState, useEffect, useCallback } from "react";

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
  const barColor = quotaPct >= 100 ? "#ef4444" : quotaPct >= 80 ? "#f59e0b" : "#28C76F";
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
          <span style={{ fontSize: 11, fontWeight: 600, color: "#9FB2D3", textTransform: "uppercase", letterSpacing: "0.6px" }}>
            Hourly Quota
          </span>
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
        <div style={{
          fontSize: 11, fontWeight: 600, color: "#9FB2D3",
          textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8,
        }}>
          Calls — last 14 days
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 52 }}>
          {data.dailyRows.map(r => {
            const h = r.count > 0 ? Math.max((r.count / maxDay) * 46, 3) : 0;
            return (
              <div
                key={r.date}
                title={`${r.date}: ${r.count} call${r.count !== 1 ? "s" : ""}`}
                style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
              >
                <div style={{
                  height: h, background: "#28C76F", opacity: 0.7,
                  borderRadius: "2px 2px 0 0",
                }} />
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
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9FB2D3", textTransform: "uppercase", letterSpacing: "0.6px" }}>
          Total (14d)
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#e7edf7", marginTop: 2 }}>
          {data.totalCalls}
        </div>
      </div>
    </div>
  );
}

/* ── Worker Keys Page ── */
export default function WorkerKeysPage() {
  const [keys, setKeys]             = useState<WorkerKeyRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [newKeyVisible, setNewKey]  = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Per-key stats
  const [openStatsId, setOpenStatsId] = useState<string | null>(null);
  const [keyStats, setKeyStats] = useState<Record<string, WorkerKeyStats | "loading">>({});

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

  async function toggleStats(id: string) {
    if (openStatsId === id) {
      setOpenStatsId(null);
      return;
    }
    setOpenStatsId(id);
    if (!keyStats[id]) {
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
    s === "active" ? "#28C76F" : s === "paused" ? "#f59e0b" : "#f87171";

  const actionBtn = (color = "#9FB2D3"): React.CSSProperties => ({
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    color,
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
                  padding: "8px 18px", background: "#28C76F", color: "#fff",
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
              background: "#090E1A", border: "1px solid rgba(40,199,111,0.25)",
              borderRadius: 8, fontSize: 13, color: "#28C76F", marginBottom: 10,
            }}>
              {createdKey}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(createdKey); alert("Copied!"); }}
              style={{
                padding: "6px 14px", background: "#28C76F", color: "#fff",
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
            {keys.map(k => (
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
                      onClick={() => toggleStats(k.id)}
                      style={{
                        ...actionBtn(openStatsId === k.id ? "#28C76F" : "#9FB2D3"),
                        ...(openStatsId === k.id ? { borderColor: "rgba(40,199,111,0.4)" } : {}),
                      }}
                    >
                      {openStatsId === k.id ? "▲ Stats" : "▼ Stats"}
                    </button>
                    {k.status === "active" && (
                      <button onClick={() => updateStatus(k.id, "paused")} style={actionBtn()}>Pause</button>
                    )}
                    {k.status === "paused" && (
                      <button onClick={() => updateStatus(k.id, "active")} style={actionBtn()}>Activate</button>
                    )}
                    {k.status !== "revoked" && (
                      <button onClick={() => updateStatus(k.id, "revoked")} style={actionBtn("#f87171")}>Revoke</button>
                    )}
                    <button onClick={() => handleDelete(k.id)} style={actionBtn("#f87171")}>Delete</button>
                  </div>
                </div>
                {/* Expandable stats panel */}
                {openStatsId === k.id && (
                  <StatsPanel data={keyStats[k.id]} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Integration guide ── */}
      <div style={{
        background: "#1B2735",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 20,
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Integration Guide</div>
        <div style={{ fontSize: 13, color: "#9FB2D3", marginBottom: 12 }}>
          Use this snippet in your CloudFlare Worker to integrate Verify &amp; Access:
        </div>
        <pre style={{
          background: "#0D1825", color: "#a5f3fc", padding: "16px", borderRadius: 10,
          overflowX: "auto", fontSize: 12, lineHeight: 1.7, margin: 0,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          {integrationSnippet}
        </pre>
      </div>

    </div>
  );
}

/* ── Integration snippet ── */
const integrationSnippet = `// CloudFlare Worker — Verify & Access Integration
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Check for returning verified user
    const vaSession = url.searchParams.get("va_session");
    const vaStatus  = url.searchParams.get("va_status");

    if (vaSession && vaStatus === "verified") {
      const check = await fetch(
        env.VA_STATUS_URL + "/" + vaSession,
        { headers: { "X-Worker-Key": env.VA_WORKER_KEY } }
      );
      const result = await check.json();

      if (result.status === "verified" && result.result === true) {
        const resp = await fetch(request);
        const newResp = new Response(resp.body, resp);
        newResp.headers.set("Set-Cookie",
          \`va_verified=\${vaSession}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400\`);
        return newResp;
      }
    }

    // Check for existing verification cookie
    const cookie = request.headers.get("Cookie") || "";
    if (cookie.includes("va_verified=")) {
      return fetch(request); // already verified
    }

    // Initiate verification
    const initResp = await fetch(env.VA_INITIATE_URL, {
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
    return Response.redirect(verifyUrl, 302);
  }
};`;
