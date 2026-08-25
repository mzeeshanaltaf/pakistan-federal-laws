"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const RESEND_COOLDOWN_SECONDS = 60;

function useCooldown(seconds: number) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);
  return { remaining, start: useCallback(() => setRemaining(seconds), [seconds]) };
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (!email) router.replace("/forgot-password");
  }, [email, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code from your email.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await authClient.emailOtp.resetPassword({ email, otp, password });
      if (error) {
        const messages: Record<string, string> = {
          OTP_EXPIRED: "That code has expired. Request a new one below.",
          INVALID_OTP: "That code isn't valid. Please try again.",
          TOO_MANY_ATTEMPTS: "Too many incorrect attempts. Request a new code below.",
        };
        toast.error((error.code && messages[error.code]) || error.message || "Could not reset your password.");
        setOtp("");
        return;
      }
      // resetPassword creates no session (unlike verifyEmail) — send them to sign-in.
      toast.success("Password updated. Sign in with your new password.");
      router.push("/sign-in");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const { error } = await authClient.emailOtp.requestPasswordReset({ email });
      if (error) {
        toast.error(error.message || "Could not send a new code.");
        return;
      }
      cooldown.start();
      setOtp("");
      toast.success("If an account exists for that email, we've sent a new code.");
    } finally {
      setResending(false);
    }
  }

  if (!email) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-3 text-muted-foreground">
          Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>{" "}
          along with your new password.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="otp" className="text-sm font-medium">
              Verification code
            </label>
            <Input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-12 px-3.5 py-2 text-center text-lg tracking-[0.4em]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium">
              New password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 px-3.5 py-2"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="confirm" className="text-sm font-medium">
              Confirm new password
            </label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-10 px-3.5 py-2"
            />
          </div>

          <Button type="submit" disabled={submitting} size="lg" className="w-full">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitting ? "Resetting…" : "Reset password"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={resending || cooldown.remaining > 0}
            onClick={handleResend}
            className="w-full"
          >
            {resending ? <Loader2 className="size-4 animate-spin" /> : null}
            {cooldown.remaining > 0 ? `Resend code (${cooldown.remaining}s)` : "Resend code"}
          </Button>
        </form>
      </div>

      <p className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-center text-xs text-muted-foreground">
        Can&apos;t find the email? Check your spam or junk folder — it arrives from{" "}
        <span className="font-medium break-all text-foreground">noreply@verification.zeeshanai.cloud</span>.
      </p>
    </div>
  );
}
