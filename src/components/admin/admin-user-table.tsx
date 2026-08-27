"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { UserStats } from "@/lib/admin-queries";

type SortKey = "name" | "conversations" | "messages" | "totalTokens" | "totalCostUsd";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "User", align: "left" },
  { key: "conversations", label: "Conversations", align: "right" },
  { key: "messages", label: "Messages", align: "right" },
  { key: "totalTokens", label: "Tokens", align: "right" },
  { key: "totalCostUsd", label: "Cost", align: "right" },
];

function formatCost(value: number): string {
  // usage_events.cost_usd is numeric(12,6) — a single query_embedding row can
  // genuinely round to $0.0000, but per-user totals aggregate many rows, so
  // 4 decimal places stays meaningful without the sub-cent noise.
  return `$${value.toFixed(4)}`;
}

export function AdminUserTable({ users }: { users: UserStats[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("totalCostUsd");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...users];
    copy.sort((a, b) => {
      let cmp: number;
      if (sortKey === "name") {
        cmp = (a.name ?? a.email).localeCompare(b.name ?? b.email);
      } else {
        cmp = a[sortKey] - b[sortKey];
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [users, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-medium text-muted-foreground ${col.align === "right" ? "text-right" : "text-left"}`}
              >
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className={`inline-flex items-center gap-1 hover:text-foreground ${col.align === "right" ? "flex-row-reverse" : ""}`}
                >
                  {col.label}
                  {sortKey === col.key ? (
                    sortDir === "asc" ? (
                      <ArrowUp className="size-3.5" />
                    ) : (
                      <ArrowDown className="size-3.5" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3.5 opacity-40" />
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((user) => (
            <tr
              key={user.id}
              onClick={() => router.push(`/admin/users/${user.id}`)}
              className="cursor-pointer hover:bg-muted/40"
            >
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{user.name ?? user.email}</div>
                {user.name ? <div className="text-xs text-muted-foreground">{user.email}</div> : null}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{user.conversations}</td>
              <td className="px-4 py-3 text-right tabular-nums">{user.messages}</td>
              <td className="px-4 py-3 text-right tabular-nums">{user.totalTokens.toLocaleString()}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatCost(user.totalCostUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No users yet.</p>
      ) : null}
    </div>
  );
}
