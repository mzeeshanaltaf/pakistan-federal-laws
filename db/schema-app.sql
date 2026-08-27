-- Qanoon app-schema additions on top of Better Auth's own tables (created by
-- `npx @better-auth/cli@latest migrate`, not here). Idempotent — safe to
-- re-run. Apply only after the Better Auth migrate step has landed `user`.
--
-- chat_sessions.user_id stays nullable: old anonymous rows have none, and
-- it's the application layer (Phase 10) that enforces every *new* session
-- having one, not a DB constraint.

-- Known gotcha: `@better-auth/cli@latest` (published 1.4.21) bundles an
-- older better-auth core than the installed npm package (1.7.1 as of this
-- phase) and generates migrations from ITS OWN bundled schema, not the
-- project's installed version — so `migrate` silently under-provisions the
-- `account` table. The installed runtime requires a NOT NULL `issuer`
-- column (added for OIDC/account-linking; email/password rows use it too)
-- plus a unique (issuer, accountId) index, neither of which the CLI's
-- migration created — confirmed by diffing node_modules/@better-auth/core's
-- get-tables.mjs field list against information_schema.columns. Sign-up
-- 500s with `column "issuer" of relation "account" does not exist` until
-- this runs. Re-check this gap whenever `better-auth` is upgraded.
ALTER TABLE pak_laws.account ADD COLUMN IF NOT EXISTS issuer text NOT NULL DEFAULT '';
ALTER TABLE pak_laws.account ALTER COLUMN issuer DROP DEFAULT;
CREATE UNIQUE INDEX IF NOT EXISTS account_issuer_account_id_idx ON pak_laws.account (issuer, "accountId");

ALTER TABLE pak_laws.chat_sessions ADD COLUMN IF NOT EXISTS user_id text REFERENCES pak_laws."user" (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON pak_laws.chat_sessions (user_id);

-- Every signed-up user starts with 10 message credits (set via auth.ts's
-- additionalFields defaultValue on new sign-ups); admins bypass the limit
-- entirely in application code (src/app/api/chat/route.ts), so this column
-- is meaningless for admin rows.
ALTER TABLE pak_laws."user" ADD COLUMN IF NOT EXISTS "messageCredits" integer NOT NULL DEFAULT 10;

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
