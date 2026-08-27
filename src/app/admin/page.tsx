import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CreditCard, MessageSquare, MessagesSquare, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { getPerUserStats, getPlatformTotals } from "@/lib/admin-queries";
import { AdminUserTable } from "@/components/admin/admin-user-table";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // The real security boundary for this route — middleware.ts's cookie
  // check is a fast UX-level redirect, not a DB-verified session/role check.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }
  if (session.user.role !== "admin") {
    notFound();
  }

  const [totals, users] = await Promise.all([getPlatformTotals(), getPerUserStats()]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-3 text-muted-foreground">Signed in as {session.user.email}.</p>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" />
            <span className="text-sm">Users</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{totals.totalUsers}</p>
        </div>
        <div className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MessagesSquare className="size-4" />
            <span className="text-sm">Conversations</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{totals.totalConversations}</p>
        </div>
        <div className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MessageSquare className="size-4" />
            <span className="text-sm">Messages</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{totals.totalMessages}</p>
        </div>
        <div className="rounded-xl border border-border p-5">
          <div className="text-sm text-muted-foreground">Tokens</div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{totals.totalTokens.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="size-4" />
            <span className="text-sm">Cost</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">${totals.totalCostUsd.toFixed(2)}</p>
        </div>
      </div>

      <h2 className="mt-14 text-xl font-semibold tracking-tight">Users</h2>
      <div className="mt-6">
        <AdminUserTable users={users} />
      </div>
    </div>
  );
}
