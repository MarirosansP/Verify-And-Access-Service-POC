"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Button, Card, Input, Small } from "../ui";

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  status: string;
  createdAt: string;
  lastUsedAt?: string | null;
};

type UsageRow = {
  endpoint: string;
  statusCode: number;
  _count: { _all: number };
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [apiKeyOnce, setApiKeyOnce] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("Mainnet Merchant Key");
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const k = await fetch("/api/keys").then(r => r.json());
    setKeys(k.keys || []);
    const u = await fetch("/api/usage?days=14").then(r => r.json());
    setUsage(u.rows || []);
  }

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status]);

  async function createKey() {
    setMsg("Creating key…");
    setApiKeyOnce(null);
    const r = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newKeyName })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(`Create failed: ${j.error || r.status}`);
      return;
    }
    setApiKeyOnce(j.apiKey);
    setMsg("Created. Copy the key now — it will not be shown again.");
    await load();
  }

  async function setStatus(keyId: string, status: "active" | "paused" | "revoked") {
    setMsg(`Updating key…`);
    const r = await fetch(`/api/keys/${keyId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setMsg(`Update failed: ${j.error || r.status}`);
      return;
    }
    setMsg("Updated.");
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

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <button onClick={() => signOut({ callbackUrl: "/" })} style={{ background: "transparent", color: "#9fb2d3", border: "none", cursor: "pointer" }}>
          Sign out
        </button>
      </div>

      <Card title="Gateway URL">
        <Small>Use this base URL from merchants / plugins:</Small>
        <div style={{ marginTop: 8 }}>
          <code style={{ background: "#0b0f17", padding: "6px 8px", borderRadius: 10, display: "inline-block", border: "1px solid rgba(255,255,255,0.08)" }}>
            http://localhost:3002/v1
          </code>
        </div>
      </Card>

      <Card title="Create API key">
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <Small>Key name</Small>
            <Input value={newKeyName} onChange={(e: any) => setNewKeyName(e.target.value)} />
          </div>
          <Button onClick={createKey}>Create key</Button>
          {apiKeyOnce && (
            <div>
              <Small>Copy this now (shown once):</Small>
              <div style={{ marginTop: 6 }}>
                <code style={{ wordBreak: "break-all", background: "#0b0f17", padding: "10px 12px", borderRadius: 10, display: "block", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {apiKeyOnce}
                </code>
              </div>
            </div>
          )}
          {msg && <Small>{msg}</Small>}
        </div>
      </Card>

      <Card title="Your API keys">
        <div style={{ display: "grid", gap: 10 }}>
          {keys.length === 0 && <Small>No keys yet.</Small>}
          {keys.map(k => (
            <div key={k.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12, background: "#0b0f17" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{k.name}</div>
                  <Small>Prefix: <code>{k.prefix}</code> • Status: <b>{k.status}</b></Small>
                  <Small>Last used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}</Small>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setStatus(k.id, "active")} disabled={k.status === "active"}>Activate</button>
                  <button onClick={() => setStatus(k.id, "paused")} disabled={k.status === "paused"}>Pause</button>
                  <button onClick={() => setStatus(k.id, "revoked")} disabled={k.status === "revoked"}>Revoke</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Usage (last 14 days)">
        {Object.keys(usageSummary).length === 0 ? (
          <Small>No usage recorded yet.</Small>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {Object.entries(usageSummary).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                <Small>{k}</Small>
                <Small><b>{v}</b></Small>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
