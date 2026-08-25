import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Bookmark, MessageSquare, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { getBookmarkedMessages, getDashboardStats, type BookmarkedMessage } from "@/lib/dashboard-queries";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

function bookmarkAskUrl(bookmark: BookmarkedMessage): string {
  const params = new URLSearchParams({ sessionId: bookmark.sessionId });
  if (bookmark.scopeType !== "all" && bookmark.scopeId) {
    params.set("scope", bookmark.scopeType);
    params.set("slug", bookmark.scopeId);
    params.set("label", bookmark.label);
  }
  return `/ask?${params.toString()}`;
}

// Strips the light markdown emphasis assistant answers use (**bold**, [n]
// citation markers) for a clean plain-text preview line — this list doesn't
// render full markdown the way the chat thread does.
function previewText(content: string): string {
  return content.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\[\d+\]/g, "").trim();
}

export default async function DashboardPage() {
  // The real security boundary for this route — middleware.ts's cookie
  // check is a fast UX-level redirect, not a DB-verified session check.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const [stats, bookmarks] = await Promise.all([
    getDashboardStats(session.user.id),
    getBookmarkedMessages(session.user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-3 text-muted-foreground">Signed in as {session.user.email}.</p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MessageSquare className="size-4" />
            <span className="text-sm">Conversations</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.conversations}</p>
        </div>
        <div className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="size-4" />
            <span className="text-sm">Questions asked</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.questionsAsked}</p>
        </div>
        <div className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Bookmark className="size-4" />
            <span className="text-sm">Total tokens</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.totalTokens.toLocaleString()}</p>
        </div>
      </div>

      <h2 className="mt-14 text-xl font-semibold tracking-tight">Bookmarked messages</h2>

      {bookmarks.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Bookmark an answer from a conversation on{" "}
          <Link href="/ask" className="underline underline-offset-2 hover:text-primary">
            Ask
          </Link>{" "}
          to save it here.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {bookmarks.map((bookmark) => (
            <li key={bookmark.id} className="py-5">
              <Link href={bookmarkAskUrl(bookmark)} className="group block">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-medium text-foreground group-hover:text-primary">{bookmark.label}</h3>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {new Date(bookmark.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {previewText(bookmark.content)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
