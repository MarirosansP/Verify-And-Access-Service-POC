import bcrypt from "bcryptjs";

export function generateApiKeyRaw() {
  const bytes = crypto.getRandomValues(new Uint8Array(30));
  const rand = Buffer.from(bytes).toString("hex"); // 60 chars
  const raw = `va_live_${rand}`;
  const prefix = raw.slice(0, 12);
  return { raw, prefix };
}

export async function hashKey(raw: string) {
  return bcrypt.hash(raw, 12);
}

export async function verifyKey(raw: string, hash: string) {
  return bcrypt.compare(raw, hash);
}
