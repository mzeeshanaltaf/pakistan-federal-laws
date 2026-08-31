import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { deleteDocument } from "@/lib/storage";
import { requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await params;
  const rows = await query<{ storage_key: string | null; category_id: number | null }>(
    `SELECT storage_key, category_id FROM documents WHERE id = $1`,
    [id]
  );
  const doc = rows[0];
  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  // document_chunks and suggested_questions both cascade on documents.id, so
  // one DELETE cleans up everywhere except the MinIO object.
  await query(`DELETE FROM documents WHERE id = $1`, [id]);

  if (doc.storage_key) {
    await deleteDocument(doc.storage_key).catch(() => {});
  }
  if (doc.category_id !== null) {
    await query(
      `UPDATE categories SET document_count = (
         SELECT count(*) FROM documents WHERE category_id = $1 AND ingest_status IN ('chunked', 'summarized')
       ) WHERE id = $1`,
      [doc.category_id]
    );
  }

  return NextResponse.json({ ok: true });
}
