/**
 * Worker Key Management
 * ---------------------
 * Handles creation, validation, and lifecycle of CloudFlare Worker keys.
 * Worker keys are distinct from API keys — they use a `wk_` prefix and
 * include a bound siteUrl so each key is scoped to one domain.
 *
 * Storage: Prisma/SQLite (same database as API keys)
 */

import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WorkerKey {
  id: string;
  accountId: string;       // maps to userId in DB
  key: string;             // the actual key shown once: wk_<64-hex>
  keyHash: string;         // sha256 of the key (stored, used for lookups)
  siteName: string;
  siteUrl: string;
  callbackPath: string;
  status: "active" | "paused" | "revoked";
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}

export type WorkerKeyPublic = Omit<WorkerKey, "key" | "keyHash">;

/* ------------------------------------------------------------------ */
/*  Key generation                                                     */
/* ------------------------------------------------------------------ */

function generateRawKey(): string {
  return `wk_${randomBytes(32).toString("hex")}`;   // wk_ + 64 hex chars
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/* ------------------------------------------------------------------ */
/*  Helper: map Prisma record → our WorkerKey/WorkerKeyPublic types    */
/* ------------------------------------------------------------------ */

function toPublic(row: any): WorkerKeyPublic {
  return {
    id: row.id,
    accountId: row.userId,
    siteName: row.siteName,
    siteUrl: row.siteUrl,
    callbackPath: row.callbackPath,
    status: row.status as "active" | "paused" | "revoked",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toFull(row: any, rawKey?: string): WorkerKey {
  return {
    ...toPublic(row),
    key: rawKey || "",
    keyHash: row.keyHash,
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Create a new worker key. Returns the full object INCLUDING the raw key (show once). */
export async function createWorkerKey(
  accountId: string,
  siteName: string,
  siteUrl: string,
  callbackPath: string = "/"
): Promise<WorkerKey> {
  // Normalise siteUrl — strip trailing slash
  const normUrl = siteUrl.replace(/\/+$/, "");
  const raw = generateRawKey();

  const row = await prisma.workerKey.create({
    data: {
      userId: accountId,
      keyHash: hashKey(raw),
      siteName,
      siteUrl: normUrl,
      callbackPath,
      status: "active",
    },
  });

  return toFull(row, raw);
}

/** List all worker keys for an account (public view — no raw key). */
export async function listWorkerKeys(accountId: string): Promise<WorkerKeyPublic[]> {
  const rows = await prisma.workerKey.findMany({
    where: { userId: accountId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toPublic);
}

/** Find a key by its raw value. Returns null if not found or not active. */
export async function validateWorkerKey(rawKey: string): Promise<WorkerKey | null> {
  const h = hashKey(rawKey);
  const row = await prisma.workerKey.findUnique({
    where: { keyHash: h },
  });
  if (!row) return null;
  if (row.status !== "active") return null;
  return toFull(row);
}

/** Find a key by id (for dashboard display). */
export async function getWorkerKeyById(id: string, accountId: string): Promise<WorkerKey | null> {
  const row = await prisma.workerKey.findFirst({
    where: { id, userId: accountId },
  });
  if (!row) return null;
  return toFull(row);
}

/** Update status of a key. */
export async function updateWorkerKeyStatus(
  id: string,
  accountId: string,
  status: "active" | "paused" | "revoked"
): Promise<WorkerKeyPublic | null> {
  // Find the key first
  const existing = await prisma.workerKey.findFirst({
    where: { id, userId: accountId },
  });
  if (!existing) return null;

  // Once revoked, cannot be reactivated
  if (existing.status === "revoked" && status !== "revoked") return null;

  const row = await prisma.workerKey.update({
    where: { id },
    data: { status },
  });

  return toPublic(row);
}

/** Delete a key permanently. */
export async function deleteWorkerKey(id: string, accountId: string): Promise<boolean> {
  const existing = await prisma.workerKey.findFirst({
    where: { id, userId: accountId },
  });
  if (!existing) return false;

  await prisma.workerKey.delete({ where: { id } });
  return true;
}
