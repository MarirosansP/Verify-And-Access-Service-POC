"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function SignOutButton() {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        style={{
          background: "transparent",
          border: "none",
          color: "#9FB2D3",
          cursor: "pointer",
          fontSize: 13,
          fontFamily: "inherit",
          padding: "6px 10px",
          borderRadius: 6,
        }}
      >
        Sign out
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setConfirming(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 999,
        }}
      />

      {/* Dialog */}
      <div style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "#1B2735",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: "28px 32px",
        zIndex: 1000,
        width: 320,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#e7edf7", marginBottom: 8 }}>
          Sign out?
        </div>
        <div style={{ fontSize: 13, color: "#9FB2D3", marginBottom: 24 }}>
          You will be returned to the home page.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={() => setConfirming(false)}
            style={{
              flex: 1,
              padding: "9px 0",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#e7edf7",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            Stay
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            style={{
              flex: 1,
              padding: "9px 0",
              background: "#2667FF",
              border: "none",
              color: "#fff",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            Leave
          </button>
        </div>
      </div>
    </>
  );
}
