import { prisma } from "@/lib/db";
import { verifyKey } from "@/lib/keys";
import { z } from "zod";

export async function POST(req: Request) {
  const schema = z.object({ apiKey: z.string().min(10) });
  const { apiKey } = schema.parse(await req.json());

  const prefix = apiKey.slice(0, 12);
  const row = await prisma.apiKey.findUnique({
    where: { prefix },
    select: { id: true, userId: true, status: true, keyHash: true }
  });

  if (!row) return Response.json({ valid: false });

  const ok = await verifyKey(apiKey, row.keyHash);
  if (!ok) return Response.json({ valid: false });

  return Response.json({ valid: true, status: row.status, userId: row.userId, apiKeyId: row.id });
}
