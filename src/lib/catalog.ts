import { query } from "@/lib/db";

export interface CategorySummary {
  id: number;
  slug: string;
  name: string;
  blurb: string | null;
  documentCount: number;
}

export async function getCategories(): Promise<CategorySummary[]> {
  const rows = await query<{
    id: number;
    slug: string;
    name: string;
    blurb: string | null;
    document_count: number;
  }>(`SELECT id, slug, name, blurb, document_count FROM categories ORDER BY sort_order, name`);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    blurb: r.blurb,
    documentCount: r.document_count,
  }));
}

export async function getCategoryBySlug(slug: string): Promise<CategorySummary | null> {
  const rows = await query<{
    id: number;
    slug: string;
    name: string;
    blurb: string | null;
    document_count: number;
  }>(`SELECT id, slug, name, blurb, document_count FROM categories WHERE slug = $1`, [slug]);
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, slug: r.slug, name: r.name, blurb: r.blurb, documentCount: r.document_count };
}

export interface DocumentListItem {
  slug: string;
  title: string;
  instrumentType: string | null;
  enactedYear: number | null;
  summaryShort: string | null;
}

export async function getDocumentsByCategory(categorySlug: string): Promise<DocumentListItem[]> {
  const rows = await query<{
    slug: string;
    title: string;
    instrument_type: string | null;
    enacted_year: number | null;
    summary_short: string | null;
  }>(
    `SELECT d.slug, d.title, d.instrument_type, d.enacted_year, d.summary_short
     FROM documents d
     JOIN categories c ON c.id = d.category_id
     WHERE c.slug = $1 AND d.ingest_status = 'summarized'
     ORDER BY d.title`,
    [categorySlug]
  );
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    instrumentType: r.instrument_type,
    enactedYear: r.enacted_year,
    summaryShort: r.summary_short,
  }));
}

export async function getAllDocumentSlugs(): Promise<string[]> {
  const rows = await query<{ slug: string }>(
    `SELECT slug FROM documents WHERE ingest_status = 'summarized'`
  );
  return rows.map((r) => r.slug);
}

export async function getAllCategorySlugs(): Promise<string[]> {
  const rows = await query<{ slug: string }>(`SELECT slug FROM categories WHERE document_count > 0`);
  return rows.map((r) => r.slug);
}

export interface DocumentDetail {
  slug: string;
  title: string;
  categorySlug: string | null;
  categoryName: string | null;
  instrumentType: string | null;
  enactedYear: number | null;
  numPages: number | null;
  summary: string | null;
  summaryShort: string | null;
  keyTopics: string[] | null;
  sourceUrl: string | null;
  originPdfUrl: string | null;
}

export async function getDocumentBySlug(slug: string): Promise<DocumentDetail | null> {
  const rows = await query<{
    slug: string;
    title: string;
    category_slug: string | null;
    category_name: string | null;
    instrument_type: string | null;
    enacted_year: number | null;
    num_pages: number | null;
    summary: string | null;
    summary_short: string | null;
    key_topics: string[] | null;
    source_url: string | null;
    origin_pdf_url: string | null;
  }>(
    `SELECT d.slug, d.title, c.slug AS category_slug, c.name AS category_name,
            d.instrument_type, d.enacted_year, d.num_pages,
            d.summary, d.summary_short, d.key_topics, d.source_url, d.origin_pdf_url
     FROM documents d
     LEFT JOIN categories c ON c.id = d.category_id
     WHERE d.slug = $1`,
    [slug]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    slug: r.slug,
    title: r.title,
    categorySlug: r.category_slug,
    categoryName: r.category_name,
    instrumentType: r.instrument_type,
    enactedYear: r.enacted_year,
    numPages: r.num_pages,
    summary: r.summary,
    summaryShort: r.summary_short,
    keyTopics: r.key_topics,
    sourceUrl: r.source_url,
    originPdfUrl: r.origin_pdf_url,
  };
}

export async function getDocumentQuestions(slug: string): Promise<string[]> {
  const rows = await query<{ question: string }>(
    `SELECT sq.question
     FROM suggested_questions sq
     JOIN documents d ON d.id = sq.document_id
     WHERE sq.scope = 'document' AND d.slug = $1
     ORDER BY sq.sort_order`,
    [slug]
  );
  return rows.map((r) => r.question);
}

export interface CatalogDocument {
  slug: string;
  title: string;
  categoryId: number | null;
}

export async function getAllDocumentsForCatalog(): Promise<CatalogDocument[]> {
  const rows = await query<{ slug: string; title: string; category_id: number | null }>(
    `SELECT slug, title, category_id FROM documents WHERE ingest_status = 'summarized' ORDER BY title`
  );
  return rows.map((r) => ({ slug: r.slug, title: r.title, categoryId: r.category_id }));
}
