import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <div className="mx-auto w-full max-w-md flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-3 text-muted-foreground">Welcome back to Qanoon.</p>

      <div className="mt-10 rounded-xl border border-border bg-card p-6 sm:p-8">
        <SignInForm />
      </div>
    </div>
  );
}
