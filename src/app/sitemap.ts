import type { MetadataRoute } from "next";
import { getAllCategorySlugs, getAllDocumentSlugs } from "@/lib/catalog";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://qanoon.zeeshanai.cloud";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categorySlugs, documentSlugs] = await Promise.all([getAllCategorySlugs(), getAllDocumentSlugs()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE_URL}/ask`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/browse`, changeFrequency: "monthly", priority: 0.8 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categorySlugs.map((slug) => ({
    url: `${BASE_URL}/browse/${slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const documentRoutes: MetadataRoute.Sitemap = documentSlugs.map((slug) => ({
    url: `${BASE_URL}/law/${slug}`,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...categoryRoutes, ...documentRoutes];
}
