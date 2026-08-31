// Truncates on a word boundary to fit Google's ~155-160 char SERP snippet
// cutoff, rather than mid-clause. Long-term fix is a purpose-authored
// meta_description column; this is the immediate one-line mitigation.
export function truncateForSerp(text: string, maxLength = 155): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
