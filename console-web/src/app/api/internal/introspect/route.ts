import { prisma } from "@/lib/db";
import { verifyKey } from "@/lib/keys";
import { z } from "zod";
nexport const dynamic = "force-dynamic";

const QUOTA_LIMIT = 50; // calls per rolling hour per API key

export async function POST(req: Request) {
  const schema = z.object({ apiKey: z.string().min(10) });
  const { apiKey } = schema.parse(await req.json());

  const prefix = apiKey.slice(0, 12);
  const row = await prisma.apiKey.findUnique({
    where: { prefix },
    select: { id: true, userId: true, status: true, keyHash: true }
  });

  if (!row) return Response.json({ valid: false });

  const ok = await verifyKey(apiKey, row.keyHash);
  if (!ok) return Response.json({ valid: false });

  // ── Hourly quota check ────────────────────────────────────────
  // Count successful (2xx) calls in the last 60 minutes.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const quotaUsed = await prisma.usageEvent.count({
    where: {
      apiKeyId: row.id,
      ts: { gte: oneHourAgo },
      statusCode: { gte: 200, lt: 300 },   // only successful requests count
    },
  });
  const quotaExceeded = quotaUsed >= QUOTA_LIMIT;
  // ─────────────────────────────────────────────────────────────

  return Response.json({
    valid: true,
    status: row.status,
    userId: row.userId,
    apiKeyId: row.id,
    quotaUsed,
    quotaLimit: QUOTA_LIMIT,
    quotaExceeded,
  });
}
