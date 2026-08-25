import { NextRequest, NextResponse } from "next/server";
import {
  APICallError,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  embed,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { hybridSearch, resolveScope, type ScopeType } from "@/lib/retrieval";
import { isSummaryIntent } from "@/lib/intent";
import { buildContext, buildSystemPrompt } from "@/lib/rag-prompt";
import { recordUsage } from "@/lib/usage";
import type { QanoonUIMessage } from "@/lib/chat-types";

// pg + the AWS SDK (transitively, via other lib modules) need Node APIs.
export const runtime = "nodejs";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-5.6-luna";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";

interface ChatRequestBody {
  messages: QanoonUIMessage[];
  id: string;
  anonId: string;
  scope: { type: ScopeType; slug?: string };
}

interface DocSummaryRow {
  summary: string | null;
}

// Flex tier (~50% cheaper) can reject a request with a 429 when OpenAI has
// no spare capacity. Per OpenAI's guidance, that's the one case worth a
// one-shot retry at standard pricing rather than backing off and trying
// flex again: https://developers.openai.com/api/docs/guides/flex-processing
function isFlexCapacityError(error: unknown): boolean {
  return APICallError.isInstance(error) && error.statusCode === 429;
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

async function ensureSession(
  sessionId: string,
  anonId: string,
  userId: string,
  scope: { type: ScopeType; slug?: string }
): Promise<void> {
  await query(
    `INSERT INTO chat_sessions (id, anon_id, user_id, scope_type, scope_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET updated_at = now()`,
    [sessionId, anonId, userId, scope.type, scope.slug ?? null]
  );
}

async function insertMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  citations?: unknown
): Promise<number> {
  const rows = await query<{ id: number }>(
    `INSERT INTO chat_messages (session_id, role, content, citations) VALUES ($1,$2,$3,$4) RETURNING id`,
    [sessionId, role, content, citations ? JSON.stringify(citations) : null]
  );
  return rows[0].id;
}

async function updateMessageContent(id: number, content: string): Promise<void> {
  await query(`UPDATE chat_messages SET content = $1 WHERE id = $2`, [content, id]);
}

export async function POST(request: NextRequest) {
  // The real security boundary — the client-side disabled input is UX only.
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await checkRateLimit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { messages, id: sessionId, anonId, scope } = (await request.json()) as ChatRequestBody;

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const questionText = lastUserMessage ? getMessageText(lastUserMessage) : "";
  if (!questionText.trim()) {
    return NextResponse.json({ error: "Empty question" }, { status: 400 });
  }

  await ensureSession(sessionId, anonId, session.user.id, scope);
  await insertMessage(sessionId, "user", questionText);

  // --- Stored-summary shortcut: no embedding, no retrieval, no LLM call ---
  if (scope.type === "document" && scope.slug && isSummaryIntent(questionText)) {
    const docs = await query<DocSummaryRow>(`SELECT summary FROM documents WHERE slug = $1`, [scope.slug]);
    const summary = docs[0]?.summary;

    if (summary) {
      const assistantId = await insertMessage(sessionId, "assistant", summary);

      const stream = createUIMessageStream<QanoonUIMessage>({
        execute: ({ writer }) => {
          writer.write({ type: "start" });
          writer.write({ type: "data-source", data: { kind: "stored-summary" } });
          writer.write({ type: "data-message-id", data: assistantId });
          writer.write({ type: "text-start", id: "summary" });
          writer.write({ type: "text-delta", id: "summary", delta: summary });
          writer.write({ type: "text-end", id: "summary" });
        },
      });

      return createUIMessageStreamResponse({ stream });
    }
  }

  // --- Hybrid retrieval + LLM path ---
  const scopeFilter = await resolveScope(scope.type, scope.slug);

  const { embedding, usage: embedUsage } = await embed({
    model: openai.embeddingModel(EMBED_MODEL),
    value: questionText,
  });

  await recordUsage({
    provider: "openai",
    model: EMBED_MODEL,
    operation: "query_embedding",
    inputTokens: embedUsage.tokens,
    sessionId,
  });

  const chunks = await hybridSearch(questionText, embedding, scopeFilter);
  const { contextBlock, citations } = buildContext(chunks);
  // Inserted before streaming (not in onEnd) so the client gets the real
  // bigint id via a data-message-id part almost immediately — reactions
  // need it, and a live-streamed message's useChat id never matches
  // chat_messages.id otherwise. A failed generation leaves this row's
  // content empty (orphaned debris, filtered out of history reads).
  const assistantId = await insertMessage(sessionId, "assistant", "", citations);
  const modelMessages = await convertToModelMessages(messages);

  const buildChatStream = (serviceTier: "flex" | "auto") =>
    streamText({
      model: openai(CHAT_MODEL),
      system: buildSystemPrompt(contextBlock),
      messages: modelMessages,
      // Internal retries would just keep retrying flex; the fallback below
      // handles retrying at standard pricing explicitly.
      maxRetries: serviceTier === "flex" ? 0 : 2,
      providerOptions: {
        openai: { reasoningEffort: "medium", reasoningSummary: "auto", serviceTier },
      },
      onEnd: async ({ text, usage }) => {
        await updateMessageContent(assistantId, text);
        await recordUsage({
          provider: "openai",
          model: CHAT_MODEL,
          operation: "chat",
          sessionId,
          messageId: assistantId,
          inputTokens: usage.inputTokens ?? 0,
          cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
        });
      },
    });

  const stream = createUIMessageStream<QanoonUIMessage>({
    execute: async ({ writer }) => {
      // An explicit start part establishes the single message boundary up
      // front. Without it, the data parts below (written before streamText's
      // own implicit start) get treated as belonging to a separate message
      // from the merged text stream — two "empty" assistant messages instead
      // of one, sendStart: false below prevents the merged stream from
      // emitting a second, redundant start.
      writer.write({ type: "start" });
      // Written before the text starts so the reference rail renders while
      // tokens are still streaming in.
      writer.write({ type: "data-citations", data: citations });
      writer.write({ type: "data-source", data: { kind: "generated" } });
      writer.write({ type: "data-message-id", data: assistantId });

      let result = buildChatStream("flex");

      // Peek at the leading parts on their own tee branch to detect an
      // immediate capacity rejection before committing to it — `.stream`
      // is re-teed off the untouched source on each access, so reading
      // this branch doesn't consume anything from the branch merged below.
      // A capacity rejection surfaces as a "start" part immediately
      // followed by an "error" part, with nothing generated yet.
      const peekReader = result.stream.getReader();
      let peeked = await peekReader.read();
      while (!peeked.done && peeked.value.type === "start") {
        peeked = await peekReader.read();
      }
      await peekReader.cancel();

      if (!peeked.done && peeked.value.type === "error" && isFlexCapacityError(peeked.value.error)) {
        result = buildChatStream("auto");
      }

      writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false }));
    },
  });

  return createUIMessageStreamResponse({ stream });
}
