"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, ShieldCheck, User, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { isSafeAvatarUrl } from "@/lib/avatar-url";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function SiteHeader() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  async function handleSignOut() {
    setAccountMenuOpen(false);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG, no optimization needed */}
          <img src="/logo.svg" alt="" width={28} height={28} className="rounded-md" />
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

          {!isPending && !session && (
            <span className="ml-1 flex items-center gap-1">
              <Link
                href="/sign-in"
                className="rounded-md px-3 py-1.5 font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Sign in
              </Link>
              <Button size="sm" nativeButton={false} render={<Link href="/sign-up" />}>
                Sign up
              </Button>
            </span>
          )}

          {session && (
            <Popover open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Account menu"
                    className="ml-1 overflow-hidden rounded-full"
                  >
                    {isSafeAvatarUrl(session.user.image) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- streamed from a private-storage proxy route, not an optimizable remote URL
                      <img src={session.user.image} alt="" className="size-full object-cover" />
                    ) : (
                      <UserRound className="size-4" />
                    )}
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-56">
                <div className="px-1.5 py-1">
                  <p className="truncate text-sm font-medium">{session.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
                </div>
                <div className="my-1 h-px bg-border" />
                <Link
                  href="/dashboard"
                  onClick={() => setAccountMenuOpen(false)}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted"
                >
                  <LayoutDashboard className="size-4" />
                  Dashboard
                </Link>
                <Link
                  href="/profile"
                  onClick={() => setAccountMenuOpen(false)}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted"
                >
                  <User className="size-4" />
                  Profile
                </Link>
                {session.user.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted"
                  >
                    <ShieldCheck className="size-4" />
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </PopoverContent>
            </Popover>
          )}

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
