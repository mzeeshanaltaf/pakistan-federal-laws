import type { BookmarkedMessage } from "@/lib/dashboard-queries";

// Strips the light markdown emphasis assistant answers use (**bold**, [n]
// citation markers) for a clean plain-text preview line, matching /dashboard's
// bookmark list convention.
function previewText(content: string): string {
  return content.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\[\d+\]/g, "").trim();
}

export function AdminUserBookmarks({ bookmarks }: { bookmarks: BookmarkedMessage[] }) {
  if (bookmarks.length === 0) {
    return <p className="text-sm text-muted-foreground">This user hasn&apos;t bookmarked any messages.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {bookmarks.map((bookmark) => (
        <li key={bookmark.id} className="px-4 py-4">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-medium text-foreground">{bookmark.label}</h3>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {new Date(bookmark.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {previewText(bookmark.content)}
          </p>
        </li>
      ))}
    </ul>
  );
}
