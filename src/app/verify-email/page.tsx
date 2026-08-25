import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <div className="mx-auto w-full max-w-md flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <Suspense>
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}
