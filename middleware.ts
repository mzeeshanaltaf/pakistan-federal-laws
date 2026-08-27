import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic cookie-presence check only — Better Auth issues a session
// cookie readable without a DB round trip. This is a fast UX-level redirect,
// not the security boundary: /dashboard, /admin, and /profile re-check with
// a real auth.api.getSession() call server-side, and /api/chat is the actual
// gate on the write path.
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/profile/:path*"],
};
