import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkAuthRateLimit, getClientIp } from "@/lib/rate-limit";

const { GET, POST: authHandler } = toNextJsHandler(auth);

export { GET };

export async function POST(request: NextRequest) {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith("/api/auth/sign-in/") || pathname.startsWith("/api/auth/sign-up/")) {
    const { success } = await checkAuthRateLimit(getClientIp(request));
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }
  return authHandler(request);
}
