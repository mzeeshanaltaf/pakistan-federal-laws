"use client";

import { useEffect, useState } from "react";
import type { ChatScope } from "@/lib/chat-types";

interface SuggestedQuestionsProps {
  scope: ChatScope;
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export function SuggestedQuestions({ scope, onSelect, disabled }: SuggestedQuestionsProps) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Callers key this component by scope (see AskApp) so a scope change
  // remounts it fresh — loading starts true from useState above, no
  // effect-based reset needed.
  useEffect(() => {
    const scopeParam = scope.type === "all" ? "all" : `${scope.type}:${scope.slug}`;
    let cancelled = false;
    fetch(`/api/suggestions?scope=${encodeURIComponent(scopeParam)}`)
      .then((res) => res.json())
      .then((data: { questions?: string[] }) => {
        if (!cancelled) setQuestions(data.questions ?? []);
      })
      .catch(() => {
        if (!cancelled) setQuestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope.type, scope.slug]);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-40 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
    );
  }

  if (questions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((q) => (
        <button
          key={q}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(q)}
          className="rounded-full border border-border bg-card px-3.5 py-1.5 text-left text-sm text-foreground/90 transition-colors hover:border-primary/40 hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
