export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* ── Nav bar ── */}
      <nav style={{
        background: "#1B2735",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "0 24px",
        height: 60,
        display: "flex",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <img src="/brand/concordium-logo-blue.svg" alt="Concordium" height="26" style={{ display: "block" }} />
      </nav>

      {/* ── Main content ── */}
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 24px 64px" }}>
        {children}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "20px 24px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
      }}>
        <span style={{ fontSize: 12, color: "#9FB2D3" }}>Powered by</span>
        <img src="/brand/id-wordmark-dark.svg" alt="Concordium ID" height="20" style={{ display: "block" }} />
      </footer>
    </>
  );
}
