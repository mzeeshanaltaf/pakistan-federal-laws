import { query } from "@/lib/db";
import { getDocumentBuffer } from "@/lib/storage";
import { extractParagraphs } from "./pdf-extract";
import { buildChunkRecords } from "./chunker";
import { embedAndInsertChunks } from "./embed";
import { buildExtractText, generateDocumentSummary } from "./summarize";

interface DocumentRow {
  title: string;
  category_id: number | null;
  storage_key: string;
  instrument_type: string | null;
}

async function setStatus(documentId: string, status: string, error: string | null = null): Promise<void> {
  await query(
    `UPDATE documents SET ingest_status = $1, ingest_error = $2, updated_at = now() WHERE id = $3`,
    [status, error, documentId]
  );
}

// document_count only counts chunked/summarized documents (matching
// ingest/03_build_indexes.py) — refreshed after every status transition that
// could move a document into or out of that set.
async function refreshCategoryDocumentCount(categoryId: number | null): Promise<void> {
  if (categoryId === null) return;
  await query(
    `UPDATE categories SET document_count = (
       SELECT count(*) FROM documents WHERE category_id = $1 AND ingest_status IN ('chunked', 'summarized')
     ) WHERE id = $1`,
    [categoryId]
  );
}

/**
 * Runs the full admin-upload ingest path for one document: extract -> chunk
 * -> embed -> summarize. Mirrors ingest/02_chunk_embed.py + 04a/04b, but
 * synchronous end-to-end (single document, triggered from the upload route)
 * rather than the offline batch scripts' resumable multi-pass design.
 */
export async function runIngestPipeline(documentId: string): Promise<void> {
  const rows = await query<DocumentRow>(
    `SELECT title, category_id, storage_key, instrument_type FROM documents WHERE id = $1`,
    [documentId]
  );
  const doc = rows[0];
  if (!doc || !doc.storage_key) {
    await setStatus(documentId, "failed", "Document has no storage key");
    return;
  }

  try {
    await setStatus(documentId, "processing");

    const buffer = await getDocumentBuffer(doc.storage_key);
    const { numPages, paragraphs } = await extractParagraphs(buffer);
    if (paragraphs.length === 0) {
      throw new Error("No extractable text in this PDF");
    }

    await query(`UPDATE documents SET num_pages = $1, updated_at = now() WHERE id = $2`, [
      numPages,
      documentId,
    ]);

    const chunkRecords = buildChunkRecords(paragraphs);
    await embedAndInsertChunks(documentId, doc.category_id, chunkRecords);
    await setStatus(documentId, "chunked");
    await refreshCategoryDocumentCount(doc.category_id);

    const extractText = buildExtractText(paragraphs);
    const summary = await generateDocumentSummary(documentId, doc.title, doc.instrument_type, extractText);

    await query(
      `UPDATE documents SET
         summary = $1, summary_short = $2, key_topics = $3,
         summary_author = 'openai', summary_model = $4, summarized_at = now(),
         ingest_status = 'summarized', ingest_error = NULL, updated_at = now()
       WHERE id = $5`,
      [summary.summary, summary.summaryShort, summary.keyTopics, process.env.OPENAI_CHAT_MODEL ?? "gpt-5.6-luna", documentId]
    );

    await query(`DELETE FROM suggested_questions WHERE scope = 'document' AND document_id = $1`, [documentId]);
    for (const [i, question] of summary.questions.entries()) {
      await query(
        `INSERT INTO suggested_questions (scope, document_id, question, sort_order) VALUES ('document', $1, $2, $3)`,
        [documentId, question, i]
      );
    }

    await refreshCategoryDocumentCount(doc.category_id);
  } catch (error) {
    await setStatus(documentId, "failed", error instanceof Error ? error.message.slice(0, 2000) : String(error));
  }
}
