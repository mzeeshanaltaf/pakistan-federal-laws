"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface ReasoningBlockProps {
  text: string;
  streaming: boolean;
}

// Auto-expanded while the model is still reasoning (so the user sees it
// thinking), then auto-collapses once the answer starts — matches the
// Claude-style collapsible reasoning trace. Manual toggling always wins
// after the user touches it once. The streaming->done transition is applied
// during render (React's "adjust state on prop change" pattern) rather than
// in an effect, to avoid an extra cascading render.
export function ReasoningBlock({ text, streaming }: ReasoningBlockProps) {
  const [open, setOpen] = useState(true);
  const [touched, setTouched] = useState(false);
  const [prevStreaming, setPrevStreaming] = useState(streaming);

  if (streaming !== prevStreaming) {
    setPrevStreaming(streaming);
    if (!streaming && !touched) setOpen(false);
  }

  if (!text) return null;

  return (
    <div className="mb-2 rounded-lg border border-border/60 bg-muted/30 text-muted-foreground">
      <button
        type="button"
        onClick={() => {
          setTouched(true);
          setOpen((v) => !v);
        }}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium"
      >
        <span>{streaming ? "Reasoning…" : "Reasoning"}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border/60 px-3 py-2 text-xs leading-relaxed">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
              ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-foreground/80">{children}</strong>,
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
