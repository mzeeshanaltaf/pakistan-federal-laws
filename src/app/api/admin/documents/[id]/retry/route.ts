import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { runIngestPipeline } from "@/lib/ingest/pipeline";

export const runtime = "nodejs";

// Re-triggers the ingest pipeline for a document — for a 'failed' row, or one
// stuck in 'processing' because the server restarted mid-job (the
// fire-and-forget upload path has no queue/crash recovery of its own).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const rows = await query<{ id: string }>(`SELECT id FROM documents WHERE id = $1`, [id]);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  void runIngestPipeline(id);
  return NextResponse.json({ ok: true });
}
