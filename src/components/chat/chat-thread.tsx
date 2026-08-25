"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageContent } from "./message-content";
import { MessageActions, type ReactionType } from "./message-actions";
import { ReasoningBlock } from "./reasoning-block";
import { TypingIndicator } from "./typing-indicator";
import { getOrCreateLocalId } from "@/lib/anon-id";
import type { ChatScope, QanoonUIMessage } from "@/lib/chat-types";
import type { Citation } from "@/lib/rag-prompt";

function getMessageText(message: QanoonUIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/**
 * Reads the data-message-id part first (live messages, written by the API
 * before streaming starts), falling back to Number(message.id) for
 * history-restored messages — rowToUIMessage sets id: String(row.id).
 */
function resolveDbMessageId(message: QanoonUIMessage): number | null {
  const idPart = message.parts.find((p) => p.type === "data-message-id");
  const fromPart = (idPart as { data?: number } | undefined)?.data;
  if (typeof fromPart === "number") return fromPart;
  const fromId = Number(message.id);
  return Number.isFinite(fromId) ? fromId : null;
}

function getMessageReasoningText(message: QanoonUIMessage): string {
  return message.parts
    .filter((p): p is { type: "reasoning"; text: string } => p.type === "reasoning")
    .map((p) => p.text)
    .join("");
}

export interface ChatThreadHandle {
  ask: (question: string) => void;
}

interface ChatThreadProps {
  anonId: string;
  scope: ChatScope;
  onOpenCitation: (citation: Citation) => void;
}

interface HistoryMessageRow {
  id: number;
  role: string;
  content: string;
  citations: Citation[] | null;
}

function rowToUIMessage(row: HistoryMessageRow): QanoonUIMessage {
  const parts: QanoonUIMessage["parts"] = [];
  if (row.role === "assistant") {
    if (row.citations === null) {
      // /api/chat only ever omits citations on insertMessage for the
      // stored-summary shortcut — that's the one signal we have left to
      // restore the "From the official summary" badge after a refresh.
      parts.push({ type: "data-source", data: { kind: "stored-summary" } });
    } else if (row.citations.length > 0) {
      parts.push({ type: "data-citations", data: row.citations });
    }
  }
  parts.push({ type: "text", text: row.content, state: "done" });
  return {
    id: String(row.id),
    role: row.role === "user" ? "user" : "assistant",
    parts,
  };
}

/**
 * Persists one session id per scope (localStorage) so a page refresh resumes
 * the same conversation instead of starting a blank one. A scope change still
 * gets a fresh session — ChatThread is remounted (keyed by scope) by AskApp.
 * A freshly-created id has no history to fetch, so it skips the round trip
 * (and the brief loading placeholder) entirely.
 */
function useRestoredSession(scope: ChatScope) {
  const storageKey = `qanoon-session:${scope.type}:${scope.slug ?? "all"}`;
  const [{ id: sessionId, isNew }] = useState(() => getOrCreateLocalId(storageKey));
  const [initialMessages, setInitialMessages] = useState<QanoonUIMessage[] | null>(isNew ? [] : null);
  const [initialReactions, setInitialReactions] = useState<Record<number, ReactionType[]>>({});

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    fetch(`/api/chat/history?sessionId=${sessionId}`)
      .then((res) => res.json())
      .then((data: { messages?: HistoryMessageRow[] }) => {
        if (!cancelled) {
          const rows = (data.messages ?? []).filter((row) => !(row.role === "assistant" && row.content === ""));
          setInitialMessages(rows.map(rowToUIMessage));
        }
      })
      .catch(() => {
        if (!cancelled) setInitialMessages([]);
      });
    fetch(`/api/chat/reactions?sessionId=${sessionId}`)
      .then((res) => res.json())
      .then((data: { reactions?: Record<number, ReactionType[]> }) => {
        if (!cancelled) setInitialReactions(data.reactions ?? {});
      })
      .catch(() => {
        // Reaction icons just start unset — non-critical, and MessageActions
        // still works from a clean state.
      });
    return () => {
      cancelled = true;
    };
    // sessionId/isNew are stable for this component's lifetime (one per scope mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { sessionId, initialMessages, initialReactions };
}

export const ChatThread = forwardRef<ChatThreadHandle, ChatThreadProps>(function ChatThread(
  { anonId, scope, onOpenCitation },
  ref
) {
  const { sessionId, initialMessages, initialReactions } = useRestoredSession(scope);

  if (initialMessages === null) {
    return <div className="flex-1" />;
  }

  return (
    <ChatThreadReady
      ref={ref}
      anonId={anonId}
      scope={scope}
      sessionId={sessionId}
      initialMessages={initialMessages}
      initialReactions={initialReactions}
      onOpenCitation={onOpenCitation}
    />
  );
});

interface ChatThreadReadyProps extends ChatThreadProps {
  sessionId: string;
  initialMessages: QanoonUIMessage[];
  initialReactions: Record<number, ReactionType[]>;
}

const ChatThreadReady = forwardRef<ChatThreadHandle, ChatThreadReadyProps>(function ChatThreadReady(
  { anonId, scope, sessionId, initialMessages, initialReactions, onOpenCitation },
  ref
) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const signedIn = !sessionPending && !!session;

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { anonId, scope },
      })
  );

  const { messages, sendMessage, status, error } = useChat<QanoonUIMessage>({
    id: sessionId,
    messages: initialMessages,
    transport,
  });

  const [input, setInput] = useState("");
  const [reactions, setReactions] = useState<Record<number, ReactionType[]>>(initialReactions);
  const busy = status === "submitted" || status === "streaming";

  // The assistant message often doesn't exist yet (or exists with no visible
  // text or reasoning, e.g. while citations stream ahead of tokens, or while
  // a reasoning part exists but hasn't received any text yet) for a moment
  // after submit — without an explicit indicator here the UI looks stuck.
  // Once reasoning text actually starts streaming, the reasoning block itself
  // communicates progress, so the generic indicator steps aside.
  const lastMessage = messages[messages.length - 1];
  const lastMessageHasReasoning = !!lastMessage && lastMessage.role === "assistant" && !!getMessageReasoningText(lastMessage);
  const showTypingIndicator =
    busy &&
    (!lastMessage || lastMessage.role === "user" || (!getMessageText(lastMessage) && !lastMessageHasReasoning));

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  useImperativeHandle(ref, () => ({
    ask: (question: string) => {
      if (!signedIn) {
        router.push("/sign-in");
        return;
      }
      submit(question);
    },
  }));

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto py-6">
        {messages.length === 0 && (
          <p className="max-w-lg text-sm text-muted-foreground">
            Ask a question about {scope.type === "all" ? "any of Pakistan's 525 federal statutes" : scope.label}.
            Answers are grounded in the statute text, with citations you can open and check yourself.
          </p>
        )}

        {messages.map((message) => {
          const citationsPart = message.parts.find((p) => p.type === "data-citations");
          const citations = (citationsPart as { data?: Citation[] } | undefined)?.data ?? [];
          const sourcePart = message.parts.find((p) => p.type === "data-source");
          const source = (sourcePart as { data?: { kind: "stored-summary" | "generated" } } | undefined)?.data;
          const text = message.parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("");
          const reasoningParts = message.parts.filter(
            (p): p is { type: "reasoning"; text: string; state?: "streaming" | "done" } => p.type === "reasoning"
          );
          const reasoningText = reasoningParts.map((p) => p.text).join("");
          const reasoningStreaming = reasoningParts.some((p) => p.state === "streaming");

          if (message.role === "user") {
            return (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {text}
                </div>
              </div>
            );
          }

          if (!text && !reasoningText) return null;

          const dbMessageId = resolveDbMessageId(message);

          return (
            <div key={message.id} className="max-w-[85%]">
              <ReasoningBlock text={reasoningText} streaming={reasoningStreaming} />
              {text && (
                <>
                  {source?.kind === "stored-summary" && (
                    <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                      <Sparkles className="size-3" />
                      From the official summary
                    </div>
                  )}
                  <MessageContent text={text} citations={citations} onOpenCitation={onOpenCitation} />
                  {dbMessageId !== null && (
                    <MessageActions
                      messageId={dbMessageId}
                      text={text}
                      reactions={reactions[dbMessageId] ?? []}
                      onReactionsChange={(next) =>
                        setReactions((prev) => ({ ...prev, [dbMessageId]: next }))
                      }
                    />
                  )}
                </>
              )}
            </div>
          );
        })}

        {showTypingIndicator && (
          <div className="max-w-[85%]">
            <TypingIndicator />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">Something went wrong answering that. Try asking again.</p>
        )}
      </div>

      {signedIn ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex items-end gap-2 border-t border-border pt-4"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder={`Ask about ${scope.type === "all" ? "any federal law" : scope.label}...`}
            rows={1}
            className="max-h-40 min-h-11 flex-1 resize-none"
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send question">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </Button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">Sign in to ask a question.</p>
          <Button size="sm" nativeButton={false} render={<Link href="/sign-in" />}>
            Sign in
          </Button>
        </div>
      )}
    </div>
  );
});
