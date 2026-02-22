/**
 * Worker Verification Sessions
 * ----------------------------
 * Each time a CloudFlare Worker (or test page) initiates a verification
 * request, a session is created.  The end-user is redirected to
 *   /verify/<sessionId>
 * where they complete the WalletConnect + VP flow.
 *
 * The CF Worker then polls GET /api/worker/status/<sessionId> until
 * the status flips from "pending" to "verified" / "failed" / "expired".
 *
 * Sessions auto-expire after SESSION_TTL_MS (default 5 minutes).
 *
 * Storage: JSON file at /data/worker-sessions.json  (Docker volume)
 */

import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WorkerSession {
  sessionId: string;
  workerKeyId: string;       // which worker key initiated this
  accountId: string;         // key owner
  challenge: string;         // e.g. "age_over_18"
  siteUrl: string;           // from the worker key
  siteName: string;
  callbackUrl: string;       // full URL to redirect back to
  status: "pending" | "verified" | "failed" | "expired";
  result: boolean | null;
  failureReason: string | null;
  verificationRequestUrl: string | null;   // URL to the credential-verifier request
  createdAt: string;
  expiresAt: string;
}

export type WorkerSessionPublic = Pick<
  WorkerSession,
  "sessionId" | "challenge" | "siteUrl" | "siteName" | "status" | "result" | "failureReason"
>;

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const SESSION_TTL_MS = 5 * 60 * 1000;   // 5 minutes
const DATA_DIR  = process.env.DATA_DIR || "/data";
const SESS_FILE = path.join(DATA_DIR, "worker-sessions.json");

/* ------------------------------------------------------------------ */
/*  Persistence                                                        */
/* ------------------------------------------------------------------ */

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readSessions(): WorkerSession[] {
  ensureDataDir();
  if (!fs.existsSync(SESS_FILE)) return [];
  return JSON.parse(fs.readFileSync(SESS_FILE, "utf-8"));
}

function writeSessions(sessions: WorkerSession[]) {
  ensureDataDir();
  fs.writeFileSync(SESS_FILE, JSON.stringify(sessions, null, 2));
}

/** Remove expired sessions (housekeeping). */
function purgeExpired(sessions: WorkerSession[]): WorkerSession[] {
  const now = Date.now();
  return sessions.map((s) => {
    if (s.status === "pending" && new Date(s.expiresAt).getTime() < now) {
      return { ...s, status: "expired" as const, result: false, failureReason: "Session expired" };
    }
    return s;
  });
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Create a new verification session. */
export function createSession(params: {
  workerKeyId: string;
  accountId: string;
  challenge: string;
  siteUrl: string;
  siteName: string;
  callbackUrl: string;
}): WorkerSession {
  const sessions = purgeExpired(readSessions());

  const now = new Date();
  const session: WorkerSession = {
    sessionId: randomBytes(16).toString("hex"),
    workerKeyId: params.workerKeyId,
    accountId: params.accountId,
    challenge: params.challenge,
    siteUrl: params.siteUrl,
    siteName: params.siteName,
    callbackUrl: params.callbackUrl,
    status: "pending",
    result: null,
    failureReason: null,
    verificationRequestUrl: null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };

  sessions.push(session);
  writeSessions(sessions);
  return session;
}

/** Get a session by ID (returns null if not found). Auto-expires. */
export function getSession(sessionId: string): WorkerSession | null {
  let sessions = readSessions();
  sessions = purgeExpired(sessions);
  writeSessions(sessions);
  return sessions.find((s) => s.sessionId === sessionId) ?? null;
}

/** Get session status (public subset — safe to return to CF worker). */
export function getSessionStatus(sessionId: string): WorkerSessionPublic | null {
  const s = getSession(sessionId);
  if (!s) return null;
  return {
    sessionId: s.sessionId,
    challenge: s.challenge,
    siteUrl: s.siteUrl,
    siteName: s.siteName,
    status: s.status,
    result: s.result,
    failureReason: s.failureReason,
  };
}

/** Mark session as verified (age check passed). */
export function markVerified(sessionId: string): WorkerSession | null {
  const sessions = purgeExpired(readSessions());
  const idx = sessions.findIndex((s) => s.sessionId === sessionId);
  if (idx === -1) return null;
  if (sessions[idx].status !== "pending") return sessions[idx]; // idempotent

  sessions[idx].status = "verified";
  sessions[idx].result = true;
  sessions[idx].failureReason = null;
  writeSessions(sessions);
  return sessions[idx];
}

/** Mark session as failed. */
export function markFailed(sessionId: string, reason: string): WorkerSession | null {
  const sessions = purgeExpired(readSessions());
  const idx = sessions.findIndex((s) => s.sessionId === sessionId);
  if (idx === -1) return null;
  if (sessions[idx].status !== "pending") return sessions[idx];

  sessions[idx].status = "failed";
  sessions[idx].result = false;
  sessions[idx].failureReason = reason;
  writeSessions(sessions);
  return sessions[idx];
}

/** Store the verification request URL (from credential-verifier) on the session. */
export function setVerificationRequestUrl(sessionId: string, url: string): void {
  const sessions = readSessions();
  const idx = sessions.findIndex((s) => s.sessionId === sessionId);
  if (idx === -1) return;
  sessions[idx].verificationRequestUrl = url;
  writeSessions(sessions);
}
