import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Qanoon collects, why, and who it's shared with.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "24 August 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground sm:text-base">
        <section>
          <p>
            Qanoon is a free, public tool for reading Pakistan&apos;s federal statutes in plain language. There
            is no account, login, or sign-up — this page explains the little data the app does handle, and why.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">What we collect</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="font-medium text-foreground">An anonymous session id.</strong> The first time
              you open Qanoon, your browser generates a random id and stores it in{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">localStorage</code> on your device. It
              isn&apos;t linked to your name, email, or any other identity — it just lets a chat session (and its
              history, if you return) stay attached to your browser.
            </li>
            <li>
              <strong className="font-medium text-foreground">The questions you ask and the answers given.</strong>{" "}
              These are stored against your session id so a conversation can be resumed. They are not reviewed
              individually or used to build a profile of you.
            </li>
            <li>
              <strong className="font-medium text-foreground">Your IP address, briefly.</strong> Used only to
              rate-limit requests (so the free service can&apos;t be overwhelmed by a single source) and is not
              stored alongside your questions or answers.
            </li>
            <li>
              <strong className="font-medium text-foreground">A theme preference.</strong> Whether you&apos;re
              using light or dark mode is saved locally in your browser, not sent to us.
            </li>
            <li>
              <strong className="font-medium text-foreground">Contact form submissions.</strong> If you use the{" "}
              <Link href="/contact" className="text-primary underline underline-offset-4 hover:text-primary/80">
                Contact page
              </Link>
              , the name, email, and message you provide are sent so we can read and reply to you. We don&apos;t
              use them for anything else.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">What we don&apos;t do</h2>
          <p className="mt-3">
            No advertising or tracking cookies, no analytics scripts that follow you across sites, no selling or
            renting of data to third parties, and no use of your questions to identify or contact you unless you
            reach out first through the Contact page.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Who processes it</h2>
          <p className="mt-3">A small number of service providers handle data on our behalf, only as needed to run the app:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="font-medium text-foreground">OpenAI</strong> — processes the text of your
              question (and relevant statute excerpts) to generate an answer.
            </li>
            <li>
              <strong className="font-medium text-foreground">Upstash</strong> — briefly holds your IP address to
              enforce rate limits.
            </li>
            <li>
              <strong className="font-medium text-foreground">Our workflow automation (n8n)</strong> — delivers
              contact-form submissions to us.
            </li>
          </ul>
          <p className="mt-3">
            The statute PDFs themselves are stored on our own private storage and served through the app; they
            are sourced from{" "}
            <a
              href="https://pakistancode.gov.pk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              pakistancode.gov.pk
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Your choices</h2>
          <p className="mt-3">
            Clearing your browser&apos;s local storage removes your anonymous id and disconnects you from any
            saved chat history — a new, unlinked id is created the next time you visit. Please avoid including
            personal or sensitive information in the questions you ask; they&apos;re meant for questions about
            statute text, not personal circumstances.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Children</h2>
          <p className="mt-3">
            Qanoon is a general-audience civic reference tool and isn&apos;t directed at children. We don&apos;t
            knowingly collect information from children.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Changes to this policy</h2>
          <p className="mt-3">
            If how Qanoon handles data changes, this page will be updated and the date at the top revised
            accordingly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Questions</h2>
          <p className="mt-3">
            For anything about this policy or your data, use the{" "}
            <Link href="/contact" className="text-primary underline underline-offset-4 hover:text-primary/80">
              Contact page
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
