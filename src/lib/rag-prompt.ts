import type { RetrievalChunk } from "@/lib/retrieval";

const CONTEXT_TOKEN_CAP = 3000;

export interface Citation {
  n: number;
  documentId: string;
  documentSlug: string;
  documentTitle: string;
  categoryName: string | null;
  sourceUrl: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  sectionRef: string | null;
  snippet: string;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function formatPageRef(pageStart: number | null, pageEnd: number | null): string {
  if (!pageStart) return "";
  return pageEnd && pageEnd !== pageStart ? `pp. ${pageStart}-${pageEnd}` : `p. ${pageStart}`;
}

/**
 * Assembles the numbered context block fed to the model and the parallel
 * citations array (same [n] numbering) used for the streamed data part and
 * the persisted chat_messages.citations. Chunks arrive pre-ranked by
 * relevance (RRF score) — once the token budget is spent, stop rather than
 * skip ahead, since later chunks are strictly less relevant.
 */
export function buildContext(chunks: RetrievalChunk[]): { contextBlock: string; citations: Citation[] } {
  const citations: Citation[] = [];
  const blocks: string[] = [];
  let budget = 0;

  for (const chunk of chunks) {
    const tokens = chunk.tokenCount ?? estimateTokens(chunk.content);
    if (blocks.length > 0 && budget + tokens > CONTEXT_TOKEN_CAP) break;
    budget += tokens;

    const n = citations.length + 1;
    const pageRef = formatPageRef(chunk.pageStart, chunk.pageEnd);
    const sectionRef = chunk.sectionRef ? `, ${chunk.sectionRef}` : "";
    const locator = [sectionRef.replace(/^, /, ""), pageRef].filter(Boolean).join(" — ");

    blocks.push(`[${n}] ${chunk.documentTitle}${locator ? ` (${locator})` : ""}\n${chunk.content}`);
    citations.push({
      n,
      documentId: chunk.documentId,
      documentSlug: chunk.documentSlug,
      documentTitle: chunk.documentTitle,
      categoryName: chunk.categoryName,
      sourceUrl: chunk.sourceUrl,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      sectionRef: chunk.sectionRef,
      snippet: chunk.content.slice(0, 240),
    });
  }

  return { contextBlock: blocks.join("\n\n"), citations };
}

const BASE_SYSTEM_PROMPT = `You are Qanoon, an assistant that answers questions about Pakistan's federal statutes.

Rules:
- Answer strictly from the numbered context blocks below. Never use outside knowledge of Pakistani law.
- Cite every claim with the matching [n] marker, e.g. "Section 13 imposes a fine [2]." Cite inline, not just at the end.
- If the context does not cover the question, say so plainly rather than guessing or extrapolating.
- Never invent section numbers, penalties, or figures that are not explicitly present in the context.
- If a cited statute is old, note that it may have been amended since enactment and that this answer reflects the text on record, not necessarily the current legal position.
- This is not legal advice. Do not phrase answers as legal advice or recommendations to act.
- Keep answers plain and direct — the audience is ordinary readers, not lawyers.`;

export function buildSystemPrompt(contextBlock: string): string {
  if (!contextBlock) {
    return `${BASE_SYSTEM_PROMPT}\n\nNo relevant statute text was retrieved for this question. Say plainly that the corpus does not appear to cover it, and do not answer from outside knowledge.`;
  }
  return `${BASE_SYSTEM_PROMPT}\n\nContext:\n${contextBlock}`;
}
