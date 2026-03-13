"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Input, Small } from "../../ui";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: any) {
    e.preventDefault();
    setStatus("Creating account…");

    const r = await fetch("/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name })
    });

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setStatus(`Signup failed: ${j.error || r.status}`);
      return;
    }

    setStatus("Logging in…");
    const res = await signIn("credentials", { email, password, redirect: true, callbackUrl: "/dashboard" });
    if (res?.error) setStatus(`Login failed: ${res.error}`);
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: "24px",
    }}>
      {/* Branding above card */}
      <div style={{ marginBottom: 32 }}>
        <img src="/brand/concordium-logo-blue.svg" alt="Concordium" height="36" style={{ display: "block" }} />
      </div>

      {/* Card */}
      <div style={{
        background: "#1B2735",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "32px 28px",
        width: "100%",
        maxWidth: 400,
        boxSizing: "border-box",
      }}>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6, letterSpacing: "-0.4px" }}>
          Create your account
        </div>
        <div style={{ fontSize: 14, color: "#9FB2D3", marginBottom: 24 }}>
          Get started with Verify &amp; Access
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 5 }}>
            <Small>Name <span style={{ opacity: 0.6 }}>(optional)</span></Small>
            <Input
              value={name}
              onChange={(e: any) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            <Small>Email address</Small>
            <Input
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              placeholder="you@company.com"
              type="email"
              required
              autoComplete="email"
            />
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            <Small>Password <span style={{ opacity: 0.6 }}>(min 8 characters)</span></Small>
            <Input
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" style={{ marginTop: 4, padding: "11px 16px", fontSize: 14 }}>
            Create account
          </Button>
          {status && (
            <Small>
              <span style={{ color: status.startsWith("Signup failed") || status.startsWith("Login failed") ? "#f87171" : "#9FB2D3" }}>
                {status}
              </span>
            </Small>
          )}
        </form>
      </div>

      <div style={{ marginTop: 18, fontSize: 13, color: "#9FB2D3" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "#2667FF", fontWeight: 600 }}>
          Log in
        </Link>
      </div>
    </div>
  );
}
