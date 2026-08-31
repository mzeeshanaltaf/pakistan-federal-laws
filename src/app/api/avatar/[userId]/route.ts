import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getAvatarStream } from "@/lib/storage";

// The AWS SDK needs Node APIs — must not run on the Edge runtime.
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const stream = await getAvatarStream(userId);
  if (!stream) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const webStream = Readable.toWeb(stream.body) as ReadableStream;
  return new Response(webStream, {
    headers: {
      "Content-Type": stream.contentType ?? "image/jpeg",
      ...(stream.contentLength ? { "Content-Length": String(stream.contentLength) } : {}),
      // The URL is versioned with a `?v=` query param on every upload, so the
      // bytes at any given URL never change — safe to cache indefinitely.
      "Cache-Control": "public, max-age=31536000, immutable",
      // Dicebear avatars are stored as SVG (a script-execution context if
      // rendered as a document) — nosniff plus an explicit inline
      // disposition keeps the browser treating this strictly as an image.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
