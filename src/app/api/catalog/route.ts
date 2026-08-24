import { NextResponse } from "next/server";
import { query } from "@/lib/db";

interface CategoryRow {
  id: number;
  slug: string;
  name: string;
  blurb: string | null;
  document_count: number;
}

interface DocumentRow {
  slug: string;
  title: string;
  category_id: number | null;
}

// Whole-corpus payload for the /ask scope selector's client-side search —
// 525 documents at a few fields each is small enough to ship in one response
// rather than paginate, and the corpus only changes on a fresh ingest run.
export async function GET() {
  const [categories, documents] = await Promise.all([
    query<CategoryRow>(
      `SELECT id, slug, name, blurb, document_count FROM categories ORDER BY sort_order, name`
    ),
    query<DocumentRow>(
      `SELECT slug, title, category_id FROM documents WHERE ingest_status = 'summarized' ORDER BY title`
    ),
  ]);

  return NextResponse.json(
    { categories, documents },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } }
  );
}
