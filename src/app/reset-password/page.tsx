import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
