"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface VRecord {
  id: string; sessionId: string; challenge: string; siteName: string; siteUrl: string;
  status: "verified" | "failed"; auditRecordId: string | null;
  presentationJson: string | null; failureReason: string | null; createdAt: string;
}

export default function VerificationHistoryPage() {
  const [records, setRecords] = useState<VRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async (q: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (q) params.set("search", q);
    const data = await fetch(`/api/verification-history?${params}`).then(r => r.json()).catch(() => null);
    if (data) { setRecords(data.records); setTotal(data.total); setPages(data.pages); }
    setLoading(false);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); load(search, 1); }, 300);
  }, [search, load]);

  useEffect(() => { load(search, page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  function download(fmt: "csv" | "json") {
    const params = new URLSearchParams({ download: fmt });
    if (search) params.set("search", search);
    window.location.href = `/api/verification-history?${params}`;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: "#e7edf7" }}>Verification History</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9FB2D3" }}>
            {total} record{total !== 1 ? "s" : ""} · Zero-knowledge proof verifications for your sites
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => download("csv")} style={outlineBtn}>↓ Export CSV</button>
          <button onClick={() => download("json")} style={outlineBtn}>↓ Export JSON</button>
        </div>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by site name, URL, or audit ID…"
        style={inputStyle}
      />

      <div style={{ background: "#1B2735", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Date", "Site", "Challenge", "Status", "Audit ID", ""].map(h => (
                <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9FB2D3", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9FB2D3", fontSize: 13 }}>Loading…</td></tr>
            )}
            {!loading && records.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9FB2D3", fontSize: 13 }}>
                No verification records yet. Records appear here after users complete QR verification.
              </td></tr>
            )}
            {!loading && records.map(r => [
              <tr
                key={r.id}
                style={{ borderBottom: expanded === r.id ? "none" : "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
              >
                <td style={tdStyle}>
                  <div style={{ fontSize: 12 }}>{new Date(r.createdAt).toLocaleDateString()}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{new Date(r.createdAt).toLocaleTimeString()}</div>
                </td>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 500 }}>{r.siteName}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{r.siteUrl}</div>
                </td>
                <td style={{ ...tdStyle, fontSize: 12, color: "#9FB2D3" }}>{r.challenge === "age_over_18" ? "Age 18+" : r.challenge}</td>
                <td style={tdStyle}>
                  <span style={{
                    display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: r.status === "verified" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                    color: r.status === "verified" ? "#4ade80" : "#f87171",
                  }}>
                    {r.status === "verified" ? "✓ Verified" : "✗ Failed"}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>
                  {r.auditRecordId ? r.auditRecordId.slice(0, 12) + "…" : "—"}
                </td>
                <td style={{ ...tdStyle, color: "#9FB2D3", fontSize: 11 }}>
                  {r.presentationJson ? (expanded === r.id ? "▲ Hide" : "▼ Proof") : ""}
                </td>
              </tr>,
              expanded === r.id && (
                <tr key={`${r.id}-exp`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td colSpan={6} style={{ padding: "0 16px 16px" }}>
                    <div style={{ fontSize: 11, color: "#9FB2D3", marginBottom: 6, fontWeight: 600 }}>
                      Full Audit ID: <span style={{ fontFamily: "monospace", color: "#e7edf7", fontWeight: 400 }}>{r.auditRecordId || "—"}</span>
                    </div>
                    {r.failureReason && (
                      <div style={{ fontSize: 12, color: "#f87171", marginBottom: 8 }}>Reason: {r.failureReason}</div>
                    )}
                    {r.presentationJson && (
                      <>
                        <div style={{ fontSize: 11, color: "#9FB2D3", marginBottom: 6, fontWeight: 600 }}>Verifiable Presentation (ZK Proof)</div>
                        <pre style={{
                          background: "#0D1825", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8,
                          padding: 14, fontSize: 10, color: "#a5f3fc", overflowX: "auto", maxHeight: 300,
                          overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0,
                        }}>
                          {JSON.stringify(JSON.parse(r.presentationJson), null, 2)}
                        </pre>
                      </>
                    )}
                  </td>
                </tr>
              )
            ])}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={outlineBtn}>← Prev</button>
          <span style={{ padding: "8px 14px", fontSize: 13, color: "#9FB2D3" }}>Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={outlineBtn}>Next →</button>
        </div>
      )}
    </div>
  );
}

const tdStyle: React.CSSProperties = { padding: "13px 16px", fontSize: 13, color: "#e7edf7", verticalAlign: "middle" };
const outlineBtn: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent", color: "#9FB2D3", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 500,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)",
  background: "#0D1825", color: "#e7edf7", fontSize: 14, fontFamily: "inherit",
  boxSizing: "border-box", outline: "none", marginBottom: 16,
};
