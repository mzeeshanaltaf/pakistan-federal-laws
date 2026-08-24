import type { UIMessage } from "ai";
import type { Citation } from "@/lib/rag-prompt";

// Custom data parts streamed alongside chat text: citations render the
// reference rail, source flags whether the answer came from the LLM or the
// zero-cost stored-summary shortcut.
export type QanoonUIMessage = UIMessage<
  never,
  {
    citations: Citation[];
    source: { kind: "stored-summary" | "generated" };
  }
>;

export interface ChatScope {
  type: "all" | "category" | "document";
  slug?: string;
  label: string;
}
