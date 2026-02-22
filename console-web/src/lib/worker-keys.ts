/**
 * Worker Key Management
 * ---------------------
 * Handles creation, validation, and lifecycle of CloudFlare Worker keys.
 * Worker keys are distinct from API keys — they use a `wk_` prefix and
 * include a bound siteUrl so each key is scoped to one domain.
 *
 * Storage: JSON file at /data/worker-keys.json (Docker volume)
 */

import { randomBytes, createHash } from "crypto";
import fs from "fs";
import path from "path";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WorkerKey {
  id: string;              // internal uuid
  accountId: string;       // owner (from NextAuth session)
  key: string;             // the actual key shown once: wk_<64-hex>
  keyHash: string;         // sha256 of the key (stored, used for lookups)
  siteName: string;        // display label, e.g. "My Blog"
  siteUrl: string;         // origin the key is bound to, e.g. https://myblog.com
  callbackPath: string;    // path on siteUrl that receives the redirect, default "/"
  status: "active" | "paused" | "revoked";
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}

export type WorkerKeyPublic = Omit<WorkerKey, "key" | "keyHash">;

/* ------------------------------------------------------------------ */
/*  Persistence helpers                                                */
/* ------------------------------------------------------------------ */

const DATA_DIR  = process.env.DATA_DIR || "/data";
const KEYS_FILE = path.join(DATA_DIR, "worker-keys.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readKeys(): WorkerKey[] {
  ensureDataDir();
  if (!fs.existsSync(KEYS_FILE)) return [];
  return JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
}

function writeKeys(keys: WorkerKey[]) {
  ensureDataDir();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}

/* ------------------------------------------------------------------ */
/*  Key generation                                                     */
/* ------------------------------------------------------------------ */

function generateKeyId(): string {
  return randomBytes(12).toString("hex");           // 24-char hex id
}

function generateRawKey(): string {
  return `wk_${randomBytes(32).toString("hex")}`;   // wk_ + 64 hex chars
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Create a new worker key. Returns the full object INCLUDING the raw key (show once). */
export function createWorkerKey(
  accountId: string,
  siteName: string,
  siteUrl: string,
  callbackPath: string = "/"
): WorkerKey {
  const keys = readKeys();

  // Normalise siteUrl — strip trailing slash
  const normUrl = siteUrl.replace(/\/+$/, "");

  const raw = generateRawKey();
  const now = new Date().toISOString();

  const wk: WorkerKey = {
    id: generateKeyId(),
    accountId,
    key: raw,                       // only returned at creation
    keyHash: hashKey(raw),
    siteName,
    siteUrl: normUrl,
    callbackPath,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  keys.push(wk);
  writeKeys(keys);
  return wk;
}

/** List all worker keys for an account (public view — no raw key). */
export function listWorkerKeys(accountId: string): WorkerKeyPublic[] {
  return readKeys()
    .filter((k) => k.accountId === accountId)
    .map(({ key, keyHash, ...pub }) => pub);
}

/** Find a key by its raw value. Returns null if not found or not active. */
export function validateWorkerKey(rawKey: string): WorkerKey | null {
  const h = hashKey(rawKey);
  const keys = readKeys();
  const found = keys.find((k) => k.keyHash === h);
  if (!found) return null;
  if (found.status !== "active") return null;
  return found;
}

/** Find a key by id (for dashboard display). */
export function getWorkerKeyById(id: string, accountId: string): WorkerKey | null {
  return readKeys().find((k) => k.id === id && k.accountId === accountId) ?? null;
}

/** Update status of a key. */
export function updateWorkerKeyStatus(
  id: string,
  accountId: string,
  status: "active" | "paused" | "revoked"
): WorkerKeyPublic | null {
  const keys = readKeys();
  const idx = keys.findIndex((k) => k.id === id && k.accountId === accountId);
  if (idx === -1) return null;

  // Once revoked, cannot be reactivated
  if (keys[idx].status === "revoked" && status !== "revoked") return null;

  keys[idx].status = status;
  keys[idx].updatedAt = new Date().toISOString();
  writeKeys(keys);
  const { key, keyHash, ...pub } = keys[idx];
  return pub;
}

/** Delete a key permanently. */
export function deleteWorkerKey(id: string, accountId: string): boolean {
  const keys = readKeys();
  const filtered = keys.filter((k) => !(k.id === id && k.accountId === accountId));
  if (filtered.length === keys.length) return false;
  writeKeys(filtered);
  return true;
}
