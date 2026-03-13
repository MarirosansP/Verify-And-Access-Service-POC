"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface KeyRow { id: string; name?: string; siteName?: string; siteUrl?: string; prefix?: string; status: string; createdAt: string; lastUsedAt?: string }
interface AccountDetail {
  user: { id: string; email: string; name: string | null; isFrozen: boolean; createdAt: string; apiKeys: KeyRow[]; workerKeys: KeyRow[] };
  verificationCount30d: number;
  dailyChart: { date: string; verified: number; failed: number }[];
}

export default function AccountDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [data, setData] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetch(`/api/admin/accounts/${userId}`).then(r => r.json()).catch(() => null);
    setData(d);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function toggleFreeze() {
    if (!data) return;
    setFreezeLoading(true);
    await fetch(`/api/admin/accounts/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frozen: !data.user.isFrozen }),
    });
    await load();
    setFreezeLoading(false);
  }

  async function sendResetEmail() {
    setResetLoading(true);
    await fetch(`/api/admin/accounts/${userId}/send-reset`, { method: "POST" });
    setResetLoading(false);
    setResetSent(true);
    setTimeout(() => setResetSent(false), 4000);
  }

  async function toggleKey(keyId: string, type: "api" | "worker", currentStatus: string) {
    setActionLoading(keyId);
    const newStatus = currentStatus === "active" ? "paused" : "active";
    await fetch(`/api/admin/accounts/${userId}/keys/${keyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, status: newStatus }),
    });
    await load();
    setActionLoading(null);
  }

  if (loading) return <div style={{ color: "#9FB2D3", padding: 40, textAlign: "center" }}>Loading…</div>;
  if (!data) return <div style={{ color: "#f87171", padding: 40, textAlign: "center" }}>Account not found.</div>;

  const { user, verificationCount30d, dailyChart } = data;
  const maxVal = Math.max(...dailyChart.map(d => d.verified + d.failed), 1);

  return (
    <div>
      {/* Back */}
      <button onClick={() => router.push("/admin/accounts")} style={{ ...ghostBtn, marginBottom: 20 }}>← Back to Accounts</button>

      {/* User header */}
      <div style={{ background: "#1B2735", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "24px 28px", marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{user.email}</h1>
            <span style={{
              display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: user.isFrozen ? "rgba(248,113,113,0.15)" : "rgba(74,222,128,0.12)",
              color: user.isFrozen ? "#f87171" : "#4ade80",
            }}>
              {user.isFrozen ? "Frozen" : "Active"}
            </span>
          </div>
          {user.name && <div style={{ color: "#9FB2D3", fontSize: 14, marginBottom: 4 }}>{user.name}</div>}
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Joined {new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            {" · "}{verificationCount30d} verification{verificationCount30d !== 1 ? "s" : ""} in last 30 days
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            disabled={resetLoading || resetSent}
            onClick={sendResetEmail}
            style={{
              padding: "9px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)",
              cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              background: "transparent", color: resetSent ? "#4ade80" : "#9FB2D3",
              opacity: resetLoading ? 0.5 : 1,
            }}
          >
            {resetLoading ? "Sending…" : resetSent ? "✓ Reset email sent" : "Send Password Reset"}
          </button>
          <button
            disabled={freezeLoading}
            onClick={toggleFreeze}
            style={{
              padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              background: user.isFrozen ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
              color: user.isFrozen ? "#4ade80" : "#f87171",
              opacity: freezeLoading ? 0.5 : 1,
            }}
          >
            {freezeLoading ? "…" : user.isFrozen ? "Unfreeze Account" : "Freeze Account"}
          </button>
        </div>
      </div>

      {/* 14-day chart */}
      <div style={{ background: "#1B2735", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 14, color: "#9FB2D3", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Verifications — Last 14 Days
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
          {dailyChart.map(d => {
            const total = d.verified + d.failed;
            const h = Math.round((total / maxVal) * 56);
            return (
              <div key={d.date} title={`${d.date}: ${d.verified} verified, ${d.failed} failed`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ width: "100%", height: h || 2, background: total === 0 ? "rgba(255,255,255,0.05)" : "#2667FF", borderRadius: 2, minHeight: 2 }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 10, color: "#64748b" }}>{dailyChart[0]?.date}</span>
          <span style={{ fontSize: 10, color: "#64748b" }}>{dailyChart[dailyChart.length - 1]?.date}</span>
        </div>
      </div>

      {/* API Keys */}
      <KeysTable
        title="API Keys"
        subtitle="Name / Prefix"
        keys={user.apiKeys}
        type="api"
        actionLoading={actionLoading}
        onToggle={(id, status) => toggleKey(id, "api", status)}
        renderLabel={k => (
          <div>
            <div style={{ fontWeight: 600 }}>{k.name}</div>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", marginTop: 2 }}>{k.prefix}…</div>
          </div>
        )}
      />

      {/* Worker Keys */}
      <KeysTable
        title="Worker Keys"
        subtitle="Site"
        keys={user.workerKeys}
        type="worker"
        actionLoading={actionLoading}
        onToggle={(id, status) => toggleKey(id, "worker", status)}
        renderLabel={k => (
          <div>
            <div style={{ fontWeight: 600 }}>{k.siteName}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{k.siteUrl}</div>
          </div>
        )}
      />
    </div>
  );
}

function KeysTable({ title, keys, type, actionLoading, onToggle, renderLabel }: {
  title: string; subtitle: string;
  keys: KeyRow[]; type: "api" | "worker";
  actionLoading: string | null;
  onToggle: (id: string, status: string) => void;
  renderLabel: (k: KeyRow) => React.ReactNode;
}) {
  return (
    <div style={{ background: "#1B2735", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", fontSize: 13, fontWeight: 700, color: "#e7edf7" }}>
        {title} <span style={{ color: "#64748b", fontWeight: 400, marginLeft: 6 }}>{keys.length}</span>
      </div>
      {keys.length === 0 ? (
        <div style={{ padding: 20, color: "#64748b", fontSize: 13 }}>No {title.toLowerCase()}.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {[title === "API Keys" ? "Name / Prefix" : "Site", "Status", "Created", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9FB2D3", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map(k => (
              <tr key={k.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "#e7edf7" }}>{renderLabel(k)}</td>
                <td style={{ padding: "12px 16px" }}>
                  <StatusBadge status={k.status} />
                </td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: "#64748b" }}>
                  {new Date(k.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {k.status !== "revoked" && (
                    <button
                      disabled={actionLoading === k.id}
                      onClick={() => onToggle(k.id, k.status)}
                      style={{
                        padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                        fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                        background: k.status === "active" ? "rgba(248,113,113,0.12)" : "rgba(74,222,128,0.12)",
                        color: k.status === "active" ? "#f87171" : "#4ade80",
                        opacity: actionLoading === k.id ? 0.5 : 1,
                      }}
                    >
                      {actionLoading === k.id ? "…" : k.status === "active" ? "Pause" : "Activate"}
                    </button>
                  )}
                  {k.status === "revoked" && <span style={{ fontSize: 12, color: "#64748b" }}>Revoked</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    active:  { bg: "rgba(74,222,128,0.12)",   color: "#4ade80" },
    paused:  { bg: "rgba(251,191,36,0.12)",   color: "#fbbf24" },
    revoked: { bg: "rgba(100,116,139,0.15)",  color: "#94a3b8" },
  };
  const s = map[status] || map.revoked;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

const ghostBtn: React.CSSProperties = {
  background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#9FB2D3",
  padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 500,
};
