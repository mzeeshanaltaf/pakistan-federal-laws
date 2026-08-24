import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getAllCategorySlugs, getCategoryBySlug, getDocumentsByCategory } from "@/lib/catalog";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs();
  return slugs.map((category) => ({ category }));
}

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  return {
    title: category.name,
    description: category.blurb ?? `${category.documentCount} federal statutes in ${category.name}.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const documents = await getDocumentsByCategory(slug);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
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
    </div>
  );
}
