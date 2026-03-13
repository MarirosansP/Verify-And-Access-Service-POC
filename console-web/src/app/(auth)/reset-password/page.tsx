"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Input, Small } from "../../ui";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) setStatus("error"), setErrorMsg("Missing or invalid reset link. Please request a new one.");
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErrorMsg("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setErrorMsg("Passwords do not match."); return; }

    setStatus("loading");
    setErrorMsg("");

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();

    if (res.ok) {
      setStatus("success");
      setTimeout(() => router.push("/login"), 2500);
    } else {
      setStatus("error");
      setErrorMsg(
        data.error === "invalid_or_expired"
          ? "This reset link has expired or already been used. Please request a new one."
          : data.error || "Something went wrong."
      );
    }
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
        {status === "success" ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8, letterSpacing: "-0.4px" }}>
              Password updated
            </div>
            <div style={{ fontSize: 14, color: "#9FB2D3", lineHeight: 1.6 }}>
              Your password has been changed. Redirecting you to login…
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6, letterSpacing: "-0.4px" }}>
              Set new password
            </div>
            <div style={{ fontSize: 14, color: "#9FB2D3", marginBottom: 24 }}>
              Choose a strong password for your account.
            </div>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gap: 5 }}>
                <Small>New password <span style={{ color: "#64748b" }}>(min 8 characters)</span></Small>
                <Input
                  value={password}
                  onChange={(e: any) => setPassword(e.target.value)}
                  type="password"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div style={{ display: "grid", gap: 5 }}>
                <Small>Confirm new password</Small>
                <Input
                  value={confirm}
                  onChange={(e: any) => setConfirm(e.target.value)}
                  type="password"
                  required
                  autoComplete="new-password"
                />
              </div>
              {errorMsg && (
                <div style={{ fontSize: 13, color: "#f87171", lineHeight: 1.5 }}>{errorMsg}</div>
              )}
              <Button
                type="submit"
                style={{ marginTop: 4, padding: "11px 16px", fontSize: 14 }}
                disabled={status === "loading" || status === "error"}
              >
                {status === "loading" ? "Saving…" : "Set new password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
