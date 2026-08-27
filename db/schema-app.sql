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

-- Lifetime activity counters, incremented in src/app/api/chat/route.ts as
-- conversations/questions happen and never decremented. Deleting a chat
-- thread hard-deletes its chat_sessions/chat_messages rows (see the DELETE
-- route), which would otherwise make the dashboard's "Conversations" and
-- "Questions asked" totals drop after a delete — these columns give the
-- dashboard an all-time total that survives it. The live, current count of
-- still-existing conversations is still available separately via
-- `count(*) FROM chat_sessions WHERE user_id = ...`.
ALTER TABLE pak_laws."user" ADD COLUMN IF NOT EXISTS "lifetimeConversations" integer NOT NULL DEFAULT 0;
ALTER TABLE pak_laws."user" ADD COLUMN IF NOT EXISTS "lifetimeQuestionsAsked" integer NOT NULL DEFAULT 0;
-- Counts both roles (user + assistant), matching the admin dashboard's
-- existing "messages" convention — distinct from lifetimeQuestionsAsked,
-- which is user-role only (the user dashboard's convention).
ALTER TABLE pak_laws."user" ADD COLUMN IF NOT EXISTS "lifetimeMessages" integer NOT NULL DEFAULT 0;

-- Denormalized alongside session_id/message_id (which are ON DELETE SET
-- NULL, not cascaded) so a deleted chat thread's token/cost history stays
-- attributable to the user it belongs to — the whole point of usage_events
-- being a permanent cost ledger (see CLAUDE.md). Populated at insert time in
-- src/lib/usage.ts; NULL for ingest-pipeline events (summary/ingest_embedding
-- calls have no end user).
ALTER TABLE pak_laws.usage_events ADD COLUMN IF NOT EXISTS user_id text REFERENCES pak_laws."user" (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS usage_events_user_id_idx ON pak_laws.usage_events (user_id);

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
