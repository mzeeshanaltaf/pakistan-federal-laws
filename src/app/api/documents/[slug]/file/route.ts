import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getDocumentStream } from "@/lib/storage";

// The AWS SDK needs Node APIs — must not run on the Edge runtime.
export const runtime = "nodejs";

interface DocRow {
  storage_key: string | null;
  title: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const download = new URL(request.url).searchParams.get("download") === "1";

  const docs = await query<DocRow>(`SELECT storage_key, title FROM documents WHERE slug = $1`, [slug]);
  const doc = docs[0];
  if (!doc?.storage_key) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { body, contentType, contentLength } = await getDocumentStream(doc.storage_key);
  const webStream = Readable.toWeb(body) as ReadableStream;
  const disposition = download ? "attachment" : "inline";

  return new Response(webStream, {
    headers: {
      "Content-Type": contentType ?? "application/pdf",
      ...(contentLength ? { "Content-Length": String(contentLength) } : {}),
      // Corpus is immutable — safe to cache for a year.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `${disposition}; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(doc.title)}.pdf`,
    },
  });
}
