"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button, Card, Input, Small } from "../../ui";

/* ── Types ── */
type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  status: string;
  createdAt: string;
  lastUsedAt?: string | null;
};

type WorkerKeyRow = {
  id: string;
  siteName: string;
  siteUrl: string;
  callbackPath: string;
  status: string;
  createdAt: string;
};

type UsageRow = {
  endpoint: string;
  statusCode: number;
  _count: { _all: number };
};

type AnyKeyStats = {
  quotaUsed: number;
  quotaLimit: number;
  dailyRows: { date: string; count: number }[];
  endpointRows?: { key: string; count: number }[];  // API keys only
  totalCalls: number;
};

/* ── Per-key stats panel ── */
function StatsPanel({ data }: { data: AnyKeyStats | "loading" | undefined }) {
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
                  height: h,
                  background: "#2667FF",
                  opacity: 0.7,
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

      {/* Bottom: total + endpoint breakdown */}
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9FB2D3", textTransform: "uppercase", letterSpacing: "0.6px" }}>
            Total (14d)
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#e7edf7", marginTop: 2 }}>
            {data.totalCalls}
          </div>
        </div>

        {data.endpointRows && data.endpointRows.length > 0 && (
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: "#9FB2D3",
              textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6,
            }}>
              Endpoints
            </div>
            <div style={{ display: "grid", gap: 3 }}>
              {data.endpointRows.slice(0, 6).map((r, i) => {
                // key is like "/v1/verify (200)"
                const match = r.key.match(/\((\d+)\)$/);
                const code = match ? parseInt(match[1]) : 0;
                const codeColor = code < 300 ? "#2667FF" : code < 500 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#9FB2D3", fontFamily: "monospace", fontSize: 11 }}>
                      {r.key.replace(/\s*\(\d+\)$/, "")}
                      {" "}<span style={{ color: codeColor }}>({code})</span>
                    </span>
                    <span style={{ color: "#e7edf7", fontWeight: 600, marginLeft: 12 }}>{r.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Dashboard ── */
export default function Dashboard() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [workerKeys, setWorkerKeys] = useState<WorkerKeyRow[]>([]);
  const [apiKeyOnce, setApiKeyOnce] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("Mainnet Merchant Key");
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [wkMsg, setWkMsg] = useState<string | null>(null);

  // Per-key stats
  const [openStatsId, setOpenStatsId] = useState<string | null>(null);
  const [keyStats, setKeyStats] = useState<Record<string, AnyKeyStats | "loading">>({});

  async function load() {
    const k = await fetch("/api/keys").then(r => r.json());
    setKeys(k.keys || []);
    const u = await fetch("/api/usage?days=14").then(r => r.json());
    setUsage(u.rows || []);
    const wk = await fetch("/api/worker-keys").then(r => r.json());
    setWorkerKeys(wk.keys || []);
  }

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status]);

  async function toggleStats(id: string, apiPath: string) {
    if (openStatsId === id) {
      setOpenStatsId(null);
      return;
    }
    setOpenStatsId(id);
    if (!keyStats[id]) {
      setKeyStats(prev => ({ ...prev, [id]: "loading" }));
      try {
        const data = await fetch(apiPath).then(r => r.json());
        setKeyStats(prev => ({ ...prev, [id]: data }));
      } catch {
        setKeyStats(prev => { const n = { ...prev }; delete n[id]; return n; });
      }
    }
  }

  async function createKey() {
    setMsg("Creating key…");
    setApiKeyOnce(null);
    const r = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(`Create failed: ${j.error || r.status}`); return; }
    setApiKeyOnce(j.apiKey);
    setMsg("Created. Copy the key now — it will not be shown again.");
    await load();
  }

  async function setApiKeyStatus(keyId: string, newStatus: "active" | "paused" | "revoked") {
    setMsg("Updating key…");
    const r = await fetch(`/api/keys/${keyId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setMsg(`Update failed: ${j.error || r.status}`);
      return;
    }
    setMsg("Updated.");
    await load();
  }

  async function setWorkerKeyStatus(keyId: string, newStatus: "active" | "paused" | "revoked") {
    setWkMsg("Updating…");
    const r = await fetch(`/api/worker-keys/${keyId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setWkMsg(`Update failed: ${j.error || r.status}`);
      return;
    }
    setWkMsg("Updated.");
    await load();
  }

  async function deleteWorkerKey(keyId: string) {
    if (!confirm("Permanently delete this worker key?")) return;
    setWkMsg("Deleting…");
    const r = await fetch(`/api/worker-keys/${keyId}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setWkMsg(`Delete failed: ${j.error || r.status}`);
      return;
    }
    setWkMsg("Deleted.");
    await load();
  }

  const usageSummary = useMemo(() => {
    const out: Record<string, number> = {};
    for (const row of usage) {
      const k = `${row.endpoint} (${row.statusCode})`;
      out[k] = (out[k] || 0) + (row._count?._all || 0);
    }
    return out;
  }, [usage]);

  if (status === "loading") return <Small>Loading…</Small>;
  if (status !== "authenticated") {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <Small>Please log in to view your dashboard.</Small>
      </div>
    );
  }

  const statusColor = (s: string) =>
    s === "active" ? "#2667FF" : s === "paused" ? "#f59e0b" : "#f87171";

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

  return (
    <div style={{ display: "grid", gap: 16 }}>

      {/* ── Header ── */}
      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.4px" }}>
          Dashboard
        </h1>
        <Small>Manage your API keys and CloudFlare Worker keys</Small>
      </div>

      {/* ── Gateway URL ── */}
      {process.env.NEXT_PUBLIC_GATEWAY_URL && (
        <Card title="Gateway URL">
          <Small>Use this base URL from merchants / plugins:</Small>
          <div style={{ marginTop: 8 }}>
            <code style={{
              background: "#0D1825", padding: "7px 10px", borderRadius: 8,
              display: "inline-block", border: "1px solid rgba(255,255,255,0.08)", fontSize: 13,
            }}>
              {process.env.NEXT_PUBLIC_GATEWAY_URL}/v1
            </code>
          </div>
        </Card>
      )}

      {/* ── Create API key ── */}
      <Card title="Create API Key">
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <Small>Key name</Small>
            <div style={{ marginTop: 4 }}>
              <Input value={newKeyName} onChange={(e: any) => setNewKeyName(e.target.value)} />
            </div>
          </div>
          <div>
            <Button onClick={createKey}>Create key</Button>
          </div>
          {apiKeyOnce && (
            <div style={{
              background: "#0D1825",
              border: "1px solid rgba(38,103,255,0.25)",
              borderRadius: 10,
              padding: 14,
            }}>
              <Small>Copy this now — shown once only:</Small>
              <div style={{ marginTop: 6 }}>
                <code style={{
                  wordBreak: "break-all", background: "#090E1A", padding: "10px 12px",
                  borderRadius: 8, display: "block",
                  border: "1px solid rgba(38,103,255,0.2)", fontSize: 13, color: "#63A1FF",
                }}>
                  {apiKeyOnce}
                </code>
              </div>
            </div>
          )}
          {msg && <Small>{msg}</Small>}
        </div>
      </Card>

      {/* ── API Keys list ── */}
      <Card title="Your API Keys">
        <div style={{ display: "grid", gap: 8 }}>
          {keys.length === 0 && <Small>No API keys yet. Create one above.</Small>}
          {keys.map(k => (
            <div key={k.id} style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}>
              {/* Key row header */}
              <div style={{
                padding: "12px 14px", background: "#0D1825",
                display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: 10, flexWrap: "wrap",
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{k.name}</div>
                  <div style={{ fontSize: 12, color: "#9FB2D3", marginTop: 3 }}>
                    <code style={{ color: "#9FB2D3" }}>{k.prefix}…</code>
                    {" · "}
                    <span style={{ color: statusColor(k.status) }}>●</span>
                    {" "}
                    <b style={{ color: statusColor(k.status) }}>{k.status}</b>
                    {" · last used: "}
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => toggleStats(k.id, `/api/keys/${k.id}/usage?days=14`)}
                    style={{
                      ...actionBtn(openStatsId === k.id ? "#2667FF" : "#9FB2D3"),
                      ...(openStatsId === k.id ? { borderColor: "rgba(38,103,255,0.4)" } : {}),
                    }}
                  >
                    {openStatsId === k.id ? "▲ Stats" : "▼ Stats"}
                  </button>
                  <button
                    onClick={() => setApiKeyStatus(k.id, "active")}
                    disabled={k.status === "active"}
                    style={actionBtn()}
                  >Activate</button>
                  <button
                    onClick={() => setApiKeyStatus(k.id, "paused")}
                    disabled={k.status === "paused"}
                    style={actionBtn()}
                  >Pause</button>
                  <button
                    onClick={() => setApiKeyStatus(k.id, "revoked")}
                    disabled={k.status === "revoked"}
                    style={actionBtn("#f87171")}
                  >Revoke</button>
                </div>
              </div>
              {/* Expandable stats panel */}
              {openStatsId === k.id && (
                <StatsPanel data={keyStats[k.id]} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ── CloudFlare Worker Keys ── */}
      <Card title="CloudFlare Worker Keys">
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Small>Integrate Verify &amp; Access into any CloudFlare-protected site.</Small>
            <a
              href="/dashboard/worker-keys"
              style={{
                display: "inline-block", padding: "7px 14px",
                background: "#2667FF", color: "#fff", borderRadius: 8,
                textDecoration: "none", fontWeight: 600, fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              + Create Worker Key
            </a>
          </div>

          {wkMsg && <Small>{wkMsg}</Small>}
          {workerKeys.length === 0 && <Small>No worker keys yet.</Small>}

          {workerKeys.map(wk => (
            <div key={wk.id} style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}>
              {/* Worker key row header */}
              <div style={{
                padding: "12px 14px", background: "#0D1825",
                display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: 10, flexWrap: "wrap",
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{wk.siteName}</div>
                  <div style={{ fontSize: 12, color: "#9FB2D3", marginTop: 3 }}>
                    <code style={{ color: "#9FB2D3" }}>{wk.siteUrl}</code>
                    {" · "}
                    <span style={{ color: statusColor(wk.status) }}>●</span>
                    {" "}
                    <b style={{ color: statusColor(wk.status) }}>{wk.status}</b>
                    {" · callback: "}
                    <code style={{ color: "#9FB2D3" }}>{wk.callbackPath}</code>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => toggleStats(wk.id, `/api/worker-keys/${wk.id}/usage?days=14`)}
                    style={{
                      ...actionBtn(openStatsId === wk.id ? "#2667FF" : "#9FB2D3"),
                      ...(openStatsId === wk.id ? { borderColor: "rgba(38,103,255,0.4)" } : {}),
                    }}
                  >
                    {openStatsId === wk.id ? "▲ Stats" : "▼ Stats"}
                  </button>
                  {wk.status !== "active" && wk.status !== "revoked" && (
                    <button onClick={() => setWorkerKeyStatus(wk.id, "active")} style={actionBtn()}>Activate</button>
                  )}
                  {wk.status === "active" && (
                    <button onClick={() => setWorkerKeyStatus(wk.id, "paused")} style={actionBtn()}>Pause</button>
                  )}
                  {wk.status !== "revoked" && (
                    <button onClick={() => setWorkerKeyStatus(wk.id, "revoked")} style={actionBtn("#f87171")}>Revoke</button>
                  )}
                  <button onClick={() => deleteWorkerKey(wk.id)} style={actionBtn("#f87171")}>Delete</button>
                </div>
              </div>
              {/* Expandable stats panel */}
              {openStatsId === wk.id && (
                <StatsPanel data={keyStats[wk.id]} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ── Overall Usage ── */}
      <Card title="Overall Usage — last 14 days">
        {Object.keys(usageSummary).length === 0 ? (
          <Small>No API gateway usage recorded yet.</Small>
        ) : (
          <div style={{ display: "grid", gap: 5 }}>
            {Object.entries(usageSummary).map(([k, v]) => (
              <div key={k} style={{
                display: "flex", justifyContent: "space-between",
                paddingBottom: 5,
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <Small>{k}</Small>
                <b style={{ fontSize: 13, color: "#e7edf7" }}>{v}</b>
              </div>
            ))}
          </div>
        )}
      </Card>

    </div>
  );
}
