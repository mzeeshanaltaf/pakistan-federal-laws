"use client";

import { useState } from "react";

// A larger pool than what's shown at once — one word/phrase is picked at
// mount per indicator instance, so consecutive questions don't always show
// the same message.
const LOADING_WORDS = [
  "Reading statutes",
  "Checking sections",
  "Searching case law",
  "Reviewing clauses",
  "Cross-referencing acts",
  "Parsing provisions",
  "Consulting the code",
  "Tracing amendments",
  "Weighing precedent",
  "Scanning ordinances",
  "Verifying citations",
  "Interpreting text",
  "Locating articles",
  "Checking definitions",
  "Reviewing schedules",
  "Examining statutes",
  "Following cross-references",
  "Reading the fine print",
  "Checking penalties",
  "Reviewing the Gazette",
];

function pickWord(): string {
  return LOADING_WORDS[Math.floor(Math.random() * LOADING_WORDS.length)];
}

export function TypingIndicator() {
  const [word] = useState(pickWord);

  return (
    <p
      role="status"
      aria-label="Qanoon is answering"
      className="animate-shimmer bg-size-[200%_100%] bg-linear-to-r from-muted-foreground/40 via-foreground to-muted-foreground/40 bg-clip-text text-sm text-transparent"
    >
      {word}…
    </p>
  );
}
