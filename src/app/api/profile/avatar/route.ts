import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { putAvatar } from "@/lib/storage";

// The AWS SDK needs Node APIs — must not run on the Edge runtime.
export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart/form-data upload." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Please choose a JPEG, PNG, or WebP image." }, { status: 400 });
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "Image must be 2MB or smaller." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await putAvatar(session.user.id, buffer, file.type);

  // Cache-bust: the proxy URL is otherwise identical across uploads (keyed
  // by user id, not filename), so a stale cached image would stick around.
  const url = `/api/avatar/${session.user.id}?v=${Date.now()}`;
  return NextResponse.json({ url });
}
