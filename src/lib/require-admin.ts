import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

/** Shared admin gate for /api/admin/* routes — 401 if signed out, 403 if not an admin. */
export async function requireAdmin(
  request: NextRequest
): Promise<{ session: Session; error?: undefined } | { session?: undefined; error: NextResponse }> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}
