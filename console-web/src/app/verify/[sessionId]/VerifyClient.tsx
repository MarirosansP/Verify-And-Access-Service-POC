"use client";
/**
 * VerifyClient — uses @concordium/verification-web-ui SDK
 *
 * Flow:
 *   1. SDK loads → auto-starts verification (no manual button click needed)
 *   2. sdk.renderUIModals() → shows QR code / WalletConnect modal
 *   3. "verification-web-ui-event" type=session_approved → wallet connected
 *   4. sdk.sendPresentationRequest(vpData) → sends VP request to wallet
 *   5. "verification-web-ui-event" type=presentation_received → got proof
 *   6. Submit VP to backend for verification
 *
 * CHANGE: Auto-starts verification on SDK load — no idle/button state.
 * CHANGE: Now accepts an optional vpRequest prop (pre-created at initiation).
 *         If available, step 4 uses it directly — no API call needed.
 *         Falls back to the create-vp-request API if vpRequest is null.
 *
 * CRITICAL: The SDK emits on "verification-web-ui-event" (NOT "@concordium/...")
 * CRITICAL: In dev (React Strict Mode + Next.js Script onReady), startVerification
 *           is called 4+ times creating duplicate SDK instances, each firing their
 *           own active_session event. Fix: window-level SDK singleton (getSdkMap)
 *           ensures only ONE SDK instance (and thus ONE active_session) per session.
 * CRITICAL: Returning-user flow (active_session) can use a STALE WalletConnect
 *           session. If sendPresentationRequest times out, clear WC storage so
 *           the next attempt shows a fresh QR code instead of looping forever.
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import Script from "next/script";

/* ------------------------------------------------------------------ */
/* Window-level SDK singleton (survives Next.js HMR re-evaluation)   */
/* ------------------------------------------------------------------ */
/**
 * Keeps at most ONE ConcordiumVerificationWebUI instance per session ID.
 *
 * Root cause of the duplicate-send bug: React Strict Mode mounts the component
 * twice AND Next.js Script onReady fires on every mount, causing
 * startVerification() to run 4+ times. Each call creates a new SDK instance
 * and calls renderUIModals(), which emits active_session — so we end up with
 * 4 competing sendPresentationRequest calls on the same WC topic.
 *
 * Storing the SDK on `window` (not as a module-level variable) means it
 * survives Next.js HMR re-evaluations — when the module file is re-evaluated,
 * module-level `const` declarations are reset to their initial values, but
 * `window` properties are never touched by HMR.
 *
 * The second, third, fourth calls to startVerification() reuse the existing
 * instance instead of creating a new one. renderUIModals() is only called
 * once → only ONE active_session fires.
 *
 * Deleted on retry (after timeout) so a fresh SDK can be created.
 */
