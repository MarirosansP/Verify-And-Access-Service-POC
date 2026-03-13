import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { createResetToken } from "@/lib/reset-token";
import { sendPasswordResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(
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
    select: { id: true, email: true, name: true, isAdmin: true },
  });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (user.isAdmin) return NextResponse.json({ error: "cannot_reset_admin" }, { status: 403 });

  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
  const raw = await createResetToken(user.id);
  const resetUrl = `${appUrl}/reset-password?token=${raw}`;

  await sendPasswordResetEmail(user.email, resetUrl, user.name);

  return NextResponse.json({ ok: true });
}
