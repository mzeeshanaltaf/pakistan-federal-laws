import { query } from "@/lib/db";

const RRF_K = 60;
const CANDIDATE_LIMIT = 40;
const TOP_N = 8;

export interface ScopeFilter {
  categoryId?: number;
  documentId?: string;
}

export type ScopeType = "all" | "category" | "document";

/** Resolves a client-facing scope (type + slug) to the ids retrieval/SQL needs. */
export async function resolveScope(scopeType: ScopeType, slug?: string): Promise<ScopeFilter> {
  if (scopeType === "category" && slug) {
    const rows = await query<{ id: number }>(`SELECT id FROM categories WHERE slug = $1`, [slug]);
    return rows[0] ? { categoryId: rows[0].id } : {};
  }
  if (scopeType === "document" && slug) {
    const rows = await query<{ id: string }>(`SELECT id FROM documents WHERE slug = $1`, [slug]);
    return rows[0] ? { documentId: rows[0].id } : {};
  }
  return {};
}

export interface RetrievalChunk {
  id: number;
  documentId: string;
  documentSlug: string;
  documentTitle: string;
  categoryName: string | null;
  sourceUrl: string | null;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  sectionRef: string | null;
  content: string;
  tokenCount: number | null;
  score: number;
}

interface RetrievalRow {
  id: number;
  document_id: string;
  chunk_index: number;
  page_start: number | null;
  page_end: number | null;
  section_ref: string | null;
  content: string;
  token_count: number | null;
  document_slug: string;
  document_title: string;
  category_name: string | null;
  source_url: string | null;
  score: string;
}

/**
 * Hybrid retrieval: vector arm (cosine distance) and lexical arm (full-text
 * rank), each top 40 under the scope filter, fused by Reciprocal Rank Fusion
 * (k=60), returning the top 8. Statute questions hinge on exact section/act
 * names where pure vector search drifts — the lexical arm keeps those precise.
 */
export async function hybridSearch(
  queryText: string,
  queryEmbedding: number[],
  scope: ScopeFilter = {}
): Promise<RetrievalChunk[]> {
  const params: unknown[] = [`[${queryEmbedding.join(",")}]`, queryText];

  let scopeClause = "";
  if (scope.documentId) {
    params.push(scope.documentId);
    scopeClause = `AND document_id = $${params.length}`;
  } else if (scope.categoryId) {
    params.push(scope.categoryId);
    scopeClause = `AND category_id = $${params.length}`;
  }

  const sql = `
    WITH vector_search AS (
      SELECT id, row_number() OVER (ORDER BY embedding <=> $1::vector) AS rank
      FROM document_chunks
      WHERE embedding IS NOT NULL ${scopeClause}
      ORDER BY embedding <=> $1::vector
      LIMIT ${CANDIDATE_LIMIT}
    ),
    lexical_search AS (
      SELECT id, row_number() OVER (
        ORDER BY ts_rank_cd(tsv, websearch_to_tsquery('english', $2)) DESC
      ) AS rank
      FROM document_chunks
      WHERE tsv @@ websearch_to_tsquery('english', $2) ${scopeClause}
      ORDER BY ts_rank_cd(tsv, websearch_to_tsquery('english', $2)) DESC
      LIMIT ${CANDIDATE_LIMIT}
    ),
    fused AS (
      SELECT
        COALESCE(v.id, l.id) AS id,
        COALESCE(1.0 / (${RRF_K} + v.rank), 0) + COALESCE(1.0 / (${RRF_K} + l.rank), 0) AS score
      FROM vector_search v
      FULL OUTER JOIN lexical_search l ON v.id = l.id
    )
    SELECT
      c.id, c.document_id, c.chunk_index, c.page_start, c.page_end, c.section_ref,
      c.content, c.token_count,
      d.slug AS document_slug, d.title AS document_title, cat.name AS category_name,
      d.source_url, f.score
    FROM fused f
    JOIN document_chunks c ON c.id = f.id
    JOIN documents d ON d.id = c.document_id
    LEFT JOIN categories cat ON cat.id = c.category_id
    ORDER BY f.score DESC
    LIMIT ${TOP_N}
  `;

  const rows = await query<RetrievalRow>(sql, params);

  return rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    documentSlug: row.document_slug,
    documentTitle: row.document_title,
    categoryName: row.category_name,
    sourceUrl: row.source_url,
    chunkIndex: row.chunk_index,
    pageStart: row.page_start,
    pageEnd: row.page_end,
    sectionRef: row.section_ref,
    content: row.content,
    tokenCount: row.token_count,
    score: Number(row.score),
  }));
}
