-- ============================================================================
-- 005 — The database a tenant lives in becomes DATA, not a formula in code.
--
-- WHY
--   getTenantPool built the database name by gluing a fixed prefix onto the
--   company id. That baked a physical database name into application code, so
--   the estate could never rename a database without editing and redeploying
--   the application, and the name in code could drift from the name on the
--   server with nothing to catch it.
--
--   The company row is the tenant registry, so the name belongs there. Company
--   1 is the live Shorter production database. It was renamed on 26 August 2026
--   to shorter_prod, from a name carrying the platform's "foundation" prefix,
--   because it is the Shorter application's own database and is not part of the
--   foundation estate — it appears in no ddlcontroller route or registry row.
--
-- Applied to the control database (shorter_admin).
-- ============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS database_name text;

UPDATE public.companies SET database_name = 'shorter_prod' WHERE id = 1;

-- Every company must name its database: a company with no database cannot be
-- served, and guessing one is what this migration exists to stop.
ALTER TABLE public.companies
  ALTER COLUMN database_name SET NOT NULL;

-- Two companies must never share a database.
CREATE UNIQUE INDEX IF NOT EXISTS companies_database_name_key
  ON public.companies (database_name);

-- Read path for the application. Raw SQL is forbidden in application code, so
-- the lookup is a function like every other statement in this system.
CREATE OR REPLACE FUNCTION barber.get_company_database(company_id_ int)
RETURNS TABLE(database_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT c.database_name::text
      FROM public.companies c
     WHERE c.id = company_id_
       AND c.status = 'active';
END $$;

GRANT EXECUTE ON FUNCTION barber.get_company_database(int) TO shorter_app;
