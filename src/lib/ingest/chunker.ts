import { countTokens } from "./tokenizer";
import type { ExtractedParagraph } from "./pdf-extract";

// Same targets as ingest/02_chunk_embed.py's 250/50 (20%) revision (see
// docs/status.md Phase 2) — kept identical so admin-uploaded documents
// retrieve at the same granularity as the rest of the corpus.
const CHUNK_TARGET_TOKENS = 250;
const CHUNK_OVERLAP_TOKENS = 50;

const SECTION_HEADING_RE = /^\s*(\d+[A-Z]?)\.\s+[A-Z]/;
const SENTENCE_SPLIT_RE = /(?<=[.;])\s+(?=[A-Z(0-9])/;

export interface ChunkRecord {
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  sectionRef: string | null;
  content: string;
  tokenCount: number;
}

// Legal-text PDFs don't always have a clean layout gap between clauses, so a
// single paragraph block can occasionally span most of a page. Falls back to
// sentence-boundary splitting only for those oversized blocks, mirroring the
// Python chunker's same-named function.
// OpenAI's embedding models reject a single input over ~8191 tokens outright
// (TooManyEmbeddingValuesForCallError/context-length error), which would
// otherwise fail the whole document's ingest over one paragraph. A limit this
// far past the target chunk size is only ever reached by a single sentence
// with no punctuation to split on (SENTENCE_SPLIT_RE finds nothing) — a
// pathological input, not a normal statute, so a character-ratio hard slice
// (no clean boundary to prefer) is an acceptable last resort.
const HARD_SLICE_LIMIT_TOKENS = 6000;

function hardSliceByTokens(text: string, tokens: number, limit: number): string[] {
  if (tokens <= limit) return [text];
  const parts = Math.ceil(tokens / limit);
  const charsPerPart = Math.ceil(text.length / parts);
  const slices: string[] = [];
  for (let i = 0; i < text.length; i += charsPerPart) {
    slices.push(text.slice(i, i + charsPerPart));
  }
  return slices;
}

function splitOversizedParagraph(para: ExtractedParagraph, limit = CHUNK_TARGET_TOKENS): ExtractedParagraph[] {
  if (para.tokens <= limit) return [para];

  const pieces: string[] = [];
  let cur: string[] = [];
  let curTokens = 0;
  for (const sentence of para.text.split(SENTENCE_SPLIT_RE)) {
    const t = countTokens(sentence);
    if (cur.length && curTokens + t > limit) {
      pieces.push(cur.join(" "));
      cur = [];
      curTokens = 0;
    }
    cur.push(sentence);
    curTokens += t;
  }
  if (cur.length) pieces.push(cur.join(" "));

  return pieces.flatMap((p) => {
    const pTokens = countTokens(p);
    return hardSliceByTokens(p, pTokens, HARD_SLICE_LIMIT_TOKENS).map((slice) => ({
      page: para.page,
      text: slice,
      tokens: countTokens(slice),
    }));
  });
}

// Never merges across a page gap larger than one page, so a chunk never
// silently spans a discontinuity (e.g. a schedule/annexure boundary).
function segmentParagraphs(paras: ExtractedParagraph[]): ExtractedParagraph[][] {
  const segments: ExtractedParagraph[][] = [];
  let current: ExtractedParagraph[] = [];
  let prevPage: number | null = null;

  for (const p of paras) {
    if (current.length && prevPage !== null && p.page - prevPage > 1) {
      segments.push(current);
      current = [];
    }
    current.push(p);
    prevPage = p.page;
  }
  if (current.length) segments.push(current);
  return segments;
}

function chunkSegment(
  paras: ExtractedParagraph[],
  target = CHUNK_TARGET_TOKENS,
  overlap = CHUNK_OVERLAP_TOKENS
): ExtractedParagraph[][] {
  const n = paras.length;
  const result: ExtractedParagraph[][] = [];
  let i = 0;
  let carry: ExtractedParagraph[] = [];

  while (i < n) {
    const cur = [...carry];
    let curTokens = cur.reduce((s, p) => s + p.tokens, 0);
    const baseLen = cur.length;

    while (i < n) {
      const p = paras[i];
      if (cur.length > baseLen && curTokens + p.tokens > target) break;
      cur.push(p);
      curTokens += p.tokens;
      i++;
    }
    result.push(cur);
    if (i >= n) break;

    const tail: ExtractedParagraph[] = [];
    let tailTokens = 0;
    for (let j = cur.length - 1; j >= 0; j--) {
      if (tailTokens >= overlap) break;
      tail.unshift(cur[j]);
      tailTokens += cur[j].tokens;
    }
    carry = tail;
  }
  return result;
}

/** Builds token-windowed chunk records from a document's extracted paragraphs. */
export function buildChunkRecords(paragraphs: ExtractedParagraph[]): ChunkRecord[] {
  const expanded = paragraphs.flatMap((p) => splitOversizedParagraph(p));

  const groups: ExtractedParagraph[][] = [];
  for (const segment of segmentParagraphs(expanded)) {
    groups.push(...chunkSegment(segment));
  }

  return groups.map((group, idx) => {
    const content = group.map((p) => p.text).join("\n\n");
    const match = SECTION_HEADING_RE.exec(content);
    return {
      chunkIndex: idx,
      pageStart: Math.min(...group.map((p) => p.page)),
      pageEnd: Math.max(...group.map((p) => p.page)),
      sectionRef: match ? match[1] : null,
      content,
      tokenCount: countTokens(content),
    };
  });
}
