"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Input, Small } from "../../ui";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    // Always show "sent" regardless of whether email exists (prevent enumeration)
    setStatus("sent");
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
      <div style={{ marginBottom: 32 }}>
        <img src="/brand/concordium-logo-blue.svg" alt="Concordium" height="36" style={{ display: "block" }} />
      </div>

      <div style={{
        background: "#1B2735",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "32px 28px",
        width: "100%",
        maxWidth: 400,
        boxSizing: "border-box",
      }}>
        {status === "sent" ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8, letterSpacing: "-0.4px" }}>
              Check your email
            </div>
            <div style={{ fontSize: 14, color: "#9FB2D3", lineHeight: 1.6 }}>
              If an account exists for <strong style={{ color: "#e7edf7" }}>{email}</strong>,
              we've sent a password reset link. It expires in 1 hour.
            </div>
            <div style={{ marginTop: 20, fontSize: 13, color: "#64748b" }}>
              Didn't receive it? Check your spam folder, or{" "}
              <button
                onClick={() => setStatus("idle")}
                style={{ background: "none", border: "none", color: "#2667FF", cursor: "pointer", fontSize: 13, padding: 0, fontFamily: "inherit" }}
              >
                try again
              </button>.
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6, letterSpacing: "-0.4px" }}>
              Forgot your password?
            </div>
            <div style={{ fontSize: 14, color: "#9FB2D3", marginBottom: 24, lineHeight: 1.5 }}>
              Enter your email and we'll send you a reset link.
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
              <Button type="submit" style={{ marginTop: 4, padding: "11px 16px", fontSize: 14 }} disabled={status === "loading"}>
                {status === "loading" ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </>
        )}
      </div>

      <div style={{ marginTop: 18, fontSize: 13, color: "#9FB2D3" }}>
        <Link href="/login" style={{ color: "#2667FF", fontWeight: 600 }}>
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
