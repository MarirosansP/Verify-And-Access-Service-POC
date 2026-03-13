import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalApiKeys,
    totalWorkerKeys,
    activeApiKeys,
    activeWorkerKeys,
    verificationsToday,
    verifications30d,
    verifiedToday,
    verified30d,
  ] = await Promise.all([
    prisma.user.count({ where: { isAdmin: false } }),
    prisma.apiKey.count(),
    prisma.workerKey.count(),
    prisma.apiKey.count({ where: { status: "active" } }),
    prisma.workerKey.count({ where: { status: "active" } }),
    prisma.verificationRecord.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.verificationRecord.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.verificationRecord.count({ where: { status: "verified", createdAt: { gte: todayStart } } }),
    prisma.verificationRecord.count({ where: { status: "verified", createdAt: { gte: thirtyDaysAgo } } }),
  ]);

  return NextResponse.json({
    totalUsers,
    totalApiKeys,
    totalWorkerKeys,
    activeApiKeys,
    activeWorkerKeys,
    verificationsToday,
    verifications30d,
    verifiedToday,
    verified30d,
  });
}
