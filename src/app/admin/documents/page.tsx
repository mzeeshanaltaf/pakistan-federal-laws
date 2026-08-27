import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCategories } from "@/lib/catalog";
import { getAdminDocuments } from "@/lib/admin-documents-queries";
import { AdminDocumentsPanel } from "@/components/admin/admin-documents-panel";

export const metadata: Metadata = {
  title: "Documents",
  robots: { index: false, follow: false },
};

export default async function AdminDocumentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }
  if (session.user.role !== "admin") {
    notFound();
  }

  const [categories, documents] = await Promise.all([getCategories(), getAdminDocuments()]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
      <p className="mt-3 text-muted-foreground">Upload new statutes and manage what&apos;s already ingested.</p>

      <div className="mt-10">
        <AdminDocumentsPanel
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          initialDocuments={documents}
        />
      </div>
    </div>
  );
}
