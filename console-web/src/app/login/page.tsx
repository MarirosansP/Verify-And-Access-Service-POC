"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Card, Input, Small } from "../ui";

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
    <div style={{ display: "grid", gap: 14 }}>
      <h1 style={{ margin: 0 }}>Log in</h1>
      <Card title="Access your console">
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <div>
            <Small>Email</Small>
            <Input value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="you@company.com" type="email" required />
          </div>
          <div>
            <Small>Password</Small>
            <Input value={password} onChange={(e: any) => setPassword(e.target.value)} type="password" required />
          </div>
          <Button type="submit">Log in</Button>
          {status && <Small>{status}</Small>}
          <Small>
            Need an account? <Link href="/signup">Sign up</Link>
          </Small>
        </form>
      </Card>
    </div>
  );
}
