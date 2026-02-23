/**
 * /verify/:sessionId — Public page (no login required)
 *
 * This is the page that end-users see when a CloudFlare Worker
 * redirects them here. It shows:
 * 1. Site branding (name + URL they came from)
 * 2. The verification challenge description
 * 3. The WalletConnect QR flow (connect → verify → redirect back)
 *
 * CHANGE: Now passes pre-created vpRequest to VerifyClient so the
 *         VPR can be sent to the wallet immediately on connection,
 *         without a separate API call that could race with session expiry.
 */

import { getSession } from "@/lib/worker-sessions";
import VerifyClient from "./VerifyClient";

interface Props {
  params: { sessionId: string };
}

export default async function VerifyPage({ params }: Props) {
  const session = getSession(params.sessionId);

  if (!session) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Session Not Found</h1>
          <p style={styles.text}>
            This verification link is invalid or has expired. Please go back to
            the site and try again.
          </p>
        </div>
      </div>
    );
  }

  if (session.status === "verified") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>✅ Already Verified</h1>
          <p style={styles.text}>
            You have already completed verification for{" "}
            <strong>{session.siteName}</strong>.
          </p>
          <a
            href={`${session.callbackUrl}?va_session=${session.sessionId}&va_status=verified`}
            style={styles.button}
          >
            Return to {session.siteName} →
          </a>
        </div>
      </div>
    );
  }

  if (session.status === "expired" || session.status === "failed") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>
            {session.status === "expired"
              ? "⏰ Session Expired"
              : "❌ Verification Failed"}
          </h1>
          <p style={styles.text}>
            {session.failureReason ||
              "This verification session is no longer valid."}
          </p>
          <p style={styles.text}>
            Please go back to <strong>{session.siteName}</strong> and try again.
          </p>
        </div>
      </div>
    );
  }

  // Status is "pending" → show the verification flow
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.badge}>🔒 Verify &amp; Access</div>
          <h1 style={styles.title}>Identity Verification Required</h1>
          <p style={styles.subtitle}>
            <strong>{session.siteName}</strong> ({session.siteUrl}) requires you
            to prove {challengeLabel(session.challenge)} before granting access.
          </p>
        </div>

        <VerifyClient
          sessionId={session.sessionId}
          challenge={session.challenge}
          siteName={session.siteName}
          siteUrl={session.siteUrl}
          callbackUrl={session.callbackUrl}
          vpRequest={session.vpRequest}  /* ← NEW: pass pre-created VPR */
        />

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Your identity data never leaves your device. Only a zero-knowledge
            proof is shared.
          </p>
          <p style={styles.footerText}>
            Powered by <strong>Concordium</strong> blockchain identity
            verification.
          </p>
        </div>
      </div>
    </div>
  );
}

/* --- helpers --- */
function challengeLabel(c: string): string {
  switch (c) {
    case "age_over_18":
      return "you are 18 or older";
    default:
      return c;
  }
}

/* --- inline styles (no external CSS dependency) --- */
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    padding: "1rem",
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "2.5rem",
    maxWidth: "520px",
    width: "100%",
    boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
  },
  header: { marginBottom: "1.5rem" },
  badge: {
    display: "inline-block",
    background: "#e0f2fe",
    color: "#0369a1",
    borderRadius: "999px",
    padding: "0.25rem 0.75rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    marginBottom: "0.75rem",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 0.5rem",
  },
  subtitle: {
    fontSize: "0.95rem",
    color: "#475569",
    lineHeight: 1.6,
    margin: 0,
  },
  text: {
    fontSize: "0.95rem",
    color: "#475569",
    lineHeight: 1.6,
  },
  button: {
    display: "inline-block",
    background: "#2563eb",
    color: "#fff",
    padding: "0.75rem 1.5rem",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: 600,
    marginTop: "1rem",
  },
  footer: {
    borderTop: "1px solid #e2e8f0",
    marginTop: "1.5rem",
    paddingTop: "1rem",
  },
  footerText: {
    fontSize: "0.8rem",
    color: "#94a3b8",
    margin: "0.25rem 0",
  },
};
