import { APICallError, generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { recordUsage } from "@/lib/usage";
import { countTokens } from "./tokenizer";
import type { ExtractedParagraph } from "./pdf-extract";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-5.6-luna";
// Same budget ingest/04a_export_extracts.py used for the original corpus's
// Claude-authored summaries — full text when it fits, otherwise head+tail
// (a simpler stand-in for 04a's CONTENTS/preamble/sections-1-3 heuristic,
// which was tuned for offline batch authoring, not a live per-upload path).
const MAX_EXTRACT_TOKENS = 6000;
const HEAD_TOKENS = 4000;
const TAIL_TOKENS = 2000;

const SummarySchema = z.object({
  summary: z.string().describe("A thorough plain-language summary of the statute, several paragraphs."),
  summaryShort: z.string().describe("A one-to-two sentence plain-language summary."),
  keyTopics: z.array(z.string()).describe("3-8 short topic tags (e.g. 'licensing', 'penalties')."),
  questions: z.array(z.string()).length(3).describe("3 natural questions a reader might ask about this statute."),
});

export type DocumentSummary = z.infer<typeof SummarySchema>;

/** Budgets the extracted paragraph stream down to a token cap for the summary prompt. */
export function buildExtractText(paragraphs: ExtractedParagraph[]): string {
  const full = paragraphs.map((p) => p.text).join("\n\n");
  if (countTokens(full) <= MAX_EXTRACT_TOKENS) return full;

  const head: string[] = [];
  let headTokens = 0;
  for (const p of paragraphs) {
    if (headTokens + p.tokens > HEAD_TOKENS) break;
    head.push(p.text);
    headTokens += p.tokens;
  }

  const tail: string[] = [];
  let tailTokens = 0;
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    if (tailTokens + paragraphs[i].tokens > TAIL_TOKENS) break;
    tail.unshift(paragraphs[i].text);
    tailTokens += paragraphs[i].tokens;
  }

  return `${head.join("\n\n")}\n\n[... omitted for length ...]\n\n${tail.join("\n\n")}`;
}

const SYSTEM_PROMPT = `You summarize Pakistani federal statutes for ordinary readers, not lawyers.

Rules:
- Plain language. No legal jargon left unexplained.
- Name specific sections when describing what they do (e.g. "Section 5 requires...").
- If the statute appears old or likely amended/repealed since enactment, say so rather than presenting it as current law.
- Never state a specific penalty, fee, or time period unless it is explicitly present in the text given to you.
- summary: several paragraphs, thorough. summaryShort: one to two sentences.
- questions: exactly 3, phrased the way a curious reader would actually ask them (not "What does Section 5 say?").`;

function isFlexCapacityError(error: unknown): boolean {
  return APICallError.isInstance(error) && error.statusCode === 429;
}

/** Generates summary/short-summary/key-topics/suggested-questions for a newly ingested document. */
export async function generateDocumentSummary(
  documentId: string,
  title: string,
  instrumentType: string | null,
  extractText: string
): Promise<DocumentSummary> {
  const prompt = `Statute title: ${title}${instrumentType ? ` (${instrumentType})` : ""}

Full text (or a head+tail excerpt if long):
${extractText}`;

  const run = (serviceTier: "flex" | "auto") =>
    generateObject({
      model: openai(CHAT_MODEL),
      schema: SummarySchema,
      system: SYSTEM_PROMPT,
      prompt,
      providerOptions: { openai: { serviceTier } },
    });

  // Same flex-capacity fallback the chat route uses: flex is cheaper but can
  // 429 when OpenAI has no spare capacity, worth exactly one retry at
  // standard pricing rather than giving up.
  let result;
  try {
    result = await run("flex");
  } catch (error) {
    if (!isFlexCapacityError(error)) throw error;
    result = await run("auto");
  }

  await recordUsage({
    provider: "openai",
    model: CHAT_MODEL,
    operation: "summary",
    documentId,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    reasoningTokens: result.usage.outputTokenDetails?.reasoningTokens ?? 0,
  });

  return result.object;
}
