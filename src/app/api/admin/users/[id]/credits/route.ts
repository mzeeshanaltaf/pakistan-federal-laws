import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { credits?: unknown } | null;
  const credits = body?.credits;
  if (typeof credits !== "number" || !Number.isInteger(credits) || credits < 0) {
    return NextResponse.json({ error: "credits must be a non-negative integer" }, { status: 400 });
  }

  const rows = await query<{ messageCredits: number }>(
    `UPDATE "user" SET "messageCredits" = $1 WHERE id = $2 RETURNING "messageCredits"`,
    [credits, id]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ messageCredits: rows[0].messageCredits });
}
