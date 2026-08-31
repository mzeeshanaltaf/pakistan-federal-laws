import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const body = (await request.json().catch(() => null)) as { mode?: unknown; amount?: unknown } | null;
  const mode = body?.mode;
  const amount = body?.amount;
  if ((mode !== "set" && mode !== "add") || typeof amount !== "number" || !Number.isInteger(amount)) {
    return NextResponse.json({ error: "mode must be 'set' or 'add', and amount must be an integer" }, { status: 400 });
  }
  if (mode === "set" && amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative integer for 'set'" }, { status: 400 });
  }

  // Admins have no message limit (see admin-user-profile.tsx), so they're excluded here too.
  const rows =
    mode === "set"
      ? await query<{ id: string }>(
          `UPDATE "user" SET "messageCredits" = $1 WHERE role IS DISTINCT FROM 'admin' RETURNING id`,
          [amount]
        )
      : await query<{ id: string }>(
          `UPDATE "user" SET "messageCredits" = GREATEST(0, "messageCredits" + $1) WHERE role IS DISTINCT FROM 'admin' RETURNING id`,
          [amount]
        );

  return NextResponse.json({ updated: rows.length });
}
