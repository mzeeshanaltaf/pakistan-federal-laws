import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <ForgotPasswordForm />
    </div>
  );
}
