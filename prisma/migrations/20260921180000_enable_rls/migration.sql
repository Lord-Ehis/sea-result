-- Lock the Supabase Data API out of every table.
--
-- Supabase publishes the `public` schema through its REST/GraphQL Data API, and
-- the anon/authenticated roles are granted access to every table by default.
-- Row Level Security is then the only barrier — and it was off on the tables
-- created after the first migrations (results, snapshots, audit events, …), so
-- anyone holding the project's public "anon" key could read or change them.
--
-- This app never uses the Data API: it connects straight to Postgres as the
-- table owner (`postgres`), which bypasses RLS. So enabling RLS with no
-- policies (deny everything to API roles) and revoking the API roles' table
-- privileges changes nothing for the app and closes the hole.

-- 1. Row Level Security on every table in the public schema (including
--    `_prisma_migrations`; the owner still bypasses it, so migrations run).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- 2. Belt and braces: the Data API roles get no table or sequence privileges,
--    now or on tables created later. (Skipped on a plain Postgres with no such
--    roles, e.g. local development.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  END IF;
END $$;

-- 3. The two trigger functions resolve nothing by name, so pin an empty
--    search_path: a caller can't shadow anything they might reference.
ALTER FUNCTION public.result_events_block_update() SET search_path = '';
ALTER FUNCTION public.published_result_snapshots_block_change() SET search_path = '';
