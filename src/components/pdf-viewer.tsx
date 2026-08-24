"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

// Self-hosted per Phase 0 (public/pdf.worker.min.mjs) rather than a CDN URL,
// which breaks in some deploy environments.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;

interface PdfViewerProps {
  fileUrl: string;
  initialPage?: number;
}

export function PdfViewer({ fileUrl, initialPage = 1 }: PdfViewerProps) {
  // Callers key this component by fileUrl/initialPage (see CitationPanel) so
  // switching citations remounts it — a fresh mount resets this state
  // naturally, no effect-based reset needed.
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [zoom, setZoom] = useState(1.0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure available width ONCE via a zero-height sentinel div. Disconnect
  // immediately after the first non-zero reading — otherwise the canvas
  // expanding on zoom re-triggers the observer, which grows containerWidth,
  // which expands the canvas again: an infinite zoom loop.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      if (w > 0) {
        setContainerWidth(w);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pageWidth = containerWidth > 0 ? Math.round(containerWidth * zoom) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {numPages > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((p) => p - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="tabular-nums">
                Page {pageNumber} of {numPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={pageNumber >= numPages}
                onClick={() => setPageNumber((p) => p + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={zoom <= ZOOM_MIN}
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={zoom >= ZOOM_MAX}
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="h-0 w-full" aria-hidden />

      <div
        className="max-h-[65vh] overflow-auto rounded-md border border-border bg-muted/20"
        style={{ width: containerWidth > 0 ? containerWidth : "100%" }}
      >
        {loadError ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
            <p>The preview couldn&apos;t load.</p>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Open the source PDF directly
            </a>
          </div>
        ) : (
          <>
            {loading && (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages }) => {
                setNumPages(numPages);
                setLoading(false);
              }}
              onLoadError={() => {
                setLoading(false);
                setLoadError(true);
              }}
              loading={null}
            >
              {pageWidth > 0 && (
                <Page pageNumber={pageNumber} width={pageWidth} renderAnnotationLayer={false} renderTextLayer />
              )}
            </Document>
          </>
        )}
      </div>
    </div>
  );
}
