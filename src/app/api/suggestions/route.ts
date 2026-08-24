import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface QuestionRow {
  question: string;
}

// scope = "all" | "category:<slug>" | "document:<slug>".
export async function GET(request: NextRequest) {
  const scopeParam = request.nextUrl.searchParams.get("scope") ?? "all";
  const [kind, slug] = scopeParam.split(":");

  let rows: QuestionRow[] = [];

  if (kind === "document" && slug) {
    rows = await query<QuestionRow>(
      `SELECT sq.question
       FROM suggested_questions sq
       JOIN documents d ON d.id = sq.document_id
       WHERE sq.scope = 'document' AND d.slug = $1
       ORDER BY sq.sort_order`,
      [slug]
    );
  } else if (kind === "category" && slug) {
    rows = await query<QuestionRow>(
      `SELECT sq.question
       FROM suggested_questions sq
       JOIN categories c ON c.id = sq.category_id
       WHERE sq.scope = 'category' AND c.slug = $1
       ORDER BY sq.sort_order`,
      [slug]
    );
  } else {
    // No scope='all' rows exist in the schema by design — sample across
    // category-scoped questions for variety on the unscoped ask surface.
    rows = await query<QuestionRow>(
      `SELECT question FROM suggested_questions WHERE scope = 'category' ORDER BY random() LIMIT 6`
    );
  }

  return NextResponse.json({ questions: rows.map((r) => r.question) });
}
