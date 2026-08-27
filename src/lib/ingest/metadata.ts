// Same regexes ingest/01_catalogue.py uses to derive metadata from a title,
// kept identical so admin-uploaded documents classify the same way the
// scraped corpus did.
const INSTRUMENT_RE = /\b(Act|Ordinance|Rules|Order)\b/i;
const YEAR_RE = /\b(1[7-9]\d{2}|20[0-4]\d)\b/g;
const SLUG_RE = /[^a-z0-9]+/g;

export function slugify(text: string): string {
  return text.toLowerCase().replace(SLUG_RE, "-").replace(/^-+|-+$/g, "");
}

export function parseInstrumentType(title: string): string | null {
  const m = INSTRUMENT_RE.exec(title);
  if (!m) return null;
  return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
}

export function parseEnactedYear(title: string): number | null {
  const years = [...title.matchAll(YEAR_RE)].map((m) => Number(m[1]));
  return years.length ? years[years.length - 1] : null;
}
