import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

async function checkService(url: string, timeoutMs = 4000): Promise<{ status: "ok" | "error"; latencyMs: number; detail?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    const latencyMs = Date.now() - start;
    if (resp.ok) return { status: "ok", latencyMs };
    return { status: "error", latencyMs, detail: `HTTP ${resp.status}` };
  } catch (err: any) {
    return { status: "error", latencyMs: Date.now() - start, detail: err.message };
  }
}

export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const GATEWAY_URL = process.env.GATEWAY_INTERNAL_URL || "http://verify-gateway:3002";
  const VERIFIER_URL = process.env.VERIFIER_INTERNAL_URL || "http://credential-verifier:8000";

  // DB health
  const dbStart = Date.now();
  let db: { status: "ok" | "error"; latencyMs: number; detail?: string };
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err: any) {
    db = { status: "error", latencyMs: Date.now() - dbStart, detail: err.message };
  }

  const [gateway, verifier] = await Promise.all([
    checkService(`${GATEWAY_URL}/health`),
    checkService(`${VERIFIER_URL}/health`),
  ]);

  return NextResponse.json({ db, gateway, verifier });
}
