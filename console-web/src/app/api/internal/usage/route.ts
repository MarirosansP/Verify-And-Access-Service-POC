import { prisma } from "@/lib/db";
import { z } from "zod";

export async function POST(req: Request) {
  const schema = z.object({
    sharedSecret: z.string(),
    userId: z.string(),
    apiKeyId: z.string(),
    endpoint: z.string(),
    statusCode: z.number().int(),
    durationMs: z.number().int(),
    merchantOrigin: z.string().optional()
  });
  const body = schema.parse(await req.json());

  const expected = process.env.USAGE_SHARED_SECRET || "";
  if (!expected || body.sharedSecret !== expected) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.usageEvent.create({
    data: {
      userId: body.userId,
      apiKeyId: body.apiKeyId,
      endpoint: body.endpoint,
      statusCode: body.statusCode,
      durationMs: body.durationMs,
      merchantOrigin: body.merchantOrigin || null
    }
  });

  await prisma.apiKey.update({
    where: { id: body.apiKeyId },
    data: { lastUsedAt: new Date() }
  });

  return Response.json({ ok: true });
}
