import type { Metadata } from "next";
import Link from "next/link";
import { getCategories } from "@/lib/catalog";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Browse",
  description: "Browse Pakistan's 525 federal statutes across 21 categories.",
};

export default async function BrowsePage() {
  const categories = await getCategories();
  const totalDocuments = categories.reduce((sum, c) => sum + c.documentCount, 0);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Browse the corpus</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        {totalDocuments} federal statutes across {categories.length} categories, sourced from
        pakistancode.gov.pk.
      </p>

      <ul className="mt-10 divide-y divide-border">
        {categories.map((category) => (
          <li key={category.slug} className="py-5">
            <Link href={`/browse/${category.slug}`} className="group block">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-medium text-foreground group-hover:text-primary">{category.name}</h2>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {category.documentCount} law{category.documentCount === 1 ? "" : "s"}
                </span>
              </div>
              {category.blurb && (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{category.blurb}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
