"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { ChatScope } from "@/lib/chat-types";

// The session id / localStorage-backed anon id are client-only, so the whole
// surface loads client-side — must live in a Client Component, per the same
// next/dynamic + ssr:false constraint as pdf-viewer-loader.tsx.
const AskApp = dynamic(() => import("./ask-app").then((m) => ({ default: m.AskApp })), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

export function AskAppLoader({
  initialScope,
  initialSessionId,
}: {
  initialScope?: ChatScope;
  initialSessionId?: string;
}) {
  // AskApp seeds its scope/session state from these props only on mount, so a
  // client-side navigation to a new sidebar/dashboard deep link (same route,
  // new search params) would otherwise leave the already-mounted instance
  // showing stale content even though the URL changed. Keying by the deep
  // link's identity forces a fresh mount whenever it changes.
  const key = `${initialSessionId ?? "none"}:${initialScope?.type ?? "all"}:${initialScope?.slug ?? ""}`;
  return <AskApp key={key} initialScope={initialScope} initialSessionId={initialSessionId} />;
}
