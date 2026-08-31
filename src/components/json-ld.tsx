// eslint-disable-next-line @typescript-eslint/no-explicit-any -- schema.org payloads are heterogeneous by nature
export function JsonLd({ data }: { data: Record<string, any> }) {
  // Statute titles/summaries feed into this from the DB — escaping "<" stops
  // a stray "</script>" in the text from breaking out of the script tag.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
