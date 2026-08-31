import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import {
  CATEGORY_PAGE_SIZE,
  getAllCategorySlugs,
  getCategoryBySlug,
  getDocumentsByCategoryPage,
} from "@/lib/catalog";
import { JsonLd } from "@/components/json-ld";
import { truncateForSerp } from "@/lib/seo";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs();
  return slugs.map((category) => ({ category }));
}

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const { page: pageParam } = await searchParams;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  const page = Math.max(1, Number(pageParam) || 1);
  return {
    title: category.name,
    description: truncateForSerp(category.blurb ?? `${category.documentCount} federal statutes in ${category.name}.`),
    // Every page in the sequence self-canonicalizes — page 2+ must never
    // canonical back to page 1, or its own listing would be dropped from
    // the index as a "duplicate."
    alternates: { canonical: page > 1 ? `/browse/${slug}?page=${page}` : `/browse/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category: slug } = await params;
  const { page: pageParam } = await searchParams;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const { documents, total } = await getDocumentsByCategoryPage(slug, page);
  const totalPages = Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE));
  if (page > totalPages) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://qanoon.zeeshanai.cloud";

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Browse", item: `${siteUrl}/browse` },
            { "@type": "ListItem", position: 2, name: category.name, item: `${siteUrl}/browse/${slug}` },
          ],
        }}
      />
      <p className="text-sm text-muted-foreground">
        <Link href="/browse" className="hover:text-foreground">
          Browse
        </Link>
        <span className="mx-1.5">/</span>
        {category.name}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{category.name}</h1>
      {category.blurb && <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{category.blurb}</p>}

      <Link
        href={`/ask?scope=category&slug=${encodeURIComponent(slug)}&label=${encodeURIComponent(category.name)}`}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4"
      >
        Ask about this category
        <ArrowRight className="size-3.5" />
      </Link>

      <ul className="mt-10 divide-y divide-border">
        {documents.map((doc) => (
          <li key={doc.slug} className="py-4">
            <Link href={`/law/${doc.slug}`} className="group block">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-medium text-foreground group-hover:text-primary">{doc.title}</h2>
                {doc.instrumentType && (
                  <span className="shrink-0 text-xs text-muted-foreground">{doc.instrumentType}</span>
                )}
              </div>
              {doc.summaryShort && (
                <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {doc.summaryShort}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-between gap-4 text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Link
              href={page === 2 ? `/browse/${slug}` : `/browse/${slug}?page=${page - 1}`}
              className="inline-flex items-center gap-1 font-medium text-foreground/80 hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/browse/${slug}?page=${page + 1}`}
              className="inline-flex items-center gap-1 font-medium text-foreground/80 hover:text-foreground"
            >
              Next
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
