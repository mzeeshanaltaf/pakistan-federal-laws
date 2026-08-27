"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { MessageContent } from "@/components/chat/message-content";
import type { AdminUserConversation, AdminConversationMessage } from "@/lib/admin-user-detail-queries";

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminUserConversations({
  userId,
  conversations,
}: {
  userId: string;
  conversations: AdminUserConversation[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, AdminConversationMessage[] | "loading" | "error">>({});

  async function toggle(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (cache[id]) return;
    setCache((prev) => ({ ...prev, [id]: "loading" }));
    try {
      const res = await fetch(`/api/admin/users/${userId}/conversations/${id}/messages`);
      if (!res.ok) throw new Error();
      const data: { messages: AdminConversationMessage[] } = await res.json();
      setCache((prev) => ({ ...prev, [id]: data.messages }));
    } catch {
      setCache((prev) => ({ ...prev, [id]: "error" }));
    }
  }

  if (conversations.length === 0) {
    return <p className="text-sm text-muted-foreground">This user hasn&apos;t started any conversations yet.</p>;
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {conversations.map((conversation) => {
        const isOpen = expandedId === conversation.id;
        const messages = cache[conversation.id];
        return (
          <div key={conversation.id}>
            <button
              type="button"
              onClick={() => toggle(conversation.id)}
              className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-muted/40"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isOpen ? (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate font-medium text-foreground">{conversation.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                <span>{conversation.messageCount} messages</span>
                <span className="tabular-nums">{formatDate(conversation.updatedAt)}</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-border bg-muted/20 px-4 py-4">
                {messages === "loading" || messages === undefined ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading transcript…
                  </div>
                ) : messages === "error" ? (
                  <p className="py-4 text-sm text-destructive">Couldn&apos;t load this conversation.</p>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) =>
                      message.role === "user" ? (
                        <div key={message.id} className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                            {message.content}
                          </div>
                        </div>
                      ) : (
                        <div key={message.id} className="max-w-[85%] rounded-2xl rounded-bl-sm bg-background px-4 py-3">
                          <MessageContent text={message.content} citations={message.citations} />
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
