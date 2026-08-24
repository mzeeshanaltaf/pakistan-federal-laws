import type { Metadata } from "next";
import { AskAppLoader } from "./ask-app-loader";
import type { ChatScope } from "@/lib/chat-types";

export const metadata: Metadata = {
  title: "Ask",
  description: "Ask a question about any of Pakistan's 525 federal statutes and get a grounded, cited answer.",
};

interface AskPageProps {
  searchParams: Promise<{ scope?: string; slug?: string; label?: string }>;
}

export default async function AskPage({ searchParams }: AskPageProps) {
  const params = await searchParams;

  let initialScope: ChatScope | undefined;
  if (params.scope === "document" && params.slug) {
    initialScope = { type: "document", slug: params.slug, label: params.label ?? params.slug };
  } else if (params.scope === "category" && params.slug) {
    initialScope = { type: "category", slug: params.slug, label: params.label ?? params.slug };
  }

  return <AskAppLoader initialScope={initialScope} />;
}
