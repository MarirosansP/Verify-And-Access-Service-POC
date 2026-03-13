import { randomBytes, createHash } from "crypto";
import { prisma } from "./db";

/** Generate a raw token, store its hash, return the raw token. */
export async function createResetToken(userId: string): Promise<string> {
  // Invalidate any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const raw = randomBytes(32).toString("hex"); // 64-char hex
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return raw;
}

/** Validate a raw token; returns userId if valid, null otherwise. */
export async function validateResetToken(raw: string): Promise<string | null> {
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt < new Date()) return null;

  return record.userId;
}

/** Mark a token as used. */
export async function consumeResetToken(raw: string): Promise<void> {
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  await prisma.passwordResetToken.update({
    where: { tokenHash },
    data: { usedAt: new Date() },
  });
}
