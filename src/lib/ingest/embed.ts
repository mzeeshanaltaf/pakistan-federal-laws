import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { query } from "@/lib/db";
import { recordUsage } from "@/lib/usage";
import type { ChunkRecord } from "./chunker";

const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";
// Same batch size as ingest/02_chunk_embed.py — one usage_events row per
// batch, keeping the cost ledger's grain consistent with the rest of the
// corpus's ingest history.
const BATCH_SIZE = 100;

function vectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/** Embeds and inserts a document's chunks, replacing any it already had. */
export async function embedAndInsertChunks(
  documentId: string,
  categoryId: number | null,
  chunks: ChunkRecord[]
): Promise<{ chunkCount: number; totalTokens: number }> {
  await query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);

  let totalTokens = 0;
  for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
    const batch = chunks.slice(start, start + BATCH_SIZE);
    const { embeddings, usage } = await embedMany({
      model: openai.embeddingModel(EMBED_MODEL),
      values: batch.map((c) => c.content),
    });

    const values: unknown[] = [];
    const placeholders: string[] = [];
    batch.forEach((c, i) => {
      const base = i * 9;
      placeholders.push(
        `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9}::vector)`
      );
      values.push(
        documentId,
        categoryId,
        c.chunkIndex,
        c.pageStart,
        c.pageEnd,
        c.sectionRef,
        c.content,
        c.tokenCount,
        vectorLiteral(embeddings[i])
      );
    });

    await query(
      `INSERT INTO document_chunks
         (document_id, category_id, chunk_index, page_start, page_end, section_ref, content, token_count, embedding)
       VALUES ${placeholders.join(",")}`,
      values
    );

    const batchTokens = usage.tokens ?? batch.reduce((s, c) => s + c.tokenCount, 0);
    totalTokens += batchTokens;
    await recordUsage({
      provider: "openai",
      model: EMBED_MODEL,
      operation: "ingest_embedding",
      documentId,
      inputTokens: batchTokens,
      metadata: { chunkCount: batch.length, batchStart: start },
    });
  }

  return { chunkCount: chunks.length, totalTokens };
}
