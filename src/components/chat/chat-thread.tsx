"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageContent } from "./message-content";
import type { ChatScope, QanoonUIMessage } from "@/lib/chat-types";
import type { Citation } from "@/lib/rag-prompt";

export interface ChatThreadHandle {
  ask: (question: string) => void;
}

interface ChatThreadProps {
  anonId: string;
  scope: ChatScope;
  onOpenCitation: (citation: Citation) => void;
}

export const ChatThread = forwardRef<ChatThreadHandle, ChatThreadProps>(function ChatThread(
  { anonId, scope, onOpenCitation },
  ref
) {
  // Callers key this component by scope (see AskApp), so a scope change
  // remounts it fresh with a new session rather than reusing one across topics.
  const [sessionId] = useState(() => crypto.randomUUID());
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { anonId, scope },
      })
  );

  const { messages, sendMessage, status, error } = useChat<QanoonUIMessage>({
    id: sessionId,
    transport,
  });

  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  useImperativeHandle(ref, () => ({
    ask: (question: string) => submit(question),
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

          if (message.role === "user") {
            return (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {text}
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className="max-w-[85%]">
              {source?.kind === "stored-summary" && (
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  <Sparkles className="size-3" />
                  From the official summary
                </div>
              )}
              {text ? (
                <MessageContent text={text} citations={citations} onOpenCitation={onOpenCitation} />
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Reading the statutes...
                </div>
              )}
            </div>
          );
        })}

        {error && (
          <p className="text-sm text-destructive">Something went wrong answering that. Try asking again.</p>
        )}
      </div>

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
    </div>
  );
});
