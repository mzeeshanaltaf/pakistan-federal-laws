import { createAvatar } from "@dicebear/core";
import { notionists } from "@dicebear/collection";

/** Deterministic SVG for a given seed — same seed always renders the same avatar. */
export function renderDicebearAvatar(seed: string): string {
  return createAvatar(notionists, { seed, size: 128 }).toString();
}
