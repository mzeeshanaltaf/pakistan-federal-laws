"use client";

import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/components/pdf-viewer-loader";
import type { Citation } from "@/lib/rag-prompt";

interface CitationPanelProps {
  citation: Citation;
  onClose: () => void;
}

export function CitationPanel({ citation, onClose }: CitationPanelProps) {
  const fileUrl = `/api/documents/${citation.documentSlug}/file`;

  return (
    <div
      role="dialog"
      aria-label={`Source: ${citation.documentTitle}`}
      className="animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 flex h-[88vh] flex-col rounded-t-2xl border-t border-border bg-background shadow-2xl duration-300 ease-out md:static md:z-auto md:h-full md:w-105 md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none md:slide-in-from-bottom-0"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{citation.documentTitle}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[citation.categoryName, citation.sectionRef, citation.pageStart ? `p. ${citation.pageStart}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close citation panel">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        <PdfViewer key={`${fileUrl}#${citation.pageStart ?? 1}`} fileUrl={fileUrl} initialPage={citation.pageStart ?? 1} />

        <div className="mt-4 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
          <p className="mb-2 font-medium text-foreground/80">Excerpt</p>
          <p className="leading-relaxed">{citation.snippet}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary underline underline-offset-2"
          >
            Open source PDF <ExternalLink className="size-3.5" />
          </a>
          {citation.sourceUrl && (
            <a
              href={citation.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              View on pakistancode.gov.pk <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
