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

  // Rewrite bare [n] markers into markdown links on a fragment href so
  // ReactMarkdown's `a` renderer can intercept them and swap in a pill —
  // simpler and more robust than a custom remark AST transform. A custom URI
  // scheme (e.g. "qanoon-citation:5") gets silently stripped to href="" by
  // react-markdown's URL sanitizer; a "#..." fragment is always allowed
  // through.
  const processed = text.replace(CITATION_RE, (match, num) => {
    const n = Number(num);
    return citationMap.has(n) ? `[${n}](#qanoon-citation-${n})` : match;
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
              if (citation) {
                return <CitationPill n={n} onClick={() => onOpenCitation?.(citation)} />;
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
