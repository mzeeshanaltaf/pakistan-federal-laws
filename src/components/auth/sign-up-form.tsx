"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/auth/google-icon";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 8) {
      toast.error("Please fill in all fields — password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await authClient.signUp.email({ name, email, password });
      if (error) {
        toast.error(error.message || "Could not sign up. Please try again.");
        return;
      }
      // requireEmailVerification means sign-up returns no session — always
      // hand off to the verify screen, never assume the user is logged in.
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/ask" });
      if (error) {
        toast.error(error.message || "Could not sign up with Google.");
        setGoogleLoading(false);
      }
    } catch {
      toast.error("Could not sign up with Google.");
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={googleLoading}
        onClick={handleGoogle}
      >
        {googleLoading ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon className="size-4" />}
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 px-3.5 py-2"
          />
        </div>

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
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 px-3.5 py-2"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 px-3.5 py-2"
          />
        </div>

        <Button type="submit" disabled={submitting} size="lg" className="w-full">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
