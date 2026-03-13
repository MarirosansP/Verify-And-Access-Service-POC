import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
nexport const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const uid = session?.user ? (session.user as any).id : null;
  if (!uid) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") || "7");
  const since = new Date(Date.now() - Math.max(1, Math.min(days, 90)) * 86400000);

  const rows = await prisma.usageEvent.groupBy({
    by: ["endpoint", "statusCode"],
    where: { userId: uid, ts: { gte: since } },
    _count: { _all: true }
  });

  return Response.json({ since, rows });
}
