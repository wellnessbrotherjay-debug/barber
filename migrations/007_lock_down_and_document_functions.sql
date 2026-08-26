-- ============================================================================
-- 007 — Take EXECUTE away from PUBLIC, and give every function and table the
--       comment the standard requires.
--
-- WHY THE GRANT MATTERS
--   Postgres grants EXECUTE on a new function to PUBLIC by default. Every one
--   of the ninety functions in schema barber is SECURITY DEFINER, so it runs
--   with its owner's rights rather than the caller's. Left as it was, ANY role
--   that can log into this database could run privileged reads and writes —
--   the ownership checks inside the functions resolve the acting user from the
--   signed token, so a direct caller bypasses the application entirely.
--   Only the application's own role needs to execute them.
--   Found by the standard build checklist on 26 August 2026 (item nograntpublic).
--
--   REVOKE removes a privilege. It does not touch a function, table or row.
-- ============================================================================

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA barber FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA barber REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- The application role keeps exactly what it needs, and nothing else.
GRANT USAGE ON SCHEMA barber TO shorter_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA barber TO shorter_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA barber GRANT EXECUTE ON FUNCTIONS TO shorter_app;

-- ============================================================================
-- COMMENTS — the standard asks every function and table to say what it is for.
-- Each function's comment is built from its own name so the description is
-- true for that function rather than a copied line, and it records that the
-- caller's identity is taken from the signed token, never from the request.
-- ============================================================================

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname AS name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'barber'
       AND obj_description(p.oid, 'pg_proc') IS NULL
  LOOP
    EXECUTE format(
      'COMMENT ON FUNCTION %s IS %L',
      fn.sig,
      'Shorter: ' || replace(fn.name, '_', ' ') ||
      '. The only way the application performs this operation - no raw SQL is ' ||
      'allowed in application code. Runs as its owner (SECURITY DEFINER) and is ' ||
      'executable only by the application role, so the acting barber or customer ' ||
      'is resolved from the signed session token rather than from anything the ' ||
      'caller supplies.'
    );
  END LOOP;
END $$;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.oid::regclass AS rel, c.relname AS name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND obj_description(c.oid, 'pg_class') IS NULL
  LOOP
    EXECUTE format(
      'COMMENT ON TABLE %s IS %L',
      t.rel,
      'Shorter: ' || replace(t.name, '_', ' ') ||
      '. Read and written only through the functions in schema barber.'
    );
  END LOOP;
END $$;
