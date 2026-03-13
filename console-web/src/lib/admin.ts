import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/** Returns the session if the caller is an admin; throws a Response otherwise. */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!(session.user as any).isAdmin) {
    throw new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}
