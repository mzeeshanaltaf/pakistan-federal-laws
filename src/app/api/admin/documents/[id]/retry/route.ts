import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { runIngestPipeline } from "@/lib/ingest/pipeline";

export const runtime = "nodejs";

// Re-triggers the ingest pipeline for a document — for a 'failed' row, or one
// stuck in 'processing' because the server restarted mid-job (the
// fire-and-forget upload path has no queue/crash recovery of its own).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await params;
  // Guards against a double-click (or retrying a doc that's mid-run for some
  // other reason) starting a second pipeline in parallel — both would race
  // on the same `DELETE FROM document_chunks` + re-insert, and pay for
  // embeddings twice. Only flips to 'processing' if it wasn't already there.
  const rows = await query<{ id: string }>(
    `UPDATE documents SET ingest_status = 'processing', updated_at = now()
     WHERE id = $1 AND ingest_status IS DISTINCT FROM 'processing'
     RETURNING id`,
    [id]
  );
  if (rows.length === 0) {
    const exists = await query<{ id: string }>(`SELECT id FROM documents WHERE id = $1`, [id]);
    return NextResponse.json(
      { error: exists.length === 0 ? "Document not found." : "Ingestion is already running for this document." },
      { status: exists.length === 0 ? 404 : 409 }
    );
  }

  void runIngestPipeline(id).catch((err) => console.error("[ingest] pipeline crashed", err));
  return NextResponse.json({ ok: true });
}
