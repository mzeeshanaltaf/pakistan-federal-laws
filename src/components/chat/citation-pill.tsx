"use client";

interface CitationPillProps {
  n: number;
  onClick: () => void;
}

export function CitationPill({ n, onClick }: CitationPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded-full bg-accent px-1 align-middle text-[10px] font-medium text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
      aria-label={`Open citation ${n}`}
    >
      {n}
    </button>
  );
}
