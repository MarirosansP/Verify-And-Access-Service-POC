"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Input, Small } from "../../ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: any) {
    e.preventDefault();
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
          Welcome back
        </div>
        <div style={{ fontSize: 14, color: "#9FB2D3", marginBottom: 24 }}>
          Sign in to your console
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
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
            <Small>Password</Small>
            <Input
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" style={{ marginTop: 4, padding: "11px 16px", fontSize: 14 }}>
            Log in
          </Button>
          {status && (
            <Small>
              <span style={{ color: status.startsWith("Login failed") ? "#f87171" : "#9FB2D3" }}>
                {status}
              </span>
            </Small>
          )}
        </form>
      </div>

      <div style={{ marginTop: 18, fontSize: 13, color: "#9FB2D3" }}>
        Don&apos;t have an account?{" "}
        <Link href="/signup" style={{ color: "#28C76F", fontWeight: 600 }}>
          Sign up
        </Link>
      </div>
    </div>
  );
}
