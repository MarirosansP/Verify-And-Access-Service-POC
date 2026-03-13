import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string; keyId: string } }
) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const body = await req.json().catch(() => ({}));
  const { type, status } = body;

  if (!["api", "worker"].includes(type)) {
    return NextResponse.json({ error: "type must be 'api' or 'worker'" }, { status: 400 });
  }
  if (!["active", "paused"].includes(status)) {
    return NextResponse.json({ error: "status must be 'active' or 'paused'" }, { status: 400 });
  }

  if (type === "api") {
    const key = await prisma.apiKey.findFirst({
      where: { id: params.keyId, userId: params.userId },
      select: { id: true, status: true },
    });
    if (!key) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (key.status === "revoked") {
      return NextResponse.json({ error: "cannot_modify_revoked" }, { status: 409 });
    }
    await prisma.apiKey.update({ where: { id: params.keyId }, data: { status } });
  } else {
    const key = await prisma.workerKey.findFirst({
      where: { id: params.keyId, userId: params.userId },
      select: { id: true, status: true },
    });
    if (!key) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (key.status === "revoked") {
      return NextResponse.json({ error: "cannot_modify_revoked" }, { status: 409 });
    }
    await prisma.workerKey.update({ where: { id: params.keyId }, data: { status } });
  }

  return NextResponse.json({ ok: true, status });
}
