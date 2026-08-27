import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  // The real security boundary for this route — middleware.ts's cookie
  // check is a fast UX-level redirect, not a DB-verified session check.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-3 text-muted-foreground">Update your name, profile picture, and password.</p>

      <ProfileForm name={session.user.name} email={session.user.email} image={session.user.image ?? null} />
    </div>
  );
}
