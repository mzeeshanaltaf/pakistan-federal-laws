import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const publicSans = Public_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://qanoon.zeeshanai.cloud"),
  title: {
    default: "Qanoon — Pakistan's federal laws, answered",
    template: "%s · Qanoon",
  },
  description:
    "Ask questions about Pakistan's federal statutes in plain language, grounded strictly in the statute text, with citations that open the exact page of the source PDF.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <header className="border-b border-border">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Qanoon
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <Link
                  href="/ask"
                  className="rounded-md px-3 py-1.5 font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Ask
                </Link>
                <Link
                  href="/browse"
                  className="rounded-md px-3 py-1.5 font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Browse
                </Link>
                <Link
                  href="/contact"
                  className="rounded-md px-3 py-1.5 font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Contact
                </Link>
                <ThemeToggle />
              </nav>
            </div>
          </header>

          <main className="flex flex-1 flex-col">{children}</main>

          <footer className="border-t border-border">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
                Qanoon answers are generated from statute text and are not legal advice. Always verify against
                the cited source before relying on an answer. Sourced from{" "}
                <a
                  href="https://pakistancode.gov.pk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  pakistancode.gov.pk
                </a>
                .
              </p>
              <nav className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                <Link href="/contact" className="underline-offset-2 hover:text-foreground hover:underline">
                  Contact
                </Link>
                <Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
                  Privacy Policy
                </Link>
              </nav>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
