"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChatSessionSummary } from "@/app/api/chat/sessions/route";

function sessionAskUrl(session: ChatSessionSummary): string {
  const params = new URLSearchParams({ sessionId: session.id });
  if (session.scopeType !== "all" && session.scopeId) {
    params.set("scope", session.scopeType);
    params.set("slug", session.scopeId);
    params.set("label", session.label);
  }
  return `/ask?${params.toString()}`;
}

interface ChatHistorySidebarProps {
  activeSessionId?: string;
}

export function ChatHistorySidebar({ activeSessionId }: ChatHistorySidebarProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const signedIn = !isPending && !!session;
  const [sessions, setSessions] = useState<ChatSessionSummary[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatSessionSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;

    function load() {
      fetch("/api/chat/sessions")
        .then((res) => res.json())
        .then((data: { sessions?: ChatSessionSummary[] }) => {
          if (!cancelled) setSessions(data.sessions ?? []);
        })
        .catch(() => {
          if (!cancelled) setSessions([]);
        });
    }

    load();
    // Picks up sessions created or updated since the last load (e.g. after
    // asking a question) without wiring a cross-component refresh callback.
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", load);
    };
  }, [signedIn]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/chat/sessions/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Could not delete this conversation.");
        return;
      }
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== deleteTarget.id) : prev));
      const wasActive = deleteTarget.id === activeSessionId;
      setDeleteTarget(null);
      if (wasActive) router.push("/ask");
    } finally {
      setDeleting(false);
    }
  }

  if (!signedIn) return null;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border pr-4 md:flex">
      <h2 className="px-2 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Chat history
      </h2>
      <div className="flex-1 overflow-y-auto">
        {sessions === null ? null : sessions.length === 0 ? (
          <p className="px-2 py-1 text-sm text-muted-foreground">Your past conversations will show up here.</p>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((s) => (
              <li key={s.id} className="group/item relative">
                <Link
                  href={sessionAskUrl(s)}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-lg px-2 py-2 pr-8 text-sm hover:bg-muted",
                    s.id === activeSessionId && "bg-muted"
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate font-medium text-foreground">
                    <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{s.title}</span>
                  </span>
                  <span className="truncate pl-5 text-xs text-muted-foreground">{s.label}</span>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete conversation"
                  className="absolute top-1.5 right-1 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    setDeleteTarget(s);
                  }}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(next) => !next && !deleting && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              This permanently deletes &ldquo;{deleteTarget?.title}&rdquo; and its messages. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
