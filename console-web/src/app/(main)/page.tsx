import Link from "next/link";

export default function Home() {
  return (
    <div>
      {/* ── Hero ── */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "72px 24px 64px",
        gap: 24,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 600 }}>
          <h1 style={{
            margin: 0,
            fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 800,
            letterSpacing: "-1px",
            lineHeight: 1.1,
            color: "#e7edf7",
          }}>
            Age Verification<br />
            <span style={{ color: "#2667FF" }}>for Your Platform</span>
          </h1>
          <p style={{
            margin: 0,
            fontSize: 18,
            color: "#9FB2D3",
            lineHeight: 1.6,
            maxWidth: 520,
            alignSelf: "center",
          }}>
            Integrate zero-knowledge proof age checks in minutes.
            No personal data stored. Powered by Concordium Mainnet.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/signup" style={{
            background: "#2667FF",
            color: "#fff",
            padding: "12px 28px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 15,
            textDecoration: "none",
            letterSpacing: "-0.2px",
          }}>
            Create free account
          </Link>
          <Link href="/login" style={{
            background: "transparent",
            color: "#9FB2D3",
            padding: "12px 28px",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 15,
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.15)",
            letterSpacing: "-0.2px",
          }}>
            Log in →
          </Link>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "0 0 48px" }} />

      {/* ── Features ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 20,
        padding: "0 0 64px",
      }}>
        {[
          {
            icon: "🔒",
            title: "Privacy-Preserving",
            body: "Users prove they're 18+ using zero-knowledge proofs. No names, dates of birth, or personal data ever leave the wallet.",
          },
          {
            icon: "⚡",
            title: "Simple Integration",
            body: "One API key, one HTTP gateway. Drop in the JavaScript SDK or call the REST API directly from your server.",
          },
          {
            icon: "⛓",
            title: "Concordium Mainnet",
            body: "Backed by Concordium's identity layer — the only blockchain with built-in, regulation-ready identity at the protocol level.",
          },
        ].map(({ icon, title, body }) => (
          <div key={title} style={{
            background: "#1B2735",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            <span style={{ fontSize: 28 }}>{icon}</span>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#e7edf7", letterSpacing: "-0.2px" }}>{title}</div>
            <div style={{ fontSize: 14, color: "#9FB2D3", lineHeight: 1.6 }}>{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
