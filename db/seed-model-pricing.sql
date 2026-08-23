-- Seed current provider pricing as of 2026-08-23. Prices are data, not
-- constants, so a future price change is an INSERT of a new effective_from
-- row, not an edit of these values.
--
-- OpenAI: from openai.com pricing (GPT-5.6 Luna cut 80% on 2026-07-30;
-- text-embedding-3-small has no output tokens).
-- Claude: from the claude-api skill's cached pricing table (Sonnet 5 is in
-- its intro-pricing window through 2026-08-31) — the model Qanoon's Phase 3
-- summaries are authored with in-session.

INSERT INTO pak_laws.model_pricing (provider, model, input_per_mtok, cached_input_per_mtok, output_per_mtok)
VALUES
    ('openai', 'gpt-5.6-luna', 0.20, 0.02, 1.20),
    ('openai', 'text-embedding-3-small', 0.02, NULL, NULL),
    ('anthropic', 'claude-sonnet-5', 2.00, NULL, 10.00)
ON CONFLICT (provider, model, effective_from) DO NOTHING;
