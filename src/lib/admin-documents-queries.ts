import { query } from "@/lib/db";

export interface AdminDocumentRow {
  id: string;
  slug: string;
  title: string;
  categoryId: number | null;
  categoryName: string | null;
  numPages: number | null;
  chunkCount: number;
  fileSizeBytes: number | null;
  ingestStatus: string;
  ingestError: string | null;
  createdAt: string;
}

export async function getAdminDocuments(): Promise<AdminDocumentRow[]> {
  const rows = await query<{
    id: string;
    slug: string;
    title: string;
    category_id: number | null;
    category_name: string | null;
    num_pages: number | null;
    chunk_count: string;
    file_size_bytes: string | null;
    ingest_status: string;
    ingest_error: string | null;
    created_at: string;
  }>(
    `SELECT d.id, d.slug, d.title, d.category_id, c.name AS category_name,
            d.num_pages, d.file_size_bytes, d.ingest_status, d.ingest_error, d.created_at,
            count(dc.id) AS chunk_count
     FROM documents d
     LEFT JOIN categories c ON c.id = d.category_id
     LEFT JOIN document_chunks dc ON dc.document_id = d.id
     GROUP BY d.id, c.name
     ORDER BY d.created_at DESC`
  );

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    categoryId: r.category_id,
    categoryName: r.category_name,
    numPages: r.num_pages,
    chunkCount: Number(r.chunk_count),
    fileSizeBytes: r.file_size_bytes === null ? null : Number(r.file_size_bytes),
    ingestStatus: r.ingest_status,
    ingestError: r.ingest_error,
    createdAt: r.created_at,
  }));
}
