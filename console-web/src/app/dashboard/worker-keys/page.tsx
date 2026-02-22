"use client";

/**
 * /dashboard/worker-keys  — Manage CloudFlare Worker Keys
 *
 * Authenticated page (same auth as the existing dashboard).
 * Lets users create, pause, revoke, and delete worker keys.
 * Includes a snippet showing how to call the API from a CF worker.
 */

import React, { useState, useEffect, useCallback } from "react";

interface WorkerKeyRow {
  id: string;
  siteName: string;
  siteUrl: string;
  callbackPath: string;
  status: "active" | "paused" | "revoked";
  createdAt: string;
  updatedAt?: string;
}

export default function WorkerKeysPage() {
  const [keys, setKeys]             = useState<WorkerKeyRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [newKeyVisible, setNewKey]  = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Form state
  const [siteName, setSiteName]       = useState("");
  const [siteUrl, setSiteUrl]         = useState("");
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

  /* ---- Create key ---- */
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
      setCreatedKey(data.key); // show once
      setSiteName("");
      setSiteUrl("");
      setCallbackPath("/");
      fetchKeys();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  /* ---- Update status ---- */
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

  /* ---- Delete ---- */
  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this worker key?")) return;
    try {
      await fetch(`/api/worker-keys/${id}`, { method: "DELETE" });
      fetchKeys();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.h1}>CloudFlare Worker Keys</h1>
        <p style={styles.subtitle}>
          Create keys to integrate Verify &amp; Access into any Cloudflare-protected site.
          Each key is bound to one site URL.
        </p>
      </div>

      {/* --- Create form --- */}
      <div style={styles.card}>
        <div style={styles.cardHeader} onClick={() => setNewKey(!newKeyVisible)}>
          <h2 style={styles.h2}>{newKeyVisible ? "▾" : "▸"} Create New Worker Key</h2>
        </div>
        {newKeyVisible && (
          <form onSubmit={handleCreate} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Site Name</label>
              <input
                style={styles.input}
                placeholder="My Awesome Blog"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Site URL</label>
              <input
                style={styles.input}
                placeholder="https://mysite.com"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                required
                type="url"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Callback Path (optional)</label>
              <input
                style={styles.input}
                placeholder="/"
                value={callbackPath}
                onChange={(e) => setCallbackPath(e.target.value)}
              />
              <span style={styles.hint}>Where verified users are redirected to on your site</span>
            </div>
            <button type="submit" style={styles.createBtn}>Create Worker Key</button>
          </form>
        )}

        {/* Show once banner */}
        {createdKey && (
          <div style={styles.showOnce}>
            <strong>⚠️ Copy this key now — it will not be shown again:</strong>
            <pre style={styles.keyPre}>{createdKey}</pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdKey);
                alert("Copied to clipboard!");
              }}
              style={styles.copyBtn}
            >
              Copy to Clipboard
            </button>
          </div>
        )}
      </div>

      {/* --- Keys table --- */}
      <div style={styles.card}>
        <h2 style={styles.h2}>Your Worker Keys</h2>
        {loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : keys.length === 0 ? (
          <p style={styles.muted}>No worker keys yet. Create one above.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Site</th>
                <th style={styles.th}>URL</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td style={styles.td}>{k.siteName}</td>
                  <td style={styles.td}>
                    <code style={styles.code}>{k.siteUrl}</code>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      background:
                        k.status === "active" ? "#dcfce7" :
                        k.status === "paused" ? "#fef9c3" : "#fee2e2",
                      color:
                        k.status === "active" ? "#166534" :
                        k.status === "paused" ? "#854d0e" : "#991b1b",
                    }}>
                      {k.status}
                    </span>
                  </td>
                  <td style={styles.td}>{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      {k.status === "active" && (
                        <button style={styles.actionBtn}
                          onClick={() => updateStatus(k.id, "paused")}>Pause</button>
                      )}
                      {k.status === "paused" && (
                        <button style={styles.actionBtn}
                          onClick={() => updateStatus(k.id, "active")}>Activate</button>
                      )}
                      {k.status !== "revoked" && (
                        <button style={{ ...styles.actionBtn, color: "#dc2626" }}
                          onClick={() => updateStatus(k.id, "revoked")}>Revoke</button>
                      )}
                      <button style={{ ...styles.actionBtn, color: "#991b1b" }}
                        onClick={() => handleDelete(k.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- Integration snippet --- */}
      <div style={styles.card}>
        <h2 style={styles.h2}>Integration Guide</h2>
        <p style={styles.text}>Use this snippet in your CloudFlare Worker to integrate Verify &amp; Access:</p>
        <pre style={styles.snippet}>{integrationSnippet}</pre>
      </div>
    </div>
  );
}

