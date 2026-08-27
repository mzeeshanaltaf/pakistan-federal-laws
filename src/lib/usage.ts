import { query } from "@/lib/db";

export type UsageOperation = "chat" | "query_embedding" | "ingest_embedding" | "summary" | "title";

export interface RecordUsageInput {
  provider: string;
  model: string;
  operation: UsageOperation;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  sessionId?: string;
  messageId?: number;
  documentId?: string;
  userId?: string;
  isEstimated?: boolean;
  metadata?: Record<string, unknown>;
}

interface PricingRow {
  input_per_mtok: string;
  cached_input_per_mtok: string | null;
  output_per_mtok: string;
}

/** Every OpenAI (and Claude, where applicable) call in the app goes through this. */
export async function recordUsage(input: RecordUsageInput): Promise<void> {
  const pricing = await query<PricingRow>(
    `SELECT input_per_mtok, cached_input_per_mtok, output_per_mtok
     FROM model_pricing
     WHERE provider = $1 AND model = $2
       AND effective_from <= now()
       AND (effective_to IS NULL OR effective_to > now())
     ORDER BY effective_from DESC
     LIMIT 1`,
    [input.provider, input.model]
  );

  const inputTokens = input.inputTokens ?? 0;
  const cachedInputTokens = input.cachedInputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const reasoningTokens = input.reasoningTokens ?? 0;
  const totalTokens = inputTokens + outputTokens + reasoningTokens;

  let costUsd: number | null = null;
  const rate = pricing[0];
  if (rate) {
    const billableInputTokens = Math.max(inputTokens - cachedInputTokens, 0);
    const cachedRate = Number(rate.cached_input_per_mtok ?? rate.input_per_mtok);
    costUsd =
      (billableInputTokens * Number(rate.input_per_mtok)) / 1_000_000 +
      (cachedInputTokens * cachedRate) / 1_000_000 +
      ((outputTokens + reasoningTokens) * Number(rate.output_per_mtok)) / 1_000_000;
  }

  await query(
    `INSERT INTO usage_events
       (provider, model, operation, session_id, message_id, document_id, user_id,
        input_tokens, cached_input_tokens, output_tokens, reasoning_tokens, total_tokens,
        cost_usd, is_estimated, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      input.provider,
      input.model,
      input.operation,
      input.sessionId ?? null,
      input.messageId ?? null,
      input.documentId ?? null,
      input.userId ?? null,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      reasoningTokens,
      totalTokens,
      costUsd,
      input.isEstimated ?? false,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
}
