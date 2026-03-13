import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) redirect("/login");
  if (!(session.user as any).isAdmin) redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", background: "#090E1A", color: "#e7edf7", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <nav style={{
        background: "#1B2735",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "0 24px",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src="/brand/concordium-logo-blue.svg" alt="Concordium" height="22" style={{ display: "block" }} />
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 18, fontWeight: 300 }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#FF4F4C", letterSpacing: "0.05em", textTransform: "uppercase" }}>Admin Console</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <NavLink href="/admin/dashboard">Dashboard</NavLink>
          <NavLink href="/admin/accounts">Accounts</NavLink>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />
          <Link href="/api/auth/signout" style={{ fontSize: 13, color: "#9FB2D3", textDecoration: "none", padding: "6px 10px", borderRadius: 6 }}>
            Sign out
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      fontSize: 13,
      color: "#9FB2D3",
      textDecoration: "none",
      padding: "6px 12px",
      borderRadius: 6,
      fontWeight: 500,
    }}>
      {children}
    </Link>
  );
}
