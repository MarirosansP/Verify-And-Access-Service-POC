import Link from "next/link";

export default function Home() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <h1 style={{ margin: 0 }}>Verify Console</h1>
      <p style={{ opacity: 0.85, margin: 0 }}>
        Manage API keys and usage for your Concordium Verify & Access integration (Mainnet).
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <Link href="/signup">Sign up</Link>
        <Link href="/login">Log in</Link>
        <Link href="/dashboard">Dashboard</Link>
      </div>
      <div style={{ opacity: 0.7, fontSize: 13 }}>
        Gateway base URL (local): <code>http://localhost:3002</code>
      </div>
    </div>
  );
}
