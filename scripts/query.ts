/**
 * Phase 6 retrieval verification harness — runs a fixed question set through
 * the same embed -> hybridSearch -> buildContext -> LLM path the /api/chat
 * route uses, but read-only (no chat_sessions/chat_messages/usage_events
 * writes), so it's safe to re-run at will while checking citation quality.
 *
 * Usage: npx tsx --env-file=.env.local scripts/query.ts
 */
import { embed, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { hybridSearch, resolveScope, type ScopeType } from "../src/lib/retrieval";
import { buildContext, buildSystemPrompt } from "../src/lib/rag-prompt";
import { pool } from "../src/lib/db";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-5.6-luna";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";

interface TestCase {
  question: string;
  scopeType: ScopeType;
  scopeSlug?: string;
  expectCategoryName?: string; // every citation's categoryName must equal this, when category-scoped
  expectDocumentSlug?: string; // every citation's documentSlug must equal this, when document-scoped
  expectDecline?: boolean;
}

const CASES: TestCase[] = [
  { question: "Punishment for carrying an unlicensed firearm?", scopeType: "all" },
  { question: "How much notice must a landlord give before eviction?", scopeType: "all" },
  { question: "Grounds for khula?", scopeType: "all" },
  { question: "What is the procedure for mutation of agricultural land ownership in Punjab?", scopeType: "all", expectDecline: true },
  { question: "Grounds for khula?", scopeType: "category", scopeSlug: "family-laws", expectCategoryName: "Family Laws" },
  { question: "How much notice must a landlord give?", scopeType: "category", scopeSlug: "rent-laws", expectCategoryName: "Rent Laws" },
  { question: "What does this Act say about penalties?", scopeType: "document", scopeSlug: "arms-act-1878", expectDocumentSlug: "arms-act-1878" },
];

async function runCase(tc: TestCase) {
  console.log(`\n${"=".repeat(80)}\nQ: ${tc.question}  [scope=${tc.scopeType}${tc.scopeSlug ? `:${tc.scopeSlug}` : ""}]`);

  const scopeFilter = await resolveScope(tc.scopeType, tc.scopeSlug);
  const { embedding } = await embed({ model: openai.embeddingModel(EMBED_MODEL), value: tc.question });
  const chunks = await hybridSearch(tc.question, embedding, scopeFilter);
  const { contextBlock, citations } = buildContext(chunks);

  console.log(`Retrieved ${chunks.length} chunks, ${citations.length} citations:`);
  for (const c of citations) {
    console.log(`  [${c.n}] ${c.documentTitle}${c.sectionRef ? ` (${c.sectionRef})` : ""} p.${c.pageStart}`);
  }

  const { text } = await generateText({
    model: openai(CHAT_MODEL),
    system: buildSystemPrompt(contextBlock),
    messages: [{ role: "user", content: tc.question }],
    providerOptions: { openai: { reasoningEffort: "medium" } },
  });

  console.log(`\nAnswer:\n${text}`);

  if (tc.expectCategoryName) {
    const offenders = citations.filter((c) => c.categoryName !== tc.expectCategoryName);
    if (offenders.length > 0) {
      console.error(`FAIL: citations outside category "${tc.expectCategoryName}": ${offenders.map((o) => `${o.documentTitle} (${o.categoryName})`).join(", ")}`);
    } else {
      console.log(`PASS: all citations within category "${tc.expectCategoryName}"`);
    }
  }

  if (tc.expectDocumentSlug) {
    const offenders = citations.filter((c) => c.documentSlug !== tc.expectDocumentSlug);
    if (offenders.length > 0) {
      console.error(`FAIL: citations outside document "${tc.expectDocumentSlug}": ${offenders.map((o) => o.documentSlug).join(", ")}`);
    } else {
      console.log(`PASS: all citations within document "${tc.expectDocumentSlug}"`);
    }
  }

  if (tc.expectDecline) {
    const declined = /don'?t (have|contain|cover)|not (cover|contain|address)|no relevant|outside|doesn'?t appear|cannot find|couldn'?t find|not available in|does not cover/i.test(text);
    console.log(declined ? "PASS: model appears to decline" : "CHECK MANUALLY: decline phrasing not auto-detected — read answer above");
  }
}

async function main() {
  for (const tc of CASES) {
    await runCase(tc);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
