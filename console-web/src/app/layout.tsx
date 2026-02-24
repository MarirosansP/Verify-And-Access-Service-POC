import Providers from "./providers";

export const metadata = {
  title: "Concordium Verify & Access",
  description: "Blockchain-based age verification using Concordium identity credentials",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        fontFamily: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial",
        margin: 0,
        background: "#090E1A",
        color: "#e7edf7",
      }}>
        <Providers>
          {/* ── Nav bar ── */}
          <nav style={{
            background: "#1B2735",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            padding: "0 24px",
            height: 60,
            display: "flex",
            alignItems: "center",
            gap: 12,
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}>
            {/* Concordium C-symbol */}
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="15" cy="15" r="15" fill="#28C76F" />
              <path d="M21 10A8 8 0 1 0 21 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.2px" }}>
              Verify &amp; Access
            </span>
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "1px",
              background: "rgba(40,199,111,0.12)",
              color: "#28C76F",
              border: "1px solid rgba(40,199,111,0.3)",
              padding: "2px 8px",
              borderRadius: 4,
            }}>
              MAINNET
            </span>
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
        </Providers>
      </body>
    </html>
  );
}
