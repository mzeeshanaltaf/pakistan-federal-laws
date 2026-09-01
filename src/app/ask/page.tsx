import type { Metadata } from "next";
import { AskAppLoader } from "./ask-app-loader";
import type { ChatScope } from "@/lib/chat-types";

export const metadata: Metadata = {
  title: "Ask",
  description: "Ask a question about any of Pakistan's 525 federal statutes and get a grounded, cited answer.",
  alternates: { canonical: "/ask" },
};

interface AskPageProps {
  searchParams: Promise<{ scope?: string; slug?: string; label?: string; sessionId?: string; q?: string }>;
}

export default async function AskPage({ searchParams }: AskPageProps) {
  const params = await searchParams;

  let initialScope: ChatScope | undefined;
  if (params.scope === "document" && params.slug) {
    initialScope = { type: "document", slug: params.slug, label: params.label ?? params.slug };
  } else if (params.scope === "category" && params.slug) {
    initialScope = { type: "category", slug: params.slug, label: params.label ?? params.slug };
  }

  return (
    <div className="flex flex-1 flex-col">
      {/*
        Server-rendered so a crawler (and a JS-disabled/slow-rendering visit)
        sees real content instead of a blank shell — the chat island below
        is unavoidably client-only (it reads localStorage during state
        init), so this exists to give the page an H1 and body text of its
        own rather than unwrapping that ssr:false boundary.
      */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 pb-2 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Ask Pakistan&apos;s federal statutes a question
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Ask about any of the 525 federal laws below, in plain language. Every answer is grounded strictly in
          the statute text and cited to the exact page you can check yourself.
        </p>
      </section>

      <AskAppLoader initialScope={initialScope} initialSessionId={params.sessionId} initialQuestion={params.q} />
    </div>
  );
}
