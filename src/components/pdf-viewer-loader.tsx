"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// pdfjs-dist crashes on the server, so it's loaded client-only. This must
// live in a Client Component — `ssr: false` isn't allowed on next/dynamic
// directly inside a Server Component.
export const PdfViewer = dynamic(() => import("@/components/pdf-viewer").then((m) => ({ default: m.PdfViewer })), {
  ssr: false,
  loading: () => (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
});
