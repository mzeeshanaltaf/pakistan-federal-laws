import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignUpPage() {
  return (
    <div className="mx-auto w-full max-w-md flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-3 text-muted-foreground">Sign up to save your chat history with Qanoon.</p>

      <div className="mt-10 rounded-xl border border-border bg-card p-6 sm:p-8">
        <SignUpForm />
      </div>
    </div>
  );
}
