import type { MetadataRoute } from "next";
import { getAllCategorySlugsWithUpdatedAt, getAllDocumentSlugsWithUpdatedAt } from "@/lib/catalog";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://qanoon.zeeshanai.cloud";

// lastmod is the one sitemap field Google has said it actually uses to
// decide what to recrawl — changeFrequency/priority are inert. Static
// routes have no per-row updated_at to draw on, so they use build time,
// which is still a real signal (these ship via redeploy, not a live CMS).
const BUILD_TIME = new Date();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categorySlugs, documentSlugs] = await Promise.all([
    getAllCategorySlugsWithUpdatedAt(),
    getAllDocumentSlugsWithUpdatedAt(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: BUILD_TIME, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE_URL}/ask`, lastModified: BUILD_TIME, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/browse`, lastModified: BUILD_TIME, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/contact`, lastModified: BUILD_TIME, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: BUILD_TIME, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categorySlugs.map(({ slug, updatedAt }) => ({
    url: `${BASE_URL}/browse/${slug}`,
    lastModified: updatedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const documentRoutes: MetadataRoute.Sitemap = documentSlugs.map(({ slug, updatedAt }) => ({
    url: `${BASE_URL}/law/${slug}`,
    lastModified: updatedAt,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...categoryRoutes, ...documentRoutes];
}
