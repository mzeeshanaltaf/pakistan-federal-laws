import { NextResponse } from "next/server";
import { query } from "@/lib/db";

interface SummaryRow {
  slug: string;
  title: string;
  summary: string | null;
  summary_short: string | null;
  key_topics: string[] | null;
}

interface QuestionRow {
  question: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const docs = await query<SummaryRow>(
    `SELECT slug, title, summary, summary_short, key_topics FROM documents WHERE slug = $1`,
    [slug]
  );
  const doc = docs[0];
  if (!doc) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const questions = await query<QuestionRow>(
    `SELECT sq.question
     FROM suggested_questions sq
     JOIN documents d ON d.id = sq.document_id
     WHERE sq.scope = 'document' AND d.slug = $1
     ORDER BY sq.sort_order`,
    [slug]
  );

  return NextResponse.json({
    ...doc,
    questions: questions.map((q) => q.question),
  });
}
