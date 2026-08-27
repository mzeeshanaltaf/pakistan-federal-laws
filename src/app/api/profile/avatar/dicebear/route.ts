import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { putAvatar } from "@/lib/storage";
import { renderDicebearAvatar } from "@/lib/dicebear";

// The AWS SDK needs Node APIs — must not run on the Edge runtime.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const seed = body?.seed;
  if (typeof seed !== "string" || !seed.trim() || seed.length > 100) {
    return NextResponse.json({ error: "Invalid avatar seed." }, { status: 400 });
  }

  // Regenerated server-side from the seed rather than trusting a client-supplied
  // SVG, so the stored avatar is always exactly what createAvatar() produces.
  const svg = renderDicebearAvatar(seed);
  await putAvatar(session.user.id, Buffer.from(svg), "image/svg+xml");

  const url = `/api/avatar/${session.user.id}?v=${Date.now()}`;
  return NextResponse.json({ url });
}
