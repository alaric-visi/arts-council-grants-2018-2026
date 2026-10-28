-- schema.sql - Setup table for Arts Council Funding Explorer
--
-- Safe to re-run: every statement is idempotent. Running it against an
-- existing project also removes the old write policy (see step 4).

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.arts_council_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient text NOT NULL,
    activity_name text NOT NULL,
    award_amount numeric NOT NULL,
    award_date date NOT NULL,
    decision_month text,
    decision_quarter text,
    ace_area text,
    local_authority text,
    main_discipline text,
    strand text,
    time_limited_priority text,
    funding_year text NOT NULL,
    source_file text,
    created_at timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.arts_council_grants ENABLE ROW LEVEL SECURITY;

-- 3. Public read access (the dataset is published open data)
DROP POLICY IF EXISTS "Allow public select access" ON public.arts_council_grants;
CREATE POLICY "Allow public select access"
ON public.arts_council_grants
FOR SELECT
TO public
USING (true);

-- 4. No write policies.
--
-- The previous version granted INSERT/UPDATE/DELETE to the `authenticated`
-- role. With Supabase Auth signups enabled (the default), anyone could sign
-- up using the public anon key shipped in the front end and then edit or
-- delete grants. With RLS enabled and no write policy, writes are denied for
-- `anon` and `authenticated`. Imports should use the service_role key from a
-- trusted environment (never the browser): service_role bypasses RLS, so it
-- needs no policy.
DROP POLICY IF EXISTS "Allow writes for authenticated/service roles only" ON public.arts_council_grants;

-- 5. Columns added by the data pipeline (Phase 1). Safe on existing tables.
--    The explorer works with or without them; when present they're used as-is.
ALTER TABLE public.arts_council_grants ADD COLUMN IF NOT EXISTS grant_uid text;
ALTER TABLE public.arts_council_grants ADD COLUMN IF NOT EXISTS recipient_key text;
ALTER TABLE public.arts_council_grants ADD COLUMN IF NOT EXISTS recipient_type text;
ALTER TABLE public.arts_council_grants ADD COLUMN IF NOT EXISTS local_authority_current text;
ALTER TABLE public.arts_council_grants ADD COLUMN IF NOT EXISTS la_code text;

-- grant_uid is stable across pipeline builds, so re-importing updates rows
-- instead of duplicating them. Rows loaded before Phase 1 have no grant_uid;
-- clear them out once (see step 7) before the first upsert.
CREATE UNIQUE INDEX IF NOT EXISTS idx_grants_grant_uid ON public.arts_council_grants(grant_uid);

-- 6. Indexes for common filters
CREATE INDEX IF NOT EXISTS idx_grants_recipient ON public.arts_council_grants(recipient);
CREATE INDEX IF NOT EXISTS idx_grants_discipline ON public.arts_council_grants(main_discipline);
CREATE INDEX IF NOT EXISTS idx_grants_local_authority ON public.arts_council_grants(local_authority);
CREATE INDEX IF NOT EXISTS idx_grants_funding_year ON public.arts_council_grants(funding_year);
CREATE INDEX IF NOT EXISTS idx_grants_ace_area ON public.arts_council_grants(ace_area);
CREATE INDEX IF NOT EXISTS idx_grants_recipient_key ON public.arts_council_grants(recipient_key);

-- 7. Importing a pipeline build (run with the service role, e.g. psql):
--
--   npm run data:build -- --csv build/grants.csv <input files>
--
--   CREATE TEMP TABLE grants_import (LIKE public.arts_council_grants INCLUDING DEFAULTS);
--   \copy grants_import (grant_uid, recipient, recipient_key, recipient_type, activity_name, award_amount, award_date, decision_month, decision_quarter, ace_area, local_authority, local_authority_current, la_code, main_discipline, strand, time_limited_priority, funding_year, source_file) FROM 'build/grants.csv' WITH (FORMAT csv, HEADER true)
--
--   BEGIN;
--   -- First import only: remove rows loaded before grant_uid existed.
--   DELETE FROM public.arts_council_grants WHERE grant_uid IS NULL;
--   INSERT INTO public.arts_council_grants (grant_uid, recipient, recipient_key, recipient_type, activity_name, award_amount, award_date, decision_month, decision_quarter, ace_area, local_authority, local_authority_current, la_code, main_discipline, strand, time_limited_priority, funding_year, source_file)
--   SELECT grant_uid, recipient, recipient_key, recipient_type, activity_name, award_amount, award_date, decision_month, decision_quarter, ace_area, local_authority, local_authority_current, la_code, main_discipline, strand, time_limited_priority, funding_year, source_file FROM grants_import
--   ON CONFLICT (grant_uid) DO UPDATE SET
--     recipient = EXCLUDED.recipient, recipient_key = EXCLUDED.recipient_key, recipient_type = EXCLUDED.recipient_type,
--     activity_name = EXCLUDED.activity_name, award_amount = EXCLUDED.award_amount, award_date = EXCLUDED.award_date,
--     decision_month = EXCLUDED.decision_month, decision_quarter = EXCLUDED.decision_quarter, ace_area = EXCLUDED.ace_area,
--     local_authority = EXCLUDED.local_authority, local_authority_current = EXCLUDED.local_authority_current,
--     la_code = EXCLUDED.la_code, main_discipline = EXCLUDED.main_discipline, strand = EXCLUDED.strand,
--     time_limited_priority = EXCLUDED.time_limited_priority, funding_year = EXCLUDED.funding_year,
--     source_file = EXCLUDED.source_file;
--   -- Optional: remove grants that are no longer in the source data.
--   DELETE FROM public.arts_council_grants g WHERE NOT EXISTS (SELECT 1 FROM grants_import i WHERE i.grant_uid = g.grant_uid);
--   COMMIT;
