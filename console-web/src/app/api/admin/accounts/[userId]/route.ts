import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      email: true,
      name: true,
      isFrozen: true,
      createdAt: true,
      apiKeys: {
        select: { id: true, name: true, prefix: true, status: true, createdAt: true, lastUsedAt: true },
        orderBy: { createdAt: "desc" },
      },
      workerKeys: {
        select: { id: true, siteName: true, siteUrl: true, callbackPath: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user || user.isFrozen === undefined) {
    // Check it exists at all
    const exists = await prisma.user.findUnique({ where: { id: params.userId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const verificationCount = await prisma.verificationRecord.count({
    where: { userId: params.userId, createdAt: { gte: thirtyDaysAgo } },
  });

  // 14-day daily verification chart data
  const records = await prisma.verificationRecord.findMany({
    where: { userId: params.userId, createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
    select: { createdAt: true, status: true },
  });

  const dailyMap: Record<string, { verified: number; failed: number }> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = { verified: 0, failed: 0 };
  }
  for (const r of records) {
    const key = r.createdAt.toISOString().slice(0, 10);
    if (dailyMap[key]) dailyMap[key][r.status as "verified" | "failed"]++;
  }

  return NextResponse.json({
    user,
    verificationCount30d: verificationCount,
    dailyChart: Object.entries(dailyMap).map(([date, v]) => ({ date, ...v })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const body = await req.json().catch(() => ({}));
  const { frozen } = body;
  if (typeof frozen !== "boolean") {
    return NextResponse.json({ error: "frozen (boolean) required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: params.userId }, select: { id: true, isAdmin: true } });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (user.isAdmin) return NextResponse.json({ error: "cannot_freeze_admin" }, { status: 403 });

  if (frozen) {
    // Freeze: pause all active keys
    await prisma.$transaction([
      prisma.user.update({ where: { id: params.userId }, data: { isFrozen: true } }),
      prisma.apiKey.updateMany({
        where: { userId: params.userId, status: "active" },
        data: { status: "paused" },
      }),
      prisma.workerKey.updateMany({
        where: { userId: params.userId, status: "active" },
        data: { status: "paused" },
      }),
    ]);
  } else {
    // Unfreeze: restore all non-revoked keys to active
    await prisma.$transaction([
      prisma.user.update({ where: { id: params.userId }, data: { isFrozen: false } }),
      prisma.apiKey.updateMany({
        where: { userId: params.userId, status: "paused" },
        data: { status: "active" },
      }),
      prisma.workerKey.updateMany({
        where: { userId: params.userId, status: "paused" },
        data: { status: "active" },
      }),
    ]);
  }

  return NextResponse.json({ ok: true, frozen });
}
