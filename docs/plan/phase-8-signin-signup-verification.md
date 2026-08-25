# Phase 8 — Sign-in, sign-up, session-aware header, email verification

See [00-overview.md](00-overview.md) for context, and [phase-7-auth-core.md](phase-7-auth-core.md) for the Better Auth config this phase builds a UI on top of.

## Confirmed decision this phase implements

`/ask` stays fully browsable while signed out (scope picker, suggested questions, categories) — sign-in is not forced app-wide. This phase only adds the sign-in/sign-up surfaces and header state; gating the chat input itself is [phase-10](phase-10-route-protection.md).

## Why email verification is bundled in here, not with password reset

Sign-up with `requireEmailVerification: true` (Phase 7) returns no session until the OTP is entered — without a verify screen in this same phase, a freshly signed-up account is unusable and untestable. Forgot/reset password ([phase-9](phase-9-forgot-reset-password.md)) is a separate recovery flow with no such dependency on this phase's screens, so it's kept out.

**Before writing these screens, invoke the `better-auth-email-otp` skill directly** (`references/ui-screens.md`) rather than guessing the UI shape — its patterns for the verify screen (resend cooldown, spam-folder note, 6-digit input) apply here.

## Files

| File | Purpose |
|---|---|
| `src/components/auth/sign-in-form.tsx` | Client component. Email/password via `authClient.signIn.email()`; Google button via `authClient.signIn.social({ provider: "google" })`. On `EMAIL_NOT_VERIFIED`, redirect to `/verify-email?email=...` (a fresh code is already sent by `sendOnSignIn: true`). Errors via `sonner` toast. |
| `src/components/auth/sign-up-form.tsx` | `authClient.signUp.email()`. Response has no session (`token: null`) — always redirect to `/verify-email?email=...`, never assume the user is logged in. |
| `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx` | Thin pages rendering the forms above. |
| `src/app/verify-email/page.tsx` | 6-digit OTP input, reads `email` from the query string, `authClient.emailOtp.verifyEmail({ email, otp })` (this **does** create a session, via `autoSignInAfterVerification`) → redirect to `/ask` on success. Resend button calls `authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" })`. Handle `OTP_EXPIRED`, `INVALID_OTP`, `TOO_MANY_ATTEMPTS`. |
| `src/components/site-header.tsx` | New client component, extracted from `layout.tsx`'s inline `<header>`. Uses `authClient.useSession()`. Signed out: "Sign in"/"Sign up" links. Signed in: a small user menu — Dashboard, Admin (only if `session.user.role === "admin"`), Sign out. Build the menu with the existing `Popover` primitive (`src/components/ui/popover.tsx`), not a new shadcn `dropdown-menu` — this is a simple 2-4 item list, not worth a new Base UI wrapper file and dependency. |
| `src/app/layout.tsx` | Swap the inline `<header>` block for `<SiteHeader />`. Mount `<Toaster />` from `sonner` at the root — **currently not mounted anywhere** in this codebase despite `sonner` being a dependency; without it, every toast added in this phase and the next silently does nothing (a known Better Auth integration gotcha, confirmed absent here by inspection of `layout.tsx`). |

No new `Form`/`Label` primitives exist in this codebase and none are needed — hand-roll with the existing `Input`/`Button`/`Textarea` plus plain `<label>` elements, matching the pattern already used on `/contact` (`src/components/contact-form.tsx`).

## Verification

- Sign up with a real address you control → redirected to `/verify-email` → code arrives → entering it signs you in and lands on `/ask`. Confirm `emailVerified` flips to `true` in `SELECT emailVerified FROM "user" WHERE email = $1`.
- Wrong code × 3 → `TOO_MANY_ATTEMPTS`. Resend → a *different* code arrives (same code back would mean a stray idempotency key).
- Google sign-in goes straight through with no OTP prompt (OAuth accounts are pre-verified).
- Header reflects session state correctly in both states; user menu shows "Admin" only for an `ADMIN_EMAILS`-seeded account (no `/admin` page exists to click into yet — that's Phase 13 — just confirm the link renders conditionally).
- Every toast in this phase's flows (sign-in error, sign-up error, OTP error) actually renders — this is the direct test that `<Toaster />` is correctly mounted.

**Next:** [phase-9-forgot-reset-password.md](phase-9-forgot-reset-password.md)
