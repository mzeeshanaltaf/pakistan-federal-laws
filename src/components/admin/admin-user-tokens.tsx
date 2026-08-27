import { CreditCard, MessagesSquare, MessageSquare, Sparkles } from "lucide-react";
import type { UserDetailStats } from "@/lib/admin-user-detail-queries";

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function AdminUserTokens({ stats }: { stats: UserDetailStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MessagesSquare className="size-4" />
          <span className="text-sm">Conversations</span>
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.conversations}</p>
      </div>
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MessageSquare className="size-4" />
          <span className="text-sm">Messages</span>
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.messages}</p>
      </div>
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="size-4" />
          <span className="text-sm">Tokens</span>
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.totalTokens.toLocaleString()}</p>
      </div>
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CreditCard className="size-4" />
          <span className="text-sm">Cost</span>
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCost(stats.totalCostUsd)}</p>
      </div>
    </div>
  );
}
