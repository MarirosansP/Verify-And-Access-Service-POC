"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Card, Input, Small } from "../ui";

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
    <div style={{ display: "grid", gap: 14 }}>
      <h1 style={{ margin: 0 }}>Sign up</h1>
      <Card title="Create your account">
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <div>
            <Small>Name (optional)</Small>
            <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <Small>Email</Small>
            <Input value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="you@company.com" type="email" required />
          </div>
          <div>
            <Small>Password (min 8 chars)</Small>
            <Input value={password} onChange={(e: any) => setPassword(e.target.value)} type="password" required />
          </div>
          <Button type="submit">Create account</Button>
          {status && <Small>{status}</Small>}
          <Small>
            Already have an account? <Link href="/login">Log in</Link>
          </Small>
        </form>
      </Card>
    </div>
  );
}
