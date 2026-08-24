import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Send feedback, report a bug, or ask a question about Qanoon.",
};

// Short error codes set by the API route's redirect (?error=...) mapped to
// human-readable copy. Keep keys in sync with src/app/api/contact/route.ts's
// fail() calls.
const ERROR_MESSAGES: Record<string, string> = {
  fields: "Please fill in all fields.",
  email: "Please enter a valid email address.",
  length: "Message must be 5000 characters or fewer.",
  rate: "Too many submissions. Please try again later.",
  server: "Service is temporarily unavailable. Please try again later.",
  parse: "Invalid submission. Please try again.",
};

interface ContactPageProps {
  searchParams: Promise<{ sent?: string; error?: string }>;
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const { sent, error } = await searchParams;
  const initialError = error ? (ERROR_MESSAGES[error] ?? "Something went wrong. Please try again.") : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Contact &amp; feedback</h1>
      <p className="mt-3 max-w-lg text-muted-foreground">
        Found a bug, have an idea, or spotted a wrong citation? Send a message — we read everything.
      </p>

      <div className="mt-10 rounded-xl border border-border bg-card p-6 sm:p-8">
        <ContactForm initialSuccess={!!sent} initialError={initialError} />
      </div>
    </div>
  );
}