/* ---- Integration snippet ---- */
const integrationSnippet = `// CloudFlare Worker — Verify & Access Integration
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Check for returning verified user
    const vaSession = url.searchParams.get("va_session");
    const vaStatus  = url.searchParams.get("va_status");

    if (vaSession && vaStatus === "verified") {
      // Confirm with the Verify & Access service
      const check = await fetch(
        env.VA_STATUS_URL + "/" + vaSession,
        { headers: { "X-Worker-Key": env.VA_WORKER_KEY } }
      );
      const result = await check.json();

      if (result.status === "verified" && result.result === true) {
        // Set a cookie so user doesn't have to verify again
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

/* ---- Styles ---- */
const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: "900px", margin: "0 auto", padding: "2rem 1rem" },
  header: { marginBottom: "2rem" },
  h1: { fontSize: "1.75rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem" },
  h2: { fontSize: "1.15rem", fontWeight: 600, color: "#1e293b", margin: "0 0 1rem" },
  subtitle: { color: "#64748b", fontSize: "0.95rem", margin: 0 },
  card: {
    background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0",
    padding: "1.5rem", marginBottom: "1.5rem",
  },
  cardHeader: { cursor: "pointer" },
  form: { display: "flex", flexDirection: "column" as const, gap: "1rem" },
  field: { display: "flex", flexDirection: "column" as const, gap: "0.25rem" },
  label: { fontSize: "0.85rem", fontWeight: 600, color: "#334155" },
  input: {
    padding: "0.6rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1",
    fontSize: "0.9rem", outline: "none",
  },
  hint: { fontSize: "0.75rem", color: "#94a3b8" },
  createBtn: {
    padding: "0.7rem 1.5rem", background: "#2563eb", color: "#fff",
    border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer",
    alignSelf: "flex-start" as const,
  },
  showOnce: {
    background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px",
    padding: "1rem", marginTop: "1rem",
  },
  keyPre: {
    background: "#1e293b", color: "#a5f3fc", padding: "0.75rem", borderRadius: "6px",
    overflowX: "auto" as const, fontSize: "0.8rem", margin: "0.5rem 0",
  },
  copyBtn: {
    padding: "0.4rem 0.8rem", background: "#0284c7", color: "#fff",
    border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem",
  },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: {
    textAlign: "left" as const, padding: "0.6rem", borderBottom: "2px solid #e2e8f0",
    fontSize: "0.8rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" as const,
  },
  td: { padding: "0.6rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.9rem" },
  code: { fontSize: "0.8rem", color: "#475569" },
  statusBadge: {
    display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: "999px",
    fontSize: "0.75rem", fontWeight: 600,
  },
  actions: { display: "flex", gap: "0.5rem" },
  actionBtn: {
    padding: "0.3rem 0.6rem", background: "transparent", border: "1px solid #cbd5e1",
    borderRadius: "4px", fontSize: "0.75rem", cursor: "pointer", color: "#334155",
  },
  text: { fontSize: "0.9rem", color: "#475569", marginBottom: "1rem" },
  snippet: {
    background: "#1e293b", color: "#a5f3fc", padding: "1rem", borderRadius: "8px",
    overflowX: "auto" as const, fontSize: "0.75rem", lineHeight: 1.6,
  },
  muted: { color: "#94a3b8", fontSize: "0.9rem" },
};
