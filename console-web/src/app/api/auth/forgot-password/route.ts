import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createResetToken } from "@/lib/reset-token";
import { sendPasswordResetEmail } from "@/lib/email";
nexport const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, email: true, name: true, isFrozen: true },
  });

  // Always return success to prevent email enumeration
  if (!user || user.isFrozen) {
    return NextResponse.json({ ok: true });
  }

  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
  const raw = await createResetToken(user.id);
  const resetUrl = `${appUrl}/reset-password?token=${raw}`;

  await sendPasswordResetEmail(user.email, resetUrl, user.name).catch(err =>
    console.error("[forgot-password] Failed to send email:", err.message)
  );

  return NextResponse.json({ ok: true });
}
