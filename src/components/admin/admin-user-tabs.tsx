"use client";

import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

type TabKey = "profile" | "history" | "bookmarks" | "tokens";

const TABS: { key: TabKey; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "history", label: "Chat history" },
  { key: "bookmarks", label: "Bookmarks" },
  { key: "tokens", label: "Tokens" },
];

export function AdminUserTabs({
  profile,
  history,
  bookmarks,
  tokens,
}: {
  profile: ReactNode;
  history: ReactNode;
  bookmarks: ReactNode;
  tokens: ReactNode;
}) {
  const [active, setActive] = useState<TabKey>("profile");
  const panels: Record<TabKey, ReactNode> = { profile, history, bookmarks, tokens };

  return (
    <div>
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-6">{panels[active]}</div>
    </div>
  );
}
