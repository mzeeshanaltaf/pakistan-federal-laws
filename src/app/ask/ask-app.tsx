"use client";

import { useEffect, useRef, useState } from "react";
import { ScopeSelector, type CatalogCategory, type CatalogDocument } from "@/components/scope-selector";
import { SuggestedQuestions } from "@/components/chat/suggested-questions";
import { ChatThread, type ChatThreadHandle } from "@/components/chat/chat-thread";
import { CitationPanel } from "@/components/chat/citation-panel";
import { getOrCreateAnonId } from "@/lib/anon-id";
import type { ChatScope } from "@/lib/chat-types";
import type { Citation } from "@/lib/rag-prompt";

interface CatalogResponse {
  categories: CatalogCategory[];
  documents: CatalogDocument[];
}

const DEFAULT_SCOPE: ChatScope = { type: "all", label: "All laws" };

interface AskAppProps {
  initialScope?: ChatScope;
}

export function AskApp({ initialScope }: AskAppProps) {
  const [anonId] = useState(() => getOrCreateAnonId());
  const [scope, setScope] = useState<ChatScope>(initialScope ?? DEFAULT_SCOPE);
  const [catalog, setCatalog] = useState<CatalogResponse>({ categories: [], documents: [] });
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const chatRef = useRef<ChatThreadHandle>(null);
  const scopeKey = `${scope.type}:${scope.slug ?? ""}`;

  useEffect(() => {
    fetch("/api/catalog")
      .then((res) => res.json())
      .then((data: CatalogResponse) => setCatalog(data))
      .catch(() => setCatalog({ categories: [], documents: [] }));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
      <div className="flex flex-col gap-4 border-b border-border py-5">
        <ScopeSelector
          categories={catalog.categories}
          documents={catalog.documents}
          scope={scope}
          onScopeChange={setScope}
        />
        <SuggestedQuestions key={scopeKey} scope={scope} onSelect={(q) => chatRef.current?.ask(q)} />
      </div>

      <div className="flex flex-1 gap-6">
        <div className="flex flex-1 flex-col overflow-hidden">
          <ChatThread
            key={scopeKey}
            ref={chatRef}
            anonId={anonId}
            scope={scope}
            onOpenCitation={setActiveCitation}
          />
        </div>

        {activeCitation && <CitationPanel citation={activeCitation} onClose={() => setActiveCitation(null)} />}
      </div>
    </div>
  );
}
