import { getEncoding } from "js-tiktoken";

// Same encoding ingest/02_chunk_embed.py uses (tiktoken's cl100k_base) — kept
// as a module-level singleton since building the encoding table isn't free.
const encoding = getEncoding("cl100k_base");

export function countTokens(text: string): number {
  return encoding.encode(text).length;
}
