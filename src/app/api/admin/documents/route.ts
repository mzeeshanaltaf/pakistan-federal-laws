import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { putDocument } from "@/lib/storage";
import { getAdminDocuments } from "@/lib/admin-documents-queries";
import { parseEnactedYear, parseInstrumentType, slugify } from "@/lib/ingest/metadata";
import { runIngestPipeline } from "@/lib/ingest/pipeline";

// pg + the AWS SDK + pdfjs all need Node APIs.
export const runtime = "nodejs";

const MAX_FILE_BYTES = 60 * 1024 * 1024;

async function requireAdmin(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "admin") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const documents = await getAdminDocuments();
  return NextResponse.json({ documents });
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (true) {
    const rows = await query<{ id: string }>(`SELECT id FROM documents WHERE slug = $1`, [candidate]);
    if (rows.length === 0) return candidate;
    candidate = `${base}-${suffix}`;
    suffix++;
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart/form-data upload." }, { status: 400 });
  }

  const title = formData.get("title");
  const categoryIdRaw = formData.get("categoryId");
  const file = formData.get("file");

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  const categoryId = typeof categoryIdRaw === "string" ? Number(categoryIdRaw) : NaN;
  if (!Number.isInteger(categoryId)) {
    return NextResponse.json({ error: "A category is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Please choose a PDF file." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File must be 60MB or smaller." }, { status: 400 });
  }

  const category = await query<{ id: number; slug: string }>(`SELECT id, slug FROM categories WHERE id = $1`, [
    categoryId,
  ]);
  if (category.length === 0) {
    return NextResponse.json({ error: "Unknown category." }, { status: 400 });
  }

  const trimmedTitle = title.trim();
  const slug = await uniqueSlug(slugify(trimmedTitle));
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const storageKey = `uploads/${category[0].slug}/${slug}.pdf`;

  await putDocument(storageKey, buffer, "application/pdf");

  const rows = await query<{ id: string }>(
    `INSERT INTO documents
       (slug, title, category_id, storage_key, file_size_bytes, checksum,
        instrument_type, enacted_year, ingest_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
     RETURNING id`,
    [
      slug,
      trimmedTitle,
      categoryId,
      storageKey,
      file.size,
      checksum,
      parseInstrumentType(trimmedTitle),
      parseEnactedYear(trimmedTitle),
    ]
  );
  const documentId = rows[0].id;

  // Fire-and-forget: this app runs as a persistent Node process (Docker on
  // the VPS, not a serverless function that freezes after the response), so
  // the pipeline keeps running after this request returns. The admin UI
  // polls GET /api/admin/documents for status instead of blocking on it.
  void runIngestPipeline(documentId);

  return NextResponse.json({ id: documentId, slug }, { status: 201 });
}
