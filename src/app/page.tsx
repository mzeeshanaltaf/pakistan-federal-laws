import Link from "next/link";
import { ArrowRight, ChevronDown, ExternalLink } from "lucide-react";
import { getCategories } from "@/lib/catalog";
import { MessageContent } from "@/components/chat/message-content";
import type { Citation } from "@/lib/rag-prompt";

export const revalidate = 3600;

const EXAMPLE_QUESTION = "What notice period must a landlord give before evicting a tenant?";

const EXAMPLE_ANSWER = `The context does not specify a general notice period for every eviction. Under section 17, the landlord applies to the Controller, who must give the tenant a reasonable opportunity to show cause before ordering eviction. [2]

A special rule applies where the landlord has died, or is a salaried employee who has retired or will retire within six months: written notice must require the tenant to vacate within **two months from receiving the notice**. [1] If the tenant does not leave within that period, the Controller may order summary ejectment after notice and satisfaction that the request is bona fide. [7]

This answer reflects the statutory text provided, which may have been amended since enactment; it is not legal advice.`;

const EXAMPLE_CITATIONS: Citation[] = [
  {
    n: 1,
    documentId: "259f159a-b999-41d2-bd4a-922d68bcf674",
    documentSlug: "cantonments-rent-restriction-act-1963",
    documentTitle: "Cantonments Rent Restriction Act, 1963",
    categoryName: "Civil Laws",
    sourceUrl: "https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-cJmd-sg-jjjjjjjjjjjjj",
    pageStart: 11,
    pageEnd: 11,
    sectionRef: null,
    snippet:
      "17A. Eviction of tenants where the landlord is a salaried employee, widow or minor orphan. Notwithstanding anything contained in this Act or any other law for time being in force…",
  },
  {
    n: 2,
    documentId: "259f159a-b999-41d2-bd4a-922d68bcf674",
    documentSlug: "cantonments-rent-restriction-act-1963",
    documentTitle: "Cantonments Rent Restriction Act, 1963",
    categoryName: "Civil Laws",
    sourceUrl: "https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-cJmd-sg-jjjjjjjjjjjjj",
    pageStart: 8,
    pageEnd: 8,
    sectionRef: "17",
    snippet:
      "17. Eviction of tenant. After the commencement of this Act, no tenant, whether before or after the termination of his tenancy, shall be evicted from the building in his possession…",
  },
  {
    n: 7,
    documentId: "259f159a-b999-41d2-bd4a-922d68bcf674",
    documentSlug: "cantonments-rent-restriction-act-1963",
    documentTitle: "Cantonments Rent Restriction Act, 1963",
    categoryName: "Civil Laws",
    sourceUrl: "https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-cJmd-sg-jjjjjjjjjjjjj",
    pageStart: 11,
    pageEnd: 12,
    sectionRef: null,
    snippet:
      "Provided that the benefit of exchange shall not be available to the tenant who refuses…",
  },
];

const FEATURED_CITATION = EXAMPLE_CITATIONS[0];

const STEPS = [
  {
    n: "01",
    title: "Ask in plain language",
    body: "Type a real question the way you'd ask a person. No need to already know which Act or section covers it.",
  },
  {
    n: "02",
    title: "Qanoon searches the statute text",
    body: "Hybrid retrieval combines meaning-based search with exact keyword matching across all 525 laws, so a specific section name or term isn't missed.",
  },
  {
    n: "03",
    title: "Get an answer you can check",
    body: "Every claim is tied to a citation that opens the exact page of the source PDF — so you never have to just take the answer's word for it.",
  },
];

const FAQS = [
  {
    q: "Is this legal advice?",
    a: "No. Qanoon explains what the statute text says in plain language — it isn't a substitute for a lawyer, and you should always verify against the cited source before relying on an answer.",
  },
  {
    q: "Which laws are covered?",
    a: "All 525 of Pakistan's federal statutes across 21 categories, sourced from pakistancode.gov.pk. Provincial laws, case law, and legal precedent aren't part of the corpus.",
  },
  {
    q: "How current is the statute text?",
    a: "Qanoon reads from the text published at pakistancode.gov.pk. Laws can be amended after that text was published, which is exactly why every answer links to the source page — check it before relying on the answer.",
  },
  {
    q: "Do I need to sign up?",
    a: "No. Qanoon is fully anonymous — there's no account, login, or email required to ask a question. See the Privacy Policy for how anonymous sessions work.",
  },
  {
    q: "What happens if my question isn't covered by the statutes?",
    a: "Qanoon says so plainly rather than guessing or padding an answer. If the retrieved statute text doesn't address your question, the response will tell you that directly.",
  },
  {
    q: "Is Qanoon free?",
    a: "Yes. It's a public civic tool — no cost, no paywall, no ads.",
  },
  {
    q: "I found a wrong citation or a bug — how do I report it?",
    a: "Use the Contact page. Every message is read.",
  },
];

export default async function HomePage() {
  const categories = await getCategories();

  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-5xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
        <div className="mb-4 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG, no optimization needed */}
          <img src="/logo.svg" alt="" width={24} height={24} className="rounded-md" />
          <p className="text-sm font-medium text-primary">Qanoon &middot; قانون</p>
        </div>
        <h1 className="max-w-2xl text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          Ask Pakistan&apos;s federal statutes a question.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground text-balance">
          Qanoon answers in plain language, grounded strictly in the text of 525 federal laws, with citations
          that open the exact page you&apos;d need to check yourself.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/ask"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ask a question
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/browse"
            className="text-sm font-medium text-foreground/80 underline underline-offset-4 hover:text-foreground"
          >
            Browse all 21 categories
          </Link>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="mb-6 text-sm font-medium text-muted-foreground">An actual answer, unedited</p>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <div className="mb-5 flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {EXAMPLE_QUESTION}
                </div>
              </div>
              <MessageContent text={EXAMPLE_ANSWER} citations={EXAMPLE_CITATIONS} />
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-medium text-muted-foreground">Citation [1]</p>
              <p className="mt-1.5 text-sm font-semibold">{FEATURED_CITATION.documentTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {FEATURED_CITATION.categoryName} &middot; p. {FEATURED_CITATION.pageStart}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{FEATURED_CITATION.snippet}</p>
              <a
                href={FEATURED_CITATION.sourceUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2"
              >
                View on pakistancode.gov.pk <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="text-xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-8 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n}>
              <p className="font-mono text-sm text-primary">{step.n}</p>
              <p className="mt-2 font-medium text-foreground">{step.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">525 laws, 21 categories</h2>
          <Link href="/browse" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            View all
          </Link>
        </div>
        <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {categories.map((category) => (
            <li key={category.slug} className="border-b border-border/70 py-3">
              <Link
                href={`/browse/${category.slug}`}
                className="group flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="font-medium text-foreground group-hover:text-primary">{category.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{category.documentCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 className="text-xl font-semibold tracking-tight">Frequently asked questions</h2>
          <div className="mt-6 divide-y divide-border">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-foreground marker:content-none">
                  {faq.q}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <h2 className="text-xl font-semibold tracking-tight">Still have a question?</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Ask Qanoon directly, or reach out if something looks wrong.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/ask"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ask a question
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/contact"
            className="text-sm font-medium text-foreground/80 underline underline-offset-4 hover:text-foreground"
          >
            Contact us
          </Link>
        </div>
      </section>
    </div>
  );
}
