# Phase 9 — Forgot / reset password

See [00-overview.md](00-overview.md) for context. Depends on [phase-7](phase-7-auth-core.md)'s `emailOTP` plugin config and Resend sender, and reuses [phase-8](phase-8-signin-signup-verification.md)'s `<Toaster />`/header. Kept separate from Phase 8 because it's a self-contained recovery flow with no dependency on the sign-up/verify screens themselves.

**Before writing these screens, invoke the `better-auth-email-otp` skill directly** (`references/ui-screens.md`) — its forgot-password screen pattern (neutral copy, resend cooldown) applies directly here.

## Files

| File | Purpose |
|---|---|
| `src/app/forgot-password/page.tsx` | Email input → `authClient.emailOtp.requestPasswordReset({ email })`. |
| `src/app/reset-password/page.tsx` | OTP + new-password inputs → `authClient.emailOtp.resetPassword({ email, otp, password })`. On success, redirect to `/sign-in` with a success toast. |

## The one behavior that's easy to get wrong here

`requestPasswordReset` **always** returns `{ success: true }` — including for an email with no account — as an anti-enumeration measure, and sends nothing in that case. UI copy must stay neutral ("If an account exists for that email, we've sent a code") and this flow cannot be manually tested by inventing a fake address and expecting a visible failure.

`resetPassword` does **not** create a session (unlike `verifyEmail` in Phase 8, which does via `autoSignInAfterVerification`). Redirect to `/sign-in` after a successful reset — do not route to `/dashboard` or any protected page expecting the user to already be logged in.

## Verification

- Forgot password with a real address → code arrives → reset with a new password → redirected to `/sign-in` → **old password rejected**, new password works.
- Forgot password with a made-up address → still `{success:true}` in the network tab, **no email actually sent** (check the Resend dashboard, not just the UI response) — confirms the anti-enumeration behavior is intact, not broken.
- Resend on the reset screen produces a different code, same as the verify-email resend check in Phase 8.

**Next:** [phase-10-route-protection.md](phase-10-route-protection.md)
