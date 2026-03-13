import Link from "next/link";

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
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <Link href="/dashboard" style={{ display: "block", lineHeight: 0 }}>
          <img src="/brand/concordium-logo-blue.svg" alt="Concordium" height="26" style={{ display: "block" }} />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/dashboard/worker-keys">Worker Keys</NavLink>
          <NavLink href="/dashboard/verification-history">Verification History</NavLink>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />
          <Link href="/api/auth/signout" style={{ fontSize: 13, color: "#9FB2D3", textDecoration: "none", padding: "6px 10px", borderRadius: 6 }}>
            Sign out
          </Link>
        </div>
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

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ fontSize: 13, color: "#9FB2D3", textDecoration: "none", padding: "6px 12px", borderRadius: 6, fontWeight: 500 }}>
      {children}
    </Link>
  );
}
