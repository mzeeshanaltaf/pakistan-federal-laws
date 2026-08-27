import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { countTokens } from "./tokenizer";

// Same running-header convention documented in CLAUDE.md ("Page N of M" on
// 98% of the corpus) — ingest/02_chunk_embed.py strips this via PyMuPDF's
// plain-text extraction; pdfjs gives us positioned text items instead, so it
// gets stripped per-line below rather than with one page-level regex.
const HEADER_RE = /^\s*Page\s+\d+\s+of\s+\d+\s*$/i;
const PARAGRAPH_GAP_MULTIPLIER = 1.6;

export interface ExtractedParagraph {
  page: number;
  text: string;
  tokens: number;
}

interface Line {
  text: string;
  y: number;
}

// pdfjs represents a line break as a synthetic empty-string item carrying
// hasEOL:true, positioned at the *next* line's y — not as a trailing marker
// on the line just finished. So a line is closed out when an EOL item is
// seen (or at the end of the page), and the EOL item's own y seeds the line
// that follows it.
function linesFromItems(items: { str: string; hasEOL: boolean; transform: number[] }[]): Line[] {
  const lines: Line[] = [];
  let text = "";
  let y: number | null = null;

  for (const item of items) {
    if (item.hasEOL) {
      if (text.trim()) lines.push({ text, y: y ?? item.transform[5] });
      text = "";
      y = item.transform[5];
      continue;
    }
    if (y === null) y = item.transform[5];
    text += item.str;
  }
  if (text.trim()) lines.push({ text, y: y ?? 0 });
  return lines;
}

// No blank-line markers survive pdfjs's item stream, so paragraph boundaries
// are inferred from vertical gaps between consecutive lines instead — a
// gap noticeably larger than the page's typical line spacing reads as a
// paragraph/section break, same intent as PyMuPDF's blank-line split.
function groupIntoParagraphs(lines: Line[], pageNum: number): ExtractedParagraph[] {
  if (lines.length === 0) return [];

  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1].y - lines[i].y;
    if (gap > 0) gaps.push(gap);
  }
  gaps.sort((a, b) => a - b);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 14;
  const breakThreshold = medianGap * PARAGRAPH_GAP_MULTIPLIER;

  const paragraphs: ExtractedParagraph[] = [];
  let current: string[] = [];

  function flush() {
    if (current.length === 0) return;
    const cleaned = current.join(" ").replace(/\s+/g, " ").trim();
    if (cleaned) paragraphs.push({ page: pageNum, text: cleaned, tokens: countTokens(cleaned) });
    current = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (HEADER_RE.test(line.text)) continue;
    if (i > 0 && lines[i - 1].y - line.y > breakThreshold) flush();
    current.push(line.text);
  }
  flush();

  return paragraphs;
}

export interface ExtractedDocument {
  numPages: number;
  paragraphs: ExtractedParagraph[];
}

/** Extracts per-page paragraphs (page number, text, token count) from a PDF buffer. */
export async function extractParagraphs(buffer: Buffer): Promise<ExtractedDocument> {
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0,
    isEvalSupported: false,
  }).promise;

  try {
    const paragraphs: ExtractedParagraph[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const lines = linesFromItems(
        content.items as { str: string; hasEOL: boolean; transform: number[] }[]
      );
      paragraphs.push(...groupIntoParagraphs(lines, pageNum));
    }
    return { numPages: doc.numPages, paragraphs };
  } finally {
    await doc.destroy();
  }
}
