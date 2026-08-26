-- ============================================================================
-- 004 — Remove the dead row-level security left over from the Supabase-era
--       schema.
--
-- WHY THIS IS A FAULT, NOT A FEATURE
--   Row-level security is switched ON for eight tables, but only three of them
--   carry a policy. A table with row-level security on and no policy denies
--   every row to every role that does not explicitly bypass it. The only role
--   that bypasses it is the application role, so the rules never protected
--   anything — the application was already exempt from them.
--
--   What they did instead:
--     1. BROKE BACKUPS. pg_dump run as any ordinary role fails outright with
--        "query would be affected by row-level security policy for table
--        barber_profiles", and writes a dump file that is missing the data.
--        A restore from such a dump would come back with no barber profiles.
--        Proved on 26 August 2026 while taking a backup before a rename.
--     2. Hid rows from every operator, reporting and monitoring login, so a
--        row count read by anyone but the app was quietly wrong.
--
--   Authorisation for this application lives where it is actually enforced:
--   every statement goes through a SECURITY DEFINER function in the barber
--   schema, and every one of those resolves the acting barber or customer from
--   the signed token rather than from anything the caller sends. That is what
--   stops one barber touching another's data, and it is proved by test, not by
--   these policies.
--
-- SAFETY: this removes access rules only. No table, column or row is touched.
-- ============================================================================

DROP POLICY IF EXISTS barber_profiles_public_read ON public.barber_profiles;
DROP POLICY IF EXISTS services_public_read        ON public.services;
DROP POLICY IF EXISTS reviews_read                ON public.reviews;

ALTER TABLE public.barber_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.services        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_schedule DISABLE ROW LEVEL SECURITY;
