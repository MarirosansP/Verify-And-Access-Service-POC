import { prisma } from "@/lib/db";
import { generateApiKeyRaw, hashKey } from "@/lib/keys";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const uid = session?.user ? (session.user as any).id : null;
  if (!uid) return Response.json({ error: "unauthorized" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: uid },
    select: { id: true, name: true, prefix: true, status: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" }
  });

  return Response.json({ keys });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const uid = session?.user ? (session.user as any).id : null;
  if (!uid) return Response.json({ error: "unauthorized" }, { status: 401 });

  const schema = z.object({ name: z.string().min(2) });
  const { name } = schema.parse(await req.json());

  const { raw, prefix } = generateApiKeyRaw();
  const keyHash = await hashKey(raw);

  const created = await prisma.apiKey.create({
    data: { userId: uid, name, prefix, keyHash, status: "active" },
    select: { id: true, name: true, prefix: true, status: true, createdAt: true }
  });

  // Raw key is returned ONCE
  return Response.json({ key: created, apiKey: raw });
}
