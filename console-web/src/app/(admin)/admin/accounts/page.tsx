"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface AccountRow {
  id: string;
  email: string;
  name: string | null;
  isFrozen: boolean;
  createdAt: string;
  _count: { apiKeys: number; workerKeys: number };
}

function AccountsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AccountRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async (q: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (q) params.set("search", q);
    const data = await fetch(`/api/admin/accounts?${params}`).then(r => r.json()).catch(() => null);
    if (data) {
      setUsers(data.users);
      setTotal(data.total);
      setPages(data.pages);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(search, 1);
    }, 300);
  }, [search, load]);

  useEffect(() => {
    load(search, page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleFreeze(userId: string, freeze: boolean) {
    setActionLoading(userId);
    await fetch(`/api/admin/accounts/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frozen: freeze }),
    });
    await load(search, page);
    setActionLoading(null);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px" }}>Accounts</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9FB2D3" }}>{total} account{total !== 1 ? "s" : ""} total</p>
        </div>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by email or name…"
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "#0D1825",
          color: "#e7edf7",
          fontSize: 14,
          fontFamily: "inherit",
          boxSizing: "border-box",
          outline: "none",
          marginBottom: 16,
        }}
      />

      {/* Table */}
      <div style={{ background: "#1B2735", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Email", "Name", "Keys", "Status", "Joined", "Actions"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9FB2D3", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9FB2D3", fontSize: 13 }}>Loading…</td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9FB2D3", fontSize: 13 }}>No accounts found.</td></tr>
            )}
            {!loading && users.map(u => (
              <tr
                key={u.id}
                onClick={() => router.push(`/admin/accounts/${u.id}`)}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
              >
                <td style={tdStyle}>{u.email}</td>
                <td style={{ ...tdStyle, color: "#9FB2D3" }}>{u.name || "—"}</td>
                <td style={{ ...tdStyle, color: "#9FB2D3" }}>{u._count.apiKeys + u._count.workerKeys}</td>
                <td style={tdStyle}>
                  <span style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    background: u.isFrozen ? "rgba(248,113,113,0.15)" : "rgba(74,222,128,0.12)",
                    color: u.isFrozen ? "#f87171" : "#4ade80",
                  }}>
                    {u.isFrozen ? "Frozen" : "Active"}
                  </span>
                </td>
                <td style={{ ...tdStyle, color: "#9FB2D3", fontSize: 12 }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td style={tdStyle} onClick={e => e.stopPropagation()}>
                  <button
                    disabled={actionLoading === u.id}
                    onClick={() => toggleFreeze(u.id, !u.isFrozen)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      background: u.isFrozen ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
                      color: u.isFrozen ? "#4ade80" : "#f87171",
                      opacity: actionLoading === u.id ? 0.5 : 1,
                    }}
                  >
                    {actionLoading === u.id ? "…" : u.isFrozen ? "Unfreeze" : "Freeze"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle}>← Prev</button>
          <span style={{ padding: "8px 14px", fontSize: 13, color: "#9FB2D3" }}>Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={pageBtnStyle}>Next →</button>
        </div>
      )}
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense>
      <AccountsContent />
    </Suspense>
  );
}

const tdStyle: React.CSSProperties = { padding: "13px 16px", fontSize: 13, color: "#e7edf7", verticalAlign: "middle" };
const pageBtnStyle: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent", color: "#9FB2D3", cursor: "pointer", fontSize: 13, fontFamily: "inherit",
};
