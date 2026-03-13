import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
nexport const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2).optional()
  });
  const { email, password, name } = schema.parse(body);

  const lower = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: lower } });
  if (existing) return Response.json({ error: "email_in_use" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email: lower, passwordHash, name: name || null }
  });

  return Response.json({ ok: true, userId: user.id });
}
