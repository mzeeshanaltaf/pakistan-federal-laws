import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // The real security boundary for this route — middleware.ts's cookie
  // check is a fast UX-level redirect, not a DB-verified session/role check.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }
  if (session.user.role !== "admin") {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-3 text-muted-foreground">
        Signed in as {session.user.email}. Usage and moderation dashboards land here in a later phase.
      </p>
    </div>
  );
}
