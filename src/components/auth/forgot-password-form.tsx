"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }

    setSubmitting(true);
    try {
      // Always returns { success: true }, even for an email with no account
      // (anti-enumeration) — copy and behavior here must stay neutral either way.
      const { error } = await authClient.emailOtp.requestPasswordReset({ email });
      if (error) {
        toast.error(error.message || "Could not send a code. Please try again.");
        return;
      }
      toast.success("If an account exists for that email, we've sent a code.");
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="mt-3 text-muted-foreground">
          Enter your email and, if an account exists for it, we&apos;ll send a 6-digit code to reset
          your password.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 px-3.5 py-2"
            />
          </div>

          <Button type="submit" disabled={submitting} size="lg" className="w-full">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitting ? "Sending…" : "Send reset code"}
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
