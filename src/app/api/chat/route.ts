import { NextRequest, NextResponse } from "next/server";
import {
  APICallError,
  createUIMessageStream,
  createUIMessageStreamResponse,
  embed,
  streamText,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { hybridSearch, resolveScope, type ScopeType } from "@/lib/retrieval";
import { isSummaryIntent } from "@/lib/intent";
import { buildContext, buildSystemPrompt } from "@/lib/rag-prompt";
import { recordUsage } from "@/lib/usage";
import type { QanoonUIMessage } from "@/lib/chat-types";

// pg + the AWS SDK (transitively, via other lib modules) need Node APIs.
export const runtime = "nodejs";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-5.6-luna";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";
// Only the most recent turns are replayed into every future request as
// conversation context (cost + the model drifting on stale context) — always
// rebuilt from chat_messages server-side, never from the client-supplied
// `messages` array, so a forged prior turn can't talk the model out of its
// grounding rules.
const MAX_CONTEXT_MESSAGES = 5;
const MAX_QUESTION_CHARS = 4000;

const RequestSchema = z.object({
  id: z.string().uuid(),
  anonId: z.string().min(1).max(200),
  scope: z.object({
    type: z.enum(["all", "category", "document"]),
    slug: z.string().min(1).max(200).optional(),
  }),
  // Structural validation only — the client's UI-message shape isn't a
  // trusted source of conversation history (see extractQuestionText), so
  // this cap just bounds request size, not context replayed to the model.
  messages: z.array(z.unknown()).min(1).max(200),
});

interface DocSummaryRow {
  summary: string | null;
}

const ZERO_USAGE = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0 };

// Flex tier (~50% cheaper) can reject a request with a 429 when OpenAI has
// no spare capacity. Per OpenAI's guidance, that's the one case worth a
// one-shot retry at standard pricing rather than backing off and trying
// flex again: https://developers.openai.com/api/docs/guides/flex-processing
function isFlexCapacityError(error: unknown): boolean {
  return APICallError.isInstance(error) && error.statusCode === 429;
}

// The only thing we actually need out of the client's payload is what the
// user just typed — everything else in `messages` is unvalidated UI state,
// so this reads just that instead of trusting the array as conversation
// history (see fetchRecentHistory for what's actually replayed to the model).
function extractQuestionText(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (
      typeof m === "object" &&
      m !== null &&
      (m as { role?: unknown }).role === "user" &&
      Array.isArray((m as { parts?: unknown }).parts)
    ) {
      return (m as { parts: unknown[] }).parts
        .filter(
          (p): p is { type: "text"; text: string } =>
            typeof p === "object" &&
            p !== null &&
            (p as { type?: unknown }).type === "text" &&
            typeof (p as { text?: unknown }).text === "string"
        )
        .map((p) => p.text)
        .join("");
    }
  }
  return "";
}

class SessionOwnershipError extends Error {}

async function ensureSession(
  sessionId: string,
  anonId: string,
  userId: string,
  scope: { type: ScopeType; slug?: string }
): Promise<boolean> {
  // A client-supplied sessionId can collide with a row owned by a different
  // account (browser reused across sign-ups, a stale localStorage/URL id).
  // Check ownership *before* touching the row at all — merging onto
  // whatever user_id is already there (the old COALESCE behavior) would
  // silently attribute this user's new messages/cost to that other account,
  // and updating the row even just to reject afterward would still bump
  // someone else's session to the top of their chat history.
  const existing = await query<{ user_id: string | null }>(`SELECT user_id FROM chat_sessions WHERE id = $1`, [
    sessionId,
  ]);
  if (existing[0]?.user_id && existing[0].user_id !== userId) {
    throw new SessionOwnershipError();
  }
  const isNewSession = existing.length === 0;

  await query(
    `INSERT INTO chat_sessions (id, anon_id, user_id, scope_type, scope_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       updated_at = now(),
       -- Adopts a legacy anonymous session (user_id was null) onto the
       -- signed-in caller; never overwrites an existing owner (the
       -- ownership check above already rejected that case).
       user_id = COALESCE(chat_sessions.user_id, EXCLUDED.user_id)`,
    [sessionId, anonId, userId, scope.type, scope.slug ?? null]
  );

  return isNewSession;
}

