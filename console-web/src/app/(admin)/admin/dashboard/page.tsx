"use client";

import { useEffect, useState, useCallback } from "react";

/* ── Types ── */
interface ServiceStatus { status: "ok" | "error" | "loading"; latencyMs?: number; detail?: string }
interface StatusData { db: ServiceStatus; gateway: ServiceStatus; verifier: ServiceStatus }
interface StatsData {
  totalUsers: number; totalApiKeys: number; totalWorkerKeys: number;
  activeApiKeys: number; activeWorkerKeys: number;
  verificationsToday: number; verifications30d: number;
  verifiedToday: number; verified30d: number;
}

const loading: ServiceStatus = { status: "loading" };

export default function AdminDashboard() {
  const [status, setStatus] = useState<StatusData>({ db: loading, gateway: loading, verifier: loading });
  const [stats, setStats] = useState<StatsData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const [s, st] = await Promise.all([
      fetch("/api/admin/status").then(r => r.json()).catch(() => null),
      fetch("/api/admin/stats").then(r => r.json()).catch(() => null),
    ]);
    if (s) setStatus(s);
    if (st) setStats(st);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px" }}>Admin Dashboard</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9FB2D3" }}>
            {lastRefresh ? `Last updated ${lastRefresh.toLocaleTimeString()}` : "Loading…"}
            {" · auto-refreshes every 30s"}
          </p>
        </div>
        <button onClick={refresh} style={btnStyle}>↻ Refresh</button>
      </div>

      {/* ── Server Status ── */}
      <Section title="Server Status">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <StatusCard label="Database (SQLite)" svc={status.db} />
          <StatusCard label="Verify Gateway" svc={status.gateway} />
          <StatusCard label="Credential Verifier" svc={status.verifier} />
        </div>
      </Section>

      {/* ── Platform Stats ── */}
      <Section title="Platform Statistics">
        {stats ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
            <StatCard label="Total Accounts" value={stats.totalUsers} />
            <StatCard label="Active API Keys" value={stats.activeApiKeys} sub={`of ${stats.totalApiKeys} total`} />
            <StatCard label="Active Worker Keys" value={stats.activeWorkerKeys} sub={`of ${stats.totalWorkerKeys} total`} />
            <StatCard label="Verifications Today" value={stats.verificationsToday} sub={`${stats.verifiedToday} passed`} accent />
            <StatCard label="Verifications (30d)" value={stats.verifications30d} sub={`${stats.verified30d} passed`} accent />
          </div>
        ) : (
          <div style={{ color: "#9FB2D3", fontSize: 13 }}>Loading…</div>
        )}
      </Section>
    </div>
  );
}

/* ── Sub-components ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9FB2D3", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function StatusCard({ label, svc }: { label: string; svc: ServiceStatus }) {
  const isOk = svc.status === "ok";
  const isLoading = svc.status === "loading";
  const color = isLoading ? "#9FB2D3" : isOk ? "#4ade80" : "#f87171";
  const dot = isLoading ? "⬤" : isOk ? "●" : "●";

  return (
    <div style={{ background: "#1B2735", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color, fontSize: 10 }}>{dot}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e7edf7" }}>{label}</span>
      </div>
      <div style={{ fontSize: 12, color: "#9FB2D3" }}>
        {isLoading && "Checking…"}
        {!isLoading && isOk && `OK · ${svc.latencyMs}ms`}
        {!isLoading && !isOk && (svc.detail || "Unreachable")}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: boolean }) {
  return (
    <div style={{ background: "#1B2735", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent ? "#2667FF" : "#e7edf7", letterSpacing: "-1px" }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 13, color: "#9FB2D3", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#9FB2D3",
  padding: "8px 14px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "inherit",
  fontWeight: 500,
};
