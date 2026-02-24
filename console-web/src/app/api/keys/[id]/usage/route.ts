/**
 * GET /api/keys/[id]/usage
 *
 * Returns usage statistics for a single API key owned by the current user.
 *
 * Query params:
 *   days  - look-back window in days (default 14, max 90)
 *
 * Response:
 *   {
 *     quotaUsed:   number   // calls in the last 60 minutes
 *     quotaLimit:  number   // 50
 *     dailyRows:   [{ date: "2026-02-24", count: number }]  // last N days
 *     endpointRows:[{ endpoint: string, statusCode: number, count: number }]
 *     totalCalls:  number
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
  const key = await prisma.apiKey.findFirst({
    where: { id: params.id, userId: uid },
    select: { id: true },
  });
  if (!key) return Response.json({ error: "not_found" }, { status: 404 });

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(Number(url.searchParams.get("days") || "14"), 90));
  const since = new Date(Date.now() - (days - 1) * 86400000);
  const oneHourAgo = new Date(Date.now() - 3600000);

  // Hourly quota
  const quotaUsed = await prisma.usageEvent.count({
    where: {
      apiKeyId: params.id,
      ts: { gte: oneHourAgo },
      statusCode: { gte: 200, lt: 300 },
    },
  });

  // All events in window for daily breakdown
  const events = await prisma.usageEvent.findMany({
    where: { apiKeyId: params.id, ts: { gte: since } },
    select: { ts: true, endpoint: true, statusCode: true },
    orderBy: { ts: "asc" },
  });

  // Aggregate by date
  const byDate: Record<string, number> = {};
  for (let d = 0; d < days; d++) {
    const dt = new Date(since.getTime() + d * 86400000);
    byDate[dt.toISOString().slice(0, 10)] = 0;
  }
  for (const e of events) {
    const date = new Date(e.ts).toISOString().slice(0, 10);
    if (byDate[date] !== undefined) byDate[date]++;
  }

  // Aggregate by endpoint
  const byEndpoint: Record<string, number> = {};
  for (const e of events) {
    const k = `${e.endpoint} (${e.statusCode})`;
    byEndpoint[k] = (byEndpoint[k] || 0) + 1;
  }

  return Response.json({
    quotaUsed,
    quotaLimit: QUOTA_LIMIT,
    dailyRows: Object.entries(byDate).map(([date, count]) => ({ date, count })),
    endpointRows: Object.entries(byEndpoint).map(([key, count]) => ({ key, count })),
    totalCalls: events.length,
  });
}
