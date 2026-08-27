import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { getAdminUserDetail, getUserConversations, getUserDetailStats } from "@/lib/admin-user-detail-queries";
import { getBookmarkedMessages } from "@/lib/dashboard-queries";
import { AdminUserTabs } from "@/components/admin/admin-user-tabs";
import { AdminUserProfile } from "@/components/admin/admin-user-profile";
import { AdminUserConversations } from "@/components/admin/admin-user-conversations";
import { AdminUserBookmarks } from "@/components/admin/admin-user-bookmarks";
import { AdminUserTokens } from "@/components/admin/admin-user-tokens";

export const metadata: Metadata = {
  title: "User detail — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // The real security boundary for this route — middleware.ts's cookie check
  // is a fast UX-level redirect, not a DB-verified session/role check.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }
  if (session.user.role !== "admin") {
    notFound();
  }

  const { id } = await params;
  const user = await getAdminUserDetail(id);
  if (!user) {
    notFound();
  }

  const [stats, conversations, bookmarks] = await Promise.all([
    getUserDetailStats(id),
    getUserConversations(id),
    getBookmarkedMessages(id),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to admin
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{user.name ?? user.email}</h1>

      <div className="mt-8">
        <AdminUserTabs
          profile={<AdminUserProfile user={user} viewerIsSelf={session.user.id === user.id} />}
          history={<AdminUserConversations userId={user.id} conversations={conversations} />}
          bookmarks={<AdminUserBookmarks bookmarks={bookmarks} />}
          tokens={<AdminUserTokens stats={stats} />}
        />
      </div>
    </div>
  );
}
