import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getDocumentStream } from "@/lib/storage";
import { checkFileRateLimit, getClientIp } from "@/lib/rate-limit";

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
  // Public and unauthenticated by design (these are public statutes) — this
  // just guards against one client hammering the proxy (every byte streams
  // through this Node process), not credential abuse.
  const { success } = await checkFileRateLimit(getClientIp(request));
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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
