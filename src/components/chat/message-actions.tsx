"use client";

import { useState } from "react";
import { Bookmark, Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ReactionType = "thumbs_up" | "thumbs_down" | "bookmark";

interface MessageActionsProps {
  messageId: number;
  text: string;
  reactions: ReactionType[];
  onReactionsChange: (next: ReactionType[]) => void;
}

function nextReactions(current: ReactionType[], type: ReactionType): ReactionType[] {
  if (current.includes(type)) {
    return current.filter((r) => r !== type);
  }
  if (type === "bookmark") {
    return [...current, type];
  }
  const opposite: ReactionType = type === "thumbs_up" ? "thumbs_down" : "thumbs_up";
  return [...current.filter((r) => r !== opposite), type];
}

export function MessageActions({ messageId, text, reactions, onReactionsChange }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function toggle(type: ReactionType) {
    const previous = reactions;
    onReactionsChange(nextReactions(reactions, type));
    try {
      const res = await fetch(`/api/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType: type }),
      });
      if (!res.ok) throw new Error("reaction request failed");
    } catch {
      onReactionsChange(previous);
    }
  }

  return (
    <div className="mt-1.5 flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Copy message"
        onClick={copy}
        className="text-muted-foreground"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Thumbs up"
        aria-pressed={reactions.includes("thumbs_up")}
        onClick={() => toggle("thumbs_up")}
        className={cn("text-muted-foreground", reactions.includes("thumbs_up") && "text-primary")}
      >
        <ThumbsUp className={cn("size-3.5", reactions.includes("thumbs_up") && "fill-current")} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Thumbs down"
        aria-pressed={reactions.includes("thumbs_down")}
        onClick={() => toggle("thumbs_down")}
        className={cn("text-muted-foreground", reactions.includes("thumbs_down") && "text-primary")}
      >
        <ThumbsDown className={cn("size-3.5", reactions.includes("thumbs_down") && "fill-current")} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Bookmark"
        aria-pressed={reactions.includes("bookmark")}
        onClick={() => toggle("bookmark")}
        className={cn("text-muted-foreground", reactions.includes("bookmark") && "text-primary")}
      >
        <Bookmark className={cn("size-3.5", reactions.includes("bookmark") && "fill-current")} />
      </Button>
    </div>
  );
}
