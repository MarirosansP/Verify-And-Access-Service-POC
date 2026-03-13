/**
 * GET  /api/worker-keys         → list keys for logged-in account
 * POST /api/worker-keys         → create a new worker key
 *
 * Both require a valid NextAuth session.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import {
  listWorkerKeys,
  createWorkerKey,
} from "@/lib/worker-keys";

export const dynamic = "force-dynamic";

/* ---------- GET: list ------------------------------------------------ */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await listWorkerKeys(session.user.email);
  return NextResponse.json({ keys });
}

/* ---------- POST: create --------------------------------------------- */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.siteName || !body?.siteUrl) {
    return NextResponse.json(
      { error: "siteName and siteUrl are required" },
      { status: 400 }
    );
  }

  // Basic URL validation
  try {
    new URL(body.siteUrl);
  } catch {
    return NextResponse.json({ error: "Invalid siteUrl" }, { status: 400 });
  }

  const callbackPath = body.callbackPath || "/";
  const wk = await createWorkerKey(
    session.user.email,
    body.siteName,
    body.siteUrl,
    callbackPath
  );

  // Return the full key ONCE (the raw `key` field).  After this the
  // raw key is never retrievable again — only the hash is stored.
  return NextResponse.json({
    id: wk.id,
    key: wk.key,                   // ← show this once
    siteName: wk.siteName,
    siteUrl: wk.siteUrl,
    callbackPath: wk.callbackPath,
    status: wk.status,
    createdAt: wk.createdAt,
  }, { status: 201 });
}
