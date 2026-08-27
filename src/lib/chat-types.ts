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
    // node-postgres returns bigint/bigserial columns (chat_messages.id) as
    // strings, not numbers, so the assistantId written into this part at
    // runtime is actually a numeric string despite chat_messages.id being a
    // bigint — accept both.
    "message-id": number | string;
    // Only streamed for non-admin senders — admins have no credit limit.
    "credits-remaining": number;
  }
>;

export interface ChatScope {
  type: "all" | "category" | "document";
  slug?: string;
  label: string;
}
