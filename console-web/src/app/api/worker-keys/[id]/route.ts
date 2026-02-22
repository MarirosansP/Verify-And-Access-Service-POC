/**
 * PATCH  /api/worker-keys/:id    → update key status (pause / revoke / activate)
 * DELETE /api/worker-keys/:id    → permanently delete a key
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import {
  updateWorkerKeyStatus,
  deleteWorkerKey,
} from "@/lib/worker-keys";

/* ---------- PATCH: update status ------------------------------------- */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const validStatuses = ["active", "paused", "revoked"];
  if (!body?.status || !validStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const updated = await updateWorkerKeyStatus(params.id, session.user.email, body.status);
  if (!updated) {
    return NextResponse.json({ error: "Key not found or cannot change status" }, { status: 404 });
  }

  return NextResponse.json({ key: updated });
}

/* ---------- DELETE ---------------------------------------------------- */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await deleteWorkerKey(params.id, session.user.email);
  if (!ok) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
