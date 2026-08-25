# Phase 7 — Auth core: Better Auth, schema, Google OAuth, admin seeding

See [00-overview.md](00-overview.md) for full context. This phase is backend/schema plumbing only — no sign-in/sign-up UI yet (that's [phase-8](phase-8-signin-signup-verification.md)). It exists on its own because it carries the one genuinely unverified technical assumption in the whole auth build and everything downstream depends on it.

## Why this is its own phase

Qanoon was built "fully public, no login" (`00-overview.md`'s original Access decision). Adding real accounts means landing Better Auth's own tables (`user`, `session`, `account`, `verification`) inside the existing `pak_laws` Postgres schema — not a new database, per the project's standing architecture rule. Better Auth's CLI has to respect a non-default `search_path`, which is untested. Verify that in isolation before any UI is built on top of it.

## Confirmed decisions this phase implements

- Admin access via Better Auth's `admin` plugin, seeded by an `ADMIN_EMAILS` env var checked on user creation (not manual SQL promotion).
- No linking of old `anon_id`-based chat history to new accounts — old anonymous `chat_sessions` rows stay untouched; `chat_sessions.user_id` is added as a new, nullable column.

## Dependencies

```
npm install better-auth resend
npm install -D tsx
```
`better-auth` bundles the core, `better-auth/plugins/email-otp`, `better-auth/plugins/admin`, `better-auth/react`, and `better-auth/client/plugins` — no separate packages. `resend` is needed here (not just in Phase 9) because `auth.ts`'s `emailOTP` plugin requires a working `sendVerificationOTP` callback from the moment `requireEmailVerification: true` is turned on. `tsx` runs the new schema-apply script.

## Schema — two-step, strictly ordered

No ORM or migration framework exists in this repo — `db/schema.sql` is a single idempotent file applied manually. Keep that convention, but make application reusable:

1. **`src/lib/auth.ts`** passes `database: pool` — the *existing* cached `Pool` from `src/lib/db.ts`, which already carries `options: "-c search_path=pak_laws,public"`. Run:
   ```
   npx @better-auth/cli@latest migrate
   ```
   This should create `user`, `session`, `account`, `verification` (plus the `admin` plugin's `role`/`banned`/`banReason`/`banExpires` columns on `user`) inside `pak_laws`, since the CLI reads the actual `database` adapter from `auth.ts` rather than a raw connection string.
   **Verify before proceeding**: `SELECT table_schema, table_name FROM information_schema.tables WHERE table_name IN ('user','session','account','verification');` — confirm `table_schema = 'pak_laws'`, not `public`. If it lands in `public`, do not improvise a workaround inline — stop and reconsider the adapter config (e.g. an explicit Kysely instance with a schema-qualified search path) before continuing.

2. **New `scripts/apply-sql.ts`** — a generic SQL-file runner against the shared pool (reads a path arg, executes it, calls `pool.end()` so the one-off process exits cleanly). Reusable for this file and any future schema addition, replacing the old uncommitted one-off-script pattern noted in `docs/status.md`'s Phase 1 section.

3. **New `db/schema-app.sql`** (companion file, same precedent as `db/create-vector-index.sql`) — run only *after* step 1 succeeds:
   ```sql
   ALTER TABLE pak_laws.chat_sessions ADD COLUMN IF NOT EXISTS user_id text REFERENCES pak_laws."user" (id) ON DELETE CASCADE;
   CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON pak_laws.chat_sessions (user_id);

   CREATE TABLE IF NOT EXISTS pak_laws.message_reactions (
       id            bigserial PRIMARY KEY,
       message_id    bigint NOT NULL REFERENCES pak_laws.chat_messages (id) ON DELETE CASCADE,
       user_id       text NOT NULL REFERENCES pak_laws."user" (id) ON DELETE CASCADE,
       reaction_type text NOT NULL CHECK (reaction_type IN ('thumbs_up', 'thumbs_down', 'bookmark')),
       created_at    timestamptz NOT NULL DEFAULT now(),
       UNIQUE (message_id, user_id, reaction_type)
   );
   CREATE INDEX IF NOT EXISTS message_reactions_message_id_idx ON pak_laws.message_reactions (message_id);
   CREATE INDEX IF NOT EXISTS message_reactions_user_id_idx ON pak_laws.message_reactions (user_id);
   ```
   Apply with `npx tsx --env-file=.env.local scripts/apply-sql.ts db/schema-app.sql`. `chat_sessions.user_id` stays **nullable** — old anon rows have none, and it's the application layer (Phase 10) that will enforce every *new* session having one, not a DB constraint. `message_reactions` exists here (schema only) even though it isn't used until Phase 11 — landing both new-table additions in one migration file avoids a second migration-ordering exercise later.

## `src/lib/auth.ts`

```ts
import { betterAuth } from "better-auth";
import { emailOTP, admin } from "better-auth/plugins";
import { pool } from "./db";
import { sendOtpEmail } from "./email";

const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export const auth = betterAuth({
  database: pool,
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  socialProviders: {
    google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
  },
  emailVerification: { sendOnSignIn: true, autoSignInAfterVerification: true },
  plugins: [
    emailOTP({
      overrideDefaultEmailVerification: true,
      disableSignUp: true,
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 3,
      storeOTP: "hashed",
      rateLimit: { window: 60, max: 3 },
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "email-verification" && type !== "forget-password") return;
        await sendOtpEmail(email, otp, type);
      },
    }),
    admin(),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (adminEmails.includes(user.email.toLowerCase())) {
            return { data: { ...user, role: "admin" } };
          }
        },
      },
    },
  },
});
```

## `src/lib/auth-client.ts`

```ts
import { createAuthClient } from "better-auth/react";
import { emailOTPClient, adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({ plugins: [emailOTPClient(), adminClient()] });
```

## `src/app/api/auth/[...all]/route.ts`

Exports Better Auth's Next.js handler (`toNextJsHandler(auth)`) for both `GET`/`POST`.

## `src/lib/email.ts`

`sendOtpEmail(email, otp, type)` via the Resend SDK. **Known gotcha, defend against it here**: `RESEND_FROM_EMAIL` can arrive quoted (`"App <noreply@...>"`) in some deploy environments even though it's unquoted locally — strip surrounding quotes defensively before passing `from` to Resend, or every send 422s in production with no local repro. Guard `sendVerificationOTP` to only actually send for `type === "email-verification" || type === "forget-password"` (already done in `auth.ts` above) so the unused `sign-in`/`change-email` OTP types can never quietly mail users.

## `.env.example` additions

```
# Better Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Comma-separated emails granted the "admin" role on sign-up (src/lib/auth.ts databaseHooks)
ADMIN_EMAILS=

# Resend — OTP verification / password-reset emails
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```
All six already have real values in `.env.local` (provisioned ahead of this work) — this just documents them for a machine that doesn't have it, matching the existing `.env.example` convention.

## Verification

- `information_schema.tables` check above (schema landed in `pak_laws`, not `public`).
- `information_schema.columns` check that `user` has a `role` column (from the `admin` plugin).
- A throwaway `POST /api/auth/sign-up/email` (curl) with an `ADMIN_EMAILS`-listed address, then `SELECT role FROM "user" WHERE email = $1` confirms `'admin'`.
- `db/schema-app.sql` re-run twice is a no-op (idempotency check, matching every other schema file in this repo).
- No UI to click through yet — this phase is complete when the schema and config are in place and the checks above pass, not when a human can sign in (that's Phase 8).

**Next:** [phase-8-signin-signup-verification.md](phase-8-signin-signup-verification.md)
