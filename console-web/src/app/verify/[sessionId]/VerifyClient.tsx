"use client";

/**
 * VerifyClient — handles the full WalletConnect ↔ Concordium ID flow
 *
 * Steps:
 *   1. Create a VP request (via our API proxy to the gateway)
 *   2. Show a QR code so the user can connect their Concordium ID app
 *   3. Once connected, send the VP request to the wallet
 *   4. Receive the VP back
 *   5. Submit the VP to our API for validation
 *   6. On success → redirect back to the originating site
 *
 * This mirrors the adult-joke-site flow but is self-contained in
 * the console-web verify page.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  sessionId: string;
  challenge: string;
  siteName: string;
  siteUrl: string;
  callbackUrl: string;
}

type FlowState =
  | "idle"
  | "creating-request"
  | "show-qr"
  | "connecting"
  | "requesting-vp"
  | "verifying"
  | "success"
  | "failed";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function VerifyClient({
  sessionId,
  challenge,
  siteName,
  siteUrl,
  callbackUrl,
}: Props) {
  const [state, setState]             = useState<FlowState>("idle");
  const [statusMsg, setStatusMsg]     = useState("Click below to start verification.");
  const [qrUri, setQrUri]            = useState<string | null>(null);
  const [error, setError]            = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const signClientRef                 = useRef<any>(null);
  const sessionTopicRef               = useRef<string | null>(null);

  /* ---- Cleanup on unmount ---- */
  useEffect(() => {
    return () => {
      if (signClientRef.current && sessionTopicRef.current) {
        try {
          signClientRef.current.disconnect({
            topic: sessionTopicRef.current,
            reason: { code: 6000, message: "Component unmounted" },
          });
        } catch {}
      }
    };
  }, []);

  /* ---- Start the flow ---- */
  const startVerification = useCallback(async () => {
    setState("creating-request");
    setStatusMsg("Creating verification request…");
    setError(null);

    try {
      /* Step 1 — create the VP request via our server-side proxy */
      const vpResp = await fetch(`/api/worker/create-vp-request/${sessionId}`, {
        method: "POST",
      });

      if (!vpResp.ok) {
        const err = await vpResp.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || err.detail || "Failed to create VP request");
      }

      const vpData = await vpResp.json();
      console.log("[VerifyClient] VP request created:", vpData);

      /* Step 2 — initialise WalletConnect */
      setState("show-qr");
      setStatusMsg("Scan the QR code with your Concordium ID app…");

      // Dynamic import so we don't SSR WalletConnect
      const { default: SignClient } = await import("@walletconnect/sign-client");

      const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "76324905a70fe5c388bab46d3e0564dc";

      const client = await SignClient.init({
        projectId,
        metadata: {
          name: "Verify & Access",
          description: `Age verification for ${siteName}`,
          url: window.location.origin,
          icons: [],
        },
      });
      signClientRef.current = client;

      /* Step 3 — create a WalletConnect session */
      const { uri, approval } = await client.connect({
        requiredNamespaces: {
          ccd: {
            methods: [
              "request_verifiable_presentation",
            ],
            chains: ["ccd:mainnet"],
            events: ["concordium-event"],
          },
        },
      });

      if (uri) {
        setQrUri(uri);
      }

      setState("connecting");
      setStatusMsg("Waiting for wallet to connect…");

      const wcSession = await approval();
      sessionTopicRef.current = wcSession.topic;
      console.log("[VerifyClient] WalletConnect session established:", wcSession.topic);

      /* Step 4 — request the VP from the wallet */
      setState("requesting-vp");
      setStatusMsg("Requesting proof from your wallet… Please approve in the app.");

      // Build the WalletConnect request
      const vpRequest = {
        topic: wcSession.topic,
        chainId: "ccd:mainnet",
        request: {
          method: "request_verifiable_presentation",
          params: {
            challenge: vpData.challenge || vpData.challengeUrl || vpData.url,
            credentialStatements: vpData.credentialStatements || vpData.statements,
          },
        },
      };

      const vpResponse = await client.request(vpRequest);
      console.log("[VerifyClient] VP received from wallet:", vpResponse);

      // The response may be wrapped in various ways depending on the
      // wallet version.  Unwrap to get the actual VP.
      const vp =
        vpResponse?.verifiablePresentationJson
          ? JSON.parse(vpResponse.verifiablePresentationJson)
          : vpResponse?.verifiablePresentation || vpResponse;

      /* Step 5 — submit the VP to our server for validation */
      setState("verifying");
      setStatusMsg("Verifying your proof…");

      const verifyResp = await fetch(`/api/worker/submit-vp/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifiablePresentation: vp }),
      });

      const verifyData = await verifyResp.json();

      if (verifyData.verified) {
        setState("success");
        setStatusMsg("✅ Verification successful! Redirecting…");

        // Build redirect URL with session token
        const sep = callbackUrl.includes("?") ? "&" : "?";
        const redirect = `${callbackUrl}${sep}va_session=${sessionId}&va_status=verified`;
        setRedirectUrl(redirect);

        // Auto-redirect after a short delay
        setTimeout(() => {
          window.location.href = redirect;
        }, 2000);
      } else {
        setState("failed");
        setError(verifyData.reason || "Verification failed");
        setStatusMsg("❌ Verification failed.");
      }

      /* Disconnect WalletConnect session */
      try {
        await client.disconnect({
          topic: wcSession.topic,
          reason: { code: 6000, message: "Verification complete" },
        });
      } catch {}

    } catch (err: any) {
      console.error("[VerifyClient] Error:", err);
      setState("failed");
      setError(err.message || "An unexpected error occurred");
      setStatusMsg("❌ Something went wrong.");
    }
  }, [sessionId, challenge, siteName, callbackUrl]);

  /* ---- Render ---- */
  return (
    <div style={styles.wrapper}>
      {/* Status message */}
      <div style={styles.statusBar}>
        {state === "creating-request" || state === "connecting" || state === "requesting-vp" || state === "verifying"
          ? <Spinner />
          : null}
        <span style={styles.statusText}>{statusMsg}</span>
      </div>

      {/* QR code */}
      {qrUri && state !== "success" && state !== "failed" && (
        <div style={styles.qrSection}>
          <div style={styles.qrBox}>
            <QRCode value={qrUri} />
          </div>
          <p style={styles.qrHint}>
            Open your <strong>Concordium ID</strong> app and scan this code.
          </p>
          <p style={styles.qrSubHint}>
            Don't have the app?{" "}
            <a href="https://concordium.com/identity" target="_blank" rel="noopener noreferrer" style={styles.link}>
              Download it here
            </a>
          </p>
        </div>
      )}

      {/* Start button */}
      {state === "idle" && (
        <button onClick={startVerification} style={styles.startBtn}>
          Start Private Verification →
        </button>
      )}

      {/* Error display */}
      {error && (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {error}
          <br />
          <button onClick={startVerification} style={styles.retryBtn}>
            Try Again
          </button>
        </div>
      )}

      {/* Success with manual link */}
      {state === "success" && redirectUrl && (
        <div style={styles.successBox}>
          <p>Redirecting to <strong>{siteName}</strong>…</p>
          <a href={redirectUrl} style={styles.link}>
            Click here if not redirected automatically
          </a>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  QR Code component (inline SVG — no external dependency)            */
/* ------------------------------------------------------------------ */

function QRCode({ value }: { value: string }) {
  const [svgHtml, setSvgHtml] = useState<string>("");

  useEffect(() => {
    // Use a CDN-loaded QR library for the POC
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js";
    script.onload = () => {
      try {
        // @ts-ignore
        const qr = qrcode(0, "M");
        qr.addData(value);
        qr.make();
        setSvgHtml(qr.createSvgTag({ cellSize: 4, margin: 4 }));
      } catch (e) {
        console.error("QR generation failed:", e);
        // Fallback: show a link
        setSvgHtml(`<p style="word-break:break-all;font-size:0.7rem;">${value}</p>`);
      }
    };
    document.body.appendChild(script);
    return () => { try { document.body.removeChild(script); } catch {} };
  }, [value]);

  if (!svgHtml) return <div style={{ padding: "2rem", color: "#94a3b8" }}>Generating QR code…</div>;

  return <div dangerouslySetInnerHTML={{ __html: svgHtml }} />;
}

/* ------------------------------------------------------------------ */
/*  Spinner                                                            */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <span style={styles.spinner}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
          <animateTransform attributeName="transform" type="rotate"
            values="0 12 12;360 12 12" dur="1s" repeatCount="indefinite"/>
        </path>
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    marginTop: "1.5rem",
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    background: "#f8fafc",
    borderRadius: "8px",
    marginBottom: "1rem",
  },
  statusText: {
    fontSize: "0.9rem",
    color: "#334155",
  },
  spinner: {
    display: "inline-flex",
    color: "#2563eb",
    animation: "spin 1s linear infinite",
  },
  qrSection: {
    textAlign: "center" as const,
    margin: "1.5rem 0",
  },
  qrBox: {
    display: "inline-block",
    background: "#fff",
    border: "2px solid #e2e8f0",
    borderRadius: "12px",
    padding: "1rem",
  },
  qrHint: {
    fontSize: "0.9rem",
    color: "#475569",
    marginTop: "0.75rem",
  },
  qrSubHint: {
    fontSize: "0.8rem",
    color: "#94a3b8",
    marginTop: "0.25rem",
  },
  link: {
    color: "#2563eb",
    textDecoration: "underline",
  },
  startBtn: {
    width: "100%",
    padding: "0.9rem",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "1rem",
    color: "#991b1b",
    fontSize: "0.9rem",
    marginTop: "1rem",
  },
  retryBtn: {
    marginTop: "0.5rem",
    padding: "0.5rem 1rem",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "8px",
    padding: "1rem",
    color: "#166534",
    fontSize: "0.9rem",
    textAlign: "center" as const,
    marginTop: "1rem",
  },
};
