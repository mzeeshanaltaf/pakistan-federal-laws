import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getAllDocumentSlugs, getDocumentBySlug, getDocumentQuestions } from "@/lib/catalog";
import { PdfViewer } from "@/components/pdf-viewer-loader";
import { JsonLd } from "@/components/json-ld";
import { truncateForSerp } from "@/lib/seo";

export const revalidate = 3600;

// " · Qanoon" suffix template is 9 chars — past ~55 the statute's own
// qualifying clause (not the brand suffix) is what gets truncated in the
// SERP, so drop the suffix for long titles instead.
const TITLE_TEMPLATE_BUDGET = 55;

export async function generateStaticParams() {
  const slugs = await getAllDocumentSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface LawPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: LawPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDocumentBySlug(slug);
  if (!doc) return {};
  const description = truncateForSerp(
    doc.summaryShort ?? `Read a plain-language summary of the ${doc.title}, with citations to the source text.`
  );
  return {
    title: doc.title.length > TITLE_TEMPLATE_BUDGET ? { absolute: doc.title } : doc.title,
    description,
    alternates: { canonical: `/law/${slug}` },
  };
}

export default async function LawPage({ params }: LawPageProps) {
  const { slug } = await params;
  const doc = await getDocumentBySlug(slug);
  if (!doc) notFound();

  const questions = await getDocumentQuestions(slug);
  const fileUrl = `/api/documents/${slug}/file`;
  const askHref = `/ask?scope=document&slug=${encodeURIComponent(slug)}&label=${encodeURIComponent(doc.title)}`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://qanoon.zeeshanai.cloud";
  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Browse", item: `${siteUrl}/browse` },
    ...(doc.categorySlug && doc.categoryName
      ? [{ "@type": "ListItem", position: 2, name: doc.categoryName, item: `${siteUrl}/browse/${doc.categorySlug}` }]
      : []),
    {
      "@type": "ListItem",
      position: doc.categorySlug ? 3 : 2,
      name: doc.title,
      item: `${siteUrl}/law/${slug}`,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Legislation",
          name: doc.title,
          legislationIdentifier: slug,
          ...(doc.enactedYear && { legislationDate: String(doc.enactedYear) }),
          legislationJurisdiction: { "@type": "Country", name: "Pakistan" },
          ...(doc.instrumentType && { legislationType: doc.instrumentType }),
          ...(doc.summary && { description: doc.summary }),
          ...(doc.sourceUrl && { url: doc.sourceUrl }),
          isPartOf: { "@type": "WebSite", name: "Qanoon", url: siteUrl },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbItems,
        }}
      />
      <p className="text-sm text-muted-foreground">
        <Link href="/browse" className="hover:text-foreground">
          Browse
        </Link>
        {doc.categorySlug && (
          <>
            <span className="mx-1.5">/</span>
            <Link href={`/browse/${doc.categorySlug}`} className="hover:text-foreground">
              {doc.categoryName}
            </Link>
          </>
        )}
      </p>

      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{doc.title}</h1>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {doc.instrumentType && <span>{doc.instrumentType}</span>}
        {doc.enactedYear && <span>&middot; {doc.enactedYear}</span>}
        {doc.numPages && (
          <span>
            &middot; {doc.numPages} page{doc.numPages === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <Link
        href={askHref}
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Ask about this law
        <ArrowRight className="size-3.5" />
      </Link>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {doc.summary && (
            <section>
              <h2 className="text-lg font-semibold">Summary</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/90">
                {doc.summary.split("\n\n").map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </section>
          )}

          {doc.keyTopics && doc.keyTopics.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">Key topics</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {doc.keyTopics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground/80"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </section>
          )}

          {questions.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">Questions people ask</h2>
              <ul className="mt-3 space-y-2">
                {questions.map((q) => (
                  <li key={q}>
                    <Link
                      href={`/ask?scope=document&slug=${encodeURIComponent(slug)}&label=${encodeURIComponent(doc.title)}`}
                      className="text-sm text-primary underline underline-offset-2"
                    >
                      {q}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="min-w-0">
          <h2 className="text-sm font-medium text-muted-foreground">Source document</h2>
          <div className="mt-3">
            <PdfViewer fileUrl={fileUrl} />
          </div>
          {doc.sourceUrl && (
            <a
              href={doc.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              View on pakistancode.gov.pk
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}
