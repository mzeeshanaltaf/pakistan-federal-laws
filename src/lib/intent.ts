// Token-saving shortcut: when the scope is a single document and the question
// is asking for a summary/overview, skip embedding + retrieval + the LLM call
// entirely and serve the precomputed summary straight from the DB.
//
// The phase doc's regex ends the "summar" branch in a trailing \b, which
// never matches inside "summary"/"summarize" (no word boundary between "r"
// and "y") — tested directly, it silently never fires. Fixed here with
// \w* so the stem can still consume the rest of the word.
const SUMMARY_INTENT_RE =
  /\b(summar\w*|overview|gist|tl;?dr|key points|what.*(is|does).*(this|the) (act|law|ordinance).*about)\b/i;

export function isSummaryIntent(question: string): boolean {
  return SUMMARY_INTENT_RE.test(question);
}
