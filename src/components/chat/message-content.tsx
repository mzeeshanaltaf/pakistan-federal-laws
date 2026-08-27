"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationPill } from "./citation-pill";
import type { Citation } from "@/lib/rag-prompt";

interface MessageContentProps {
  text: string;
  citations: Citation[];
  // Optional so this component can be rendered from a Server Component (the
  // landing page's static example) — functions can't cross that boundary.
  onOpenCitation?: (citation: Citation) => void;
}

const CITATION_RE = /\[(\d+)\]/g;

export function MessageContent({ text, citations, onOpenCitation }: MessageContentProps) {
  const citationMap = new Map(citations.map((c) => [c.n, c]));

  // Citation.n reflects retrieval rank (relevance order), not the order the
  // model actually references sources in its prose — so raw markers can read
  // [5], [2], [7]... in the finished answer. Renumber by first-appearance
  // order in the text instead, so the reader sees 1, 2, 3... A repeated
  // marker for the same underlying citation keeps the same display number.
  const displayNumberByOriginal = new Map<number, number>();
  for (const match of text.matchAll(CITATION_RE)) {
    const n = Number(match[1]);
    if (citationMap.has(n) && !displayNumberByOriginal.has(n)) {
      displayNumberByOriginal.set(n, displayNumberByOriginal.size + 1);
    }
  }

  // Rewrite bare [n] markers into markdown links on a fragment href so
  // ReactMarkdown's `a` renderer can intercept them and swap in a pill —
  // simpler and more robust than a custom remark AST transform. A custom URI
  // scheme (e.g. "qanoon-citation:5") gets silently stripped to href="" by
  // react-markdown's URL sanitizer; a "#..." fragment is always allowed
  // through. The href keeps the original n (a stable, unique lookup key into
  // citationMap); only the visible link text is the renumbered display value.
  const processed = text.replace(CITATION_RE, (match, num) => {
    const n = Number(num);
    const displayN = displayNumberByOriginal.get(n);
    return displayN !== undefined ? `[${displayN}](#qanoon-citation-${n})` : match;
  });

  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) => {
            if (href?.startsWith("#qanoon-citation-")) {
              const n = Number(href.replace("#qanoon-citation-", ""));
              const citation = citationMap.get(n);
              const displayN = displayNumberByOriginal.get(n);
              if (citation && displayN !== undefined) {
                return <CitationPill n={displayN} onClick={() => onOpenCitation?.(citation)} />;
              }
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-primary"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
