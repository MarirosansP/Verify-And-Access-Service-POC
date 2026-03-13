import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
nexport const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const download = searchParams.get("download"); // "csv" | "json" | null
  const take = 20;
  const skip = (page - 1) * take;

  const where = {
    userId,
    ...(search ? {
      OR: [
        { siteName: { contains: search } },
        { siteUrl: { contains: search } },
        { auditRecordId: { contains: search } },
      ],
    } : {}),
  };

  if (download === "json") {
    const records = await prisma.verificationRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, sessionId: true, challenge: true, siteName: true, siteUrl: true,
        status: true, auditRecordId: true, presentationJson: true, failureReason: true, createdAt: true,
      },
    });
    const body = JSON.stringify(records, null, 2);
    return new Response(body, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="verification-history-${Date.now()}.json"`,
      },
    });
  }

  if (download === "csv") {
    const records = await prisma.verificationRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, sessionId: true, challenge: true, siteName: true, siteUrl: true,
        status: true, auditRecordId: true, failureReason: true, createdAt: true,
      },
    });
    const headers = ["id", "sessionId", "challenge", "siteName", "siteUrl", "status", "auditRecordId", "failureReason", "createdAt"];
    const rows = records.map(r =>
      headers.map(h => {
        const val = (r as any)[h];
        if (val === null || val === undefined) return "";
        const s = String(val instanceof Date ? val.toISOString() : val);
        return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="verification-history-${Date.now()}.csv"`,
      },
    });
  }

  const [records, total] = await Promise.all([
    prisma.verificationRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true, sessionId: true, challenge: true, siteName: true, siteUrl: true,
        status: true, auditRecordId: true, presentationJson: true, failureReason: true, createdAt: true,
      },
    }),
    prisma.verificationRecord.count({ where }),
  ]);

  return NextResponse.json({ records, total, page, pages: Math.ceil(total / take) });
}