function getSdkMap(): Map<string, any> {
  const w = window as any;
  if (!w.__vaSdkBySession) w.__vaSdkBySession = new Map<string, any>();
  return w.__vaSdkBySession as Map<string, any>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Window-based dedup guard — prevents duplicate sendPresentationRequest calls.
 *
 * WHY window (not sessionStorage):
 *   sessionStorage.setItem can silently fail (storage quota, private mode,
 *   browser quirks). A silent failure means isVprSent() returns false for
 *   the second event and the send runs twice.
 *   window properties are always synchronous, never throw, and survive
 *   HMR re-evaluation (like getSdkMap).
 *
 * WHY we do NOT clear in the catch block:
 *   If sendPresentationRequest throws (stale session), clearVprSent in the
 *   catch would unset the flag. Then setState("failed") triggers a useEffect
 *   re-run (state dep), creating a fresh listener. If the SDK fires
 *   active_session again internally, the fresh listener would see the flag
 *   as unset and make a second attempt. Instead we only clear on explicit
 *   "Try Again" — the user's intentional retry.
 */
function markVprSent(sessionId: string): void {
  const w = window as any;
  if (!w.__vaVprSent) w.__vaVprSent = {};
  w.__vaVprSent[sessionId] = true;
}
function isVprSent(sessionId: string): boolean {
  return !!((window as any).__vaVprSent?.[sessionId]);
}
function clearVprSent(sessionId: string): void {
  const w = window as any;
  if (w.__vaVprSent) delete w.__vaVprSent[sessionId];
}

/**
 * Wipe WalletConnect v2 state from localStorage + IndexedDB.
 * Called after sendPresentationRequest times out so the next
 * renderUIModals() shows a fresh QR code instead of the stale session.
 *
 * IMPORTANT: We clear the keyvaluestorage OBJECT STORE rather than
 * deleting the database. indexedDB.deleteDatabase() is blocked while the
 * WC SDK holds an open connection, so it silently fails.  Clearing the
 * store directly works even with active connections.
 */
function clearWalletConnectStorage() {
  // localStorage
  try {
    for (const key of [...Object.keys(localStorage)]) {
      if (key.startsWith("wc@") || key.toLowerCase().includes("walletconnect")) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.warn("[VerifyClient] Could not clear WC localStorage:", e);
  }

  // IndexedDB — clear the keyvaluestorage store (don't delete the DB)
  try {
    const req = indexedDB.open("WALLET_CONNECT_V2_INDEXED_DB", 1);
    req.onsuccess = (e: any) => {
      try {
        const db: IDBDatabase = e.target.result;
        const tx = db.transaction("keyvaluestorage", "readwrite");
        tx.objectStore("keyvaluestorage").clear();
        tx.oncomplete = () =>
          console.log("[VerifyClient] WC IndexedDB keyvaluestorage cleared ✓");
        tx.onerror = () =>
          console.warn("[VerifyClient] WC IDB clear tx error:", tx.error);
      } catch (inner) {
        console.warn("[VerifyClient] WC IDB clear inner error:", inner);
      }
    };
    req.onerror = () =>
      console.warn("[VerifyClient] WC IDB open error:", req.error);
  } catch (e) {
    console.warn("[VerifyClient] Could not clear WC IndexedDB:", e);
  }
}

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
interface Props {
  sessionId: string;
  challenge: string;
  siteName: string;
  siteUrl: string;
  callbackUrl: string;
  vpRequest?: any | null; // ← pre-created VPR data from server
}

type FlowState =
  | "loading-sdk"
  | "starting"
  | "wallet-flow"
  | "verifying"
  | "success"
  | "failed";

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */
export default function VerifyClient({
  sessionId,
  challenge,
  siteName,
  siteUrl,
  callbackUrl,
  vpRequest,
}: Props) {
  const [state, setState] = useState<FlowState>("loading-sdk");
  const [statusMsg, setStatusMsg] = useState("Loading verification SDK…");
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const sdkRef = useRef<any>(null);
  const vpRequestRef = useRef<any>(vpRequest || null);
  const handledRef = useRef(false);
  const startedRef = useRef(false); // prevent double-start within one mount

  /* ---- Start the verification flow ---- */
  const startVerification = useCallback(async () => {
    if (startedRef.current) return; // guard against double invocation within one mount
    startedRef.current = true;

    // ── SDK singleton check ────────────────────────────────────────────
    // If another mount already created an SDK for this session, reuse it.
    // renderUIModals() must NOT be called again — it would emit a duplicate
    // active_session event leading to competing sendPresentationRequest calls.
    if (getSdkMap().has(sessionId)) {
      console.log(
        "[VerifyClient] SDK already initialised for session — reusing, skipping renderUIModals"
      );
      sdkRef.current = getSdkMap().get(sessionId);
      // State may already be "wallet-flow" from the first mount; keep it.
      return;
    }
    // ──────────────────────────────────────────────────────────────────

    // Prune SDK instances from any previous sessions that lingered through
    // Next.js SPA navigation (window persists across soft-route changes).
    // Two coexisting SignClient instances on the same WC topic compete for
    // relay messages, causing sendPresentationRequest to time out on the
    // returning-user flow.
    //
    // We only remove the map references (no sdk.disconnect()) so that the
    // WC session data in IDB/localStorage is preserved for the returning-user
    // "Start Private Verification" flow.
    //
    // Safe for concurrent verifications: different browser tabs each have
    // their own window object — no cross-tab interference.
    for (const [id] of [...getSdkMap()]) {
      if (id !== sessionId) {
        console.log("[VerifyClient] Pruning stale SDK for previous session:", id);
        getSdkMap().delete(id);
      }
    }

    setState("starting");
    setStatusMsg("Initializing wallet connection…");
    setError(null);
    handledRef.current = false;

    try {
      const ConcordiumVerificationWebUI = (window as any)
        .ConcordiumVerificationWebUI;

      if (!ConcordiumVerificationWebUI) {
        throw new Error("SDK not loaded — please refresh and try again");
      }

      const projectId =
        process.env.NEXT_PUBLIC_WC_PROJECT_ID ||
        "76324905a70fe5c388bab46d3e0564dc";

      const sdk = new ConcordiumVerificationWebUI({
        network: "mainnet",
        projectId,
        metadata: {
          name: "Verify & Access",
          description: `Age verification for ${siteName}`,
          url: window.location.origin,
          icons: [],
        },
      });

      // Register in the singleton map BEFORE awaiting renderUIModals so
      // any concurrent startVerification calls see it immediately.
      getSdkMap().set(sessionId, sdk);
      sdkRef.current = sdk;

      // This shows the QR code / WalletConnect modal.
      // When user scans and approves, SDK emits "session_approved" event.
      // For returning users (existing WC session), SDK emits "active_session"
      // when they click "Start Private Verification".
      await sdk.renderUIModals();

      setState("wallet-flow");
      setStatusMsg("Scan the QR code with Concordium ID…");
    } catch (err: any) {
      console.error("[VerifyClient] Start error:", err);
      startedRef.current = false; // allow retry
      getSdkMap().delete(sessionId); // allow fresh SDK on retry
      setState("failed");
      setError(err.message || "Failed to start verification");
      setStatusMsg("❌ Something went wrong.");
    }
  }, [sessionId, siteName]);

  /* ---- SDK loaded → auto-start ---- */
  const onSdkReady = useCallback(() => {
    console.log("[VerifyClient] SDK script loaded, auto-starting…");
    startVerification();
  }, [startVerification]);

  /* ---- SDK event handler ---- */
  useEffect(() => {
    const handler = async (event: Event) => {
      const { type, data } = (event as CustomEvent).detail || {};
      console.log("[VerifyClient] SDK event:", type, data);

      switch (type) {
        // Returning-user flow: SDK emits "active_session" (not "session_approved")
        // when the user clicks "Start private verification" on the returning-user modal.
        // Treat it identically — same topic shape, same VPR send.
        case "active_session":
        case "session_approved": {
          // ── Deduplication guard (window-based) ──────────────────────────
          // Prevents duplicate sendPresentationRequest calls from:
          //   • React Strict Mode double-mount (2 event listeners briefly active)
          //   • SDK firing active_session twice (internal reconnect after failure)
          //   • useEffect re-runs due to state changes recreating the listener
          // Using window (not sessionStorage) — see markVprSent comment above.
          if (isVprSent(sessionId)) {
            console.log(
              "[VerifyClient] Duplicate session event ignored — VPR already sent for:",
              sessionId
            );
            return;
          }
          markVprSent(sessionId);
          // ────────────────────────────────────────────────────────────────

          console.log(
            "[VerifyClient] Wallet connected (event:", type, ") — creating VP request…"
          );
          setStatusMsg("Wallet connected! Creating verification request…");

          try {
            let vpData: any;

            // ── Use pre-created VPR if available ──
            if (vpRequestRef.current) {
              console.log(
                "[VerifyClient] Using pre-created VPR (skipping API call)"
              );
              vpData = vpRequestRef.current;
            } else {
              // ── FALLBACK: Create the VP request via our backend ──
              console.log(
                "[VerifyClient] No pre-created VPR, calling create-vp-request API…"
              );
              const resp = await fetch(
                `/api/worker/create-vp-request/${sessionId}`,
                { method: "POST" }
              );
              if (!resp.ok) {
                const err = await resp
                  .json()
                  .catch(() => ({ error: "Unknown" }));
                throw new Error(
                  err.error || err.detail || `HTTP ${resp.status}`
                );
              }
              vpData = await resp.json();
              vpRequestRef.current = vpData;
            }

            console.log("[VerifyClient] VP request ready:", vpData);
            setStatusMsg("Check your Concordium ID app to approve…");

            // Send the presentation request through the SDK's WalletConnect.
            // Pass data.topic explicitly — the outer ConcordiumVerificationWebUI
            // instance never auto-populates this.currentSession, so without the
            // explicit topic sendPresentationRequest throws
            // "No active WalletConnect session. Please connect first."
            if (sdkRef.current?.sendPresentationRequest) {
              console.log(
                "[VerifyClient] Calling sendPresentationRequest with topic:", data?.topic
              );

              // Race against a 30 s timeout.
              // If the wallet doesn't respond (stale/disconnected WC session),
              // surface a retryable error. The catch block below will clear the
              // stale WC session from storage so "Try Again" shows a fresh QR.
              const SEND_TIMEOUT_MS = 30_000;
              await Promise.race([
                sdkRef.current.sendPresentationRequest(vpData, data?.topic),
                new Promise<never>((_, reject) =>
                  setTimeout(
                    () => reject(new Error("__timeout__")),
                    SEND_TIMEOUT_MS
                  )
                ),
              ]);

              console.log("[VerifyClient] sendPresentationRequest completed");
            } else {
              throw new Error("SDK sendPresentationRequest not available");
            }
          } catch (err: any) {
            const isTimeout = err.message === "__timeout__";

            // NOTE: We do NOT call clearVprSent here.
            // Clearing the flag in the catch would allow the SDK's internal
            // active_session retry (fired after a failed sendPresentationRequest)
            // to bypass the dedup guard and make a second attempt.
            // The flag is only cleared when the user explicitly clicks "Try Again".

            if (isTimeout) {
              // The WalletConnect session is stale (wallet didn't respond).
              // Clear WC storage so the next renderUIModals() shows a fresh
              // QR code instead of the dead "Start Private Verification" modal.
              // Also clear the SDK singleton so a fresh instance is created.
              console.warn(
                "[VerifyClient] sendPresentationRequest timed out — clearing stale WC session"
              );
              clearWalletConnectStorage();
              getSdkMap().delete(sessionId);
              setState("failed");
              setError(
                "Your wallet session has expired. Click 'Try Again' to reconnect with a new QR code."
              );
              setStatusMsg("❌ Wallet session expired.");
            } else {
              console.error("[VerifyClient] VP request error:", err);
              setState("failed");
              setError(err.message || "Failed to create verification request");
              setStatusMsg("❌ Something went wrong.");
            }
          }
          break;
        }

        case "presentation_received": {
          if (handledRef.current) return;
          handledRef.current = true;

          console.log("[VerifyClient] Presentation received, verifying…");
          setState("verifying");
          setStatusMsg("Verifying your proof…");

          try {
            // Extract VP — SDK may wrap it in verifiablePresentationJson
            let vp = data;
            if (data?.verifiablePresentationJson) {
              try {
                vp = JSON.parse(data.verifiablePresentationJson);
              } catch {
                vp = data.verifiablePresentationJson;
              }
            } else if (data?.verifiablePresentation) {
              vp = data.verifiablePresentation;
            } else if (data?.proof) {
              vp = data.proof;
            }

            const resp = await fetch(
              `/api/worker/submit-vp/${sessionId}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  presentation: vp,
                  verificationRequest: vpRequestRef.current,
                }),
              }
            );

            const result = await resp.json();
            if (result.verified) {
              setState("success");
              setStatusMsg("✅ Verification successful! Redirecting…");
              if (sdkRef.current?.showSuccessState) {
                await sdkRef.current.showSuccessState();
              }
              // The Concordium ID app closes its WC session after each completed
              // verification. Clear the browser's stale WC session data so the
              // NEXT verify page shows a fresh QR code rather than "Start Private
              // Verification" (which would immediately timeout on a dead session).
              clearWalletConnectStorage();
              getSdkMap().delete(sessionId);
              const sep = callbackUrl.includes("?") ? "&" : "?";
              const redirect = `${callbackUrl}${sep}va_session=${sessionId}&va_status=verified`;
              setRedirectUrl(redirect);
              setTimeout(() => {
                window.location.href = redirect;
              }, 2000);
            } else {
              setState("failed");
              setError(result.reason || "Verification failed");
              setStatusMsg("❌ Verification failed.");
            }
          } catch (err: any) {
            console.error("[VerifyClient] Verify error:", err);
            setState("failed");
            setError(err.message || "Verification request failed");
            setStatusMsg("❌ Something went wrong.");
          }
          break;
        }

        case "session_disconnected": {
          console.log("[VerifyClient] Session disconnected");
          if (state !== "success") {
            startedRef.current = false; // allow restart
            setState("failed");
            setStatusMsg("Session disconnected. Click below to try again.");
            setError("Session disconnected");
            handledRef.current = false;
          }
          break;
        }

        case "error": {
          console.error("[VerifyClient] SDK error:", data);
          if (state !== "success") {
            startedRef.current = false; // allow retry
            setState("failed");
            setError(data?.message || "SDK error");
            setStatusMsg("❌ Something went wrong.");
          }
          break;
        }
      }
    };

    // CORRECT event name — the SDK dispatches "verification-web-ui-event"
    window.addEventListener("verification-web-ui-event", handler);
    return () => {
      window.removeEventListener("verification-web-ui-event", handler);
    };
  }, [sessionId, callbackUrl, state]);

  /* ---- Render ---- */
  return (
    <div style={styles.wrapper}>
      {/* Load the pre-bundled SDK (esbuild output) */}
      <Script
        src="/build/verification-sdk.js"
        strategy="afterInteractive"
        onReady={onSdkReady}
        onError={() => {
          setState("failed");
          setError("Failed to load verification SDK");
        }}
      />

      {/* SDK CSS */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/build/verification-sdk.css" />

      {/* Status message */}
      <div style={styles.statusBar}>
        {(state === "starting" ||
          state === "verifying" ||
          state === "loading-sdk") && <Spinner />}
        <span style={styles.statusText}>{statusMsg}</span>
      </div>

      {/* Error display with retry */}
      {error && (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {error}
          <br />
          <button
            onClick={() => {
              setError(null);
              startedRef.current = false;
              clearVprSent(sessionId);       // allow re-send on retry
              getSdkMap().delete(sessionId); // allow fresh SDK on retry
              startVerification();
            }}
            style={styles.retryBtn}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Success with manual redirect link */}
      {state === "success" && redirectUrl && (
        <div style={styles.successBox}>
          <p>
            Redirecting to <strong>{siteName}</strong>…
          </p>
          <a href={redirectUrl} style={styles.link}>
            Click here if not redirected automatically
          </a>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Spinner                                                            */
/* ------------------------------------------------------------------ */
function Spinner() {
  return (
    <span style={styles.spinner}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 12 12;360 12 12"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                             */
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
  link: {
    color: "#2563eb",
    textDecoration: "underline",
  },
};
