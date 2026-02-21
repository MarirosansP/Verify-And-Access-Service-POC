import { prisma } from "@/lib/db";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const uid = session?.user ? (session.user as any).id : null;
  if (!uid) return Response.json({ error: "unauthorized" }, { status: 401 });

  const schema = z.object({ status: z.enum(["active", "paused", "revoked"]) });
  const { status } = schema.parse(await req.json());

  const key = await prisma.apiKey.findFirst({ where: { id: params.id, userId: uid } });
  if (!key) return Response.json({ error: "not_found" }, { status: 404 });

  await prisma.apiKey.update({ where: { id: params.id }, data: { status } });
  return Response.json({ ok: true });
}