// Lifetime activity counters on "user" — incremented here, never
// decremented, so the dashboard's all-time totals survive a chat thread
// being deleted later (which hard-deletes the chat_sessions/chat_messages
// rows a live count would otherwise depend on).
async function incrementLifetimeStats(
  userId: string,
  opts: { newConversation?: boolean; newQuestion?: boolean; newMessage?: boolean }
): Promise<void> {
  const increments = [
    opts.newConversation && `"lifetimeConversations" = "lifetimeConversations" + 1`,
    opts.newQuestion && `"lifetimeQuestionsAsked" = "lifetimeQuestionsAsked" + 1`,
    opts.newMessage && `"lifetimeMessages" = "lifetimeMessages" + 1`,
  ].filter((clause): clause is string => Boolean(clause));
  if (increments.length === 0) return;

  await query(`UPDATE "user" SET ${increments.join(", ")} WHERE id = $1`, [userId]);
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

// Atomic decrement guarded by the WHERE clause — returns the new balance, or
// null if the user had none left (nothing was updated). Admins are never
// passed to this function; they have no credit limit.
async function consumeMessageCredit(userId: string): Promise<number | null> {
  const rows = await query<{ messageCredits: number }>(
    `UPDATE "user" SET "messageCredits" = "messageCredits" - 1
     WHERE id = $1 AND "messageCredits" > 0
     RETURNING "messageCredits"`,
    [userId]
  );
  return rows[0] ? rows[0].messageCredits : null;
}

async function refundMessageCredit(userId: string): Promise<void> {
  await query(`UPDATE "user" SET "messageCredits" = "messageCredits" + 1 WHERE id = $1`, [userId]);
}

// Rebuilt from chat_messages (not the client-supplied `messages` array) so a
// forged prior turn in the request body can never compete with the system
// prompt's grounding rules — this is what actually happened in this session,
// oldest-first the way a model messages array needs to be. Empty rows
// (a failed generation's orphaned placeholder) are excluded so the model
// never sees a blank turn.
async function fetchRecentHistory(
  sessionId: string,
  limit: number
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const rows = await query<{ role: "user" | "assistant"; content: string }>(
    `SELECT role, content FROM chat_messages
     WHERE session_id = $1 AND content <> ''
     ORDER BY id DESC
     LIMIT $2`,
    [sessionId, limit]
  );
  return rows.reverse();
}

export async function POST(request: NextRequest) {
  // The real security boundary — the client-side disabled input is UX only.
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Captured as plain locals (rather than referencing `session.user.*`
  // throughout) so TS's null-narrowing of `session` survives being read
  // from inside the closures below, which it doesn't across a function
  // boundary even for a const.
  const userId = session.user.id;
  const isAdmin = session.user.role === "admin";

  const { success } = await checkRateLimit(getClientIp(request));
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { messages, id: sessionId, anonId, scope } = parsed.data;

  const questionText = extractQuestionText(messages);
  if (!questionText.trim()) {
    return NextResponse.json({ error: "Empty question" }, { status: 400 });
  }
  if (questionText.length > MAX_QUESTION_CHARS) {
    return NextResponse.json({ error: "Question is too long." }, { status: 400 });
  }

  let isNewSession: boolean;
  try {
    isNewSession = await ensureSession(sessionId, anonId, userId, scope);
  } catch (error) {
    if (error instanceof SessionOwnershipError) {
      return NextResponse.json({ error: "Session belongs to a different account" }, { status: 403 });
    }
    throw error;
  }

  // Admins have no message limit; every other signed-in user spends one
  // credit per question, checked and decremented atomically so concurrent
  // requests can't both slip through on the last credit. Refunded below if
  // anything fails before the model actually starts producing an answer, so
  // a transient OpenAI/DB error never permanently costs the user a credit.
  let creditsRemaining: number | null = null;
  if (!isAdmin) {
    creditsRemaining = await consumeMessageCredit(userId);
    if (creditsRemaining === null) {
      return NextResponse.json({ error: "No message credits remaining" }, { status: 403 });
    }
  }

  let creditRefunded = false;
  async function refundOnce(): Promise<void> {
    if (creditsRemaining !== null && !creditRefunded) {
      creditRefunded = true;
      await refundMessageCredit(userId);
    }
  }

  try {
    await insertMessage(sessionId, "user", questionText);
    await incrementLifetimeStats(userId, {
      newConversation: isNewSession,
      newQuestion: true,
      newMessage: true,
    });

    // --- Stored-summary shortcut: no embedding, no retrieval, no LLM call ---
    if (scope.type === "document" && scope.slug && isSummaryIntent(questionText)) {
      const docs = await query<DocSummaryRow>(`SELECT summary FROM documents WHERE slug = $1`, [scope.slug]);
      const summary = docs[0]?.summary;

      if (summary) {
        const assistantId = await insertMessage(sessionId, "assistant", summary);
        await incrementLifetimeStats(userId, { newMessage: true });

        const stream = createUIMessageStream<QanoonUIMessage>({
          execute: ({ writer }) => {
            writer.write({ type: "start" });
            writer.write({ type: "data-source", data: { kind: "stored-summary" } });
            writer.write({ type: "data-message-id", data: assistantId });
            if (creditsRemaining !== null) {
              writer.write({ type: "data-credits-remaining", data: creditsRemaining });
            }
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
      userId,
    });

    const chunks = await hybridSearch(questionText, embedding, scopeFilter);
    const { contextBlock, citations } = buildContext(chunks);
    // Inserted before streaming (not in onEnd) so the client gets the real
    // bigint id via a data-message-id part almost immediately — reactions
    // need it, and a live-streamed message's useChat id never matches
    // chat_messages.id otherwise. A failed generation leaves this row's
    // content empty (orphaned debris, filtered out of history reads) unless
    // settleFailure below manages to persist a partial answer first.
    const assistantId = await insertMessage(sessionId, "assistant", "", citations);
    await incrementLifetimeStats(userId, { newMessage: true });
    const modelMessages = await fetchRecentHistory(sessionId, MAX_CONTEXT_MESSAGES);

    let generationSettled = false;

    // Fires when the generation never completes normally (a hard error, or
    // the client disconnecting mid-stream) — refunds the spent credit and
    // logs whatever usage OpenAI already billed for so the cost ledger
    // doesn't silently drop these, per settleFailure's callers below.
    async function settleFailure(
      reason: string,
      partialText: string,
      usage: typeof ZERO_USAGE
    ): Promise<void> {
      if (generationSettled) return;
      generationSettled = true;
      if (partialText) await updateMessageContent(assistantId, partialText);
      await refundOnce();
      await recordUsage({
        provider: "openai",
        model: CHAT_MODEL,
        operation: "chat",
        sessionId,
        messageId: assistantId,
        userId,
        inputTokens: usage.inputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        outputTokens: usage.outputTokens,
        reasoningTokens: usage.reasoningTokens,
        isEstimated: true,
        metadata: { failureReason: reason },
      });
    }

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
          generationSettled = true;
          await updateMessageContent(assistantId, text);
          await recordUsage({
            provider: "openai",
            model: CHAT_MODEL,
            operation: "chat",
            sessionId,
            messageId: assistantId,
            userId,
            inputTokens: usage.inputTokens ?? 0,
            cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
          });
        },
        onError: async ({ error }) => {
          // A flex-capacity 429 is retried below via a fresh "auto" call —
          // not a final failure, so nothing to settle yet.
          if (serviceTier === "flex" && isFlexCapacityError(error)) return;
          console.error("[chat] generation failed", error);
          await settleFailure("error", "", ZERO_USAGE);
        },
        onAbort: async ({ steps }) => {
          const partialText = steps.map((s) => s.text).join("");
          const usage = steps.reduce(
            (acc, s) => ({
              inputTokens: acc.inputTokens + (s.usage.inputTokens ?? 0),
              cachedInputTokens: acc.cachedInputTokens + (s.usage.inputTokenDetails?.cacheReadTokens ?? 0),
              outputTokens: acc.outputTokens + (s.usage.outputTokens ?? 0),
              reasoningTokens: acc.reasoningTokens + (s.usage.outputTokenDetails?.reasoningTokens ?? 0),
            }),
            ZERO_USAGE
          );
          await settleFailure("client-disconnected", partialText, usage);
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
        if (creditsRemaining !== null) {
          writer.write({ type: "data-credits-remaining", data: creditsRemaining });
        }

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
  } catch (error) {
    await refundOnce();
    console.error("[chat] request failed before streaming started", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
