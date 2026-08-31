import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(request);
  if (error) return error;

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
