/**
 * GET /api/worker-keys/[id]/usage
 *
 * Returns usage statistics for a single Worker key owned by the current user.
 *
 * Query params:
 *   days  - look-back window in days (default 14, max 90)
 *
 * Response:
 *   {
 *     quotaUsed:  number
 *     quotaLimit: number   // 50
 *     dailyRows:  [{ date: string, count: number }]
 *     totalCalls: number
 *   }
 */
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const QUOTA_LIMIT = 50;

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const uid = session?.user ? (session.user as any).id : null;
  if (!uid) return Response.json({ error: "unauthorized" }, { status: 401 });

  // Verify ownership
  const wk = await prisma.workerKey.findFirst({
    where: { id: params.id, userId: uid },
    select: { id: true },
  });
  if (!wk) return Response.json({ error: "not_found" }, { status: 404 });

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(Number(url.searchParams.get("days") || "14"), 90));
  const since = new Date(Date.now() - (days - 1) * 86400000);
  const oneHourAgo = new Date(Date.now() - 3600000);

  const quotaUsed = await prisma.workerUsageEvent.count({
    where: { workerKeyId: params.id, ts: { gte: oneHourAgo } },
  });

  const events = await prisma.workerUsageEvent.findMany({
    where: { workerKeyId: params.id, ts: { gte: since } },
    select: { ts: true },
    orderBy: { ts: "asc" },
  });

  const byDate: Record<string, number> = {};
  for (let d = 0; d < days; d++) {
    const dt = new Date(since.getTime() + d * 86400000);
    byDate[dt.toISOString().slice(0, 10)] = 0;
  }
  for (const e of events) {
    const date = new Date(e.ts).toISOString().slice(0, 10);
    if (byDate[date] !== undefined) byDate[date]++;
  }

  return Response.json({
    quotaUsed,
    quotaLimit: QUOTA_LIMIT,
    dailyRows: Object.entries(byDate).map(([date, count]) => ({ date, count })),
    totalCalls: events.length,
  });
}
