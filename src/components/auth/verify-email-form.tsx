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

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (!email) router.replace("/sign-up");
  }, [email, router]);

  const handleVerify = useCallback(
    async (code: string) => {
      if (code.length !== 6 || verifying) return;
      setVerifying(true);
      try {
        const { error } = await authClient.emailOtp.verifyEmail({ email, otp: code });
        if (error) {
          const messages: Record<string, string> = {
            OTP_EXPIRED: "That code has expired. Request a new one below.",
            INVALID_OTP: "That code isn't valid. Please try again.",
            TOO_MANY_ATTEMPTS: "Too many incorrect attempts. Request a new code below.",
          };
          toast.error((error.code && messages[error.code]) || error.message || "Could not verify that code.");
          setOtp("");
          return;
        }
        // verifyEmail creates a session (autoSignInAfterVerification).
        router.push("/ask");
        router.refresh();
      } finally {
        setVerifying(false);
      }
    },
    [email, router, verifying]
  );

  async function handleResend() {
    setResending(true);
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      if (error) {
        toast.error(error.message || "Could not send a new code.");
        return;
      }
      cooldown.start();
      setOtp("");
      toast.success("A new code is on its way.");
    } finally {
      setResending(false);
    }
  }

  if (!email) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Verify your email</h1>
        <p className="mt-3 text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. Enter it
          below to finish signing in.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify(otp);
          }}
          noValidate
          className="flex flex-col gap-5"
        >
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
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtp(digits);
                if (digits.length === 6) handleVerify(digits);
              }}
              className="h-12 px-3.5 py-2 text-center text-lg tracking-[0.4em]"
            />
          </div>

          <Button type="submit" disabled={verifying || otp.length !== 6} size="lg" className="w-full">
            {verifying ? <Loader2 className="size-4 animate-spin" /> : null}
            {verifying ? "Verifying…" : "Verify"}
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
