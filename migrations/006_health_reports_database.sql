-- ============================================================================
-- 006 — The health check names the database it is actually connected to.
--
-- WHY
--   "database": "connected" says a connection was made. It does not say WHICH
--   database, so an application pointed at the wrong one — a stale environment
--   file, a half-finished rename, a restored copy — reports itself perfectly
--   healthy while serving the wrong data. After renaming the Shorter databases
--   on 26 August 2026 there was no way to prove from the application itself
--   which database it had opened; it had to be inferred from the server. Now
--   the application answers the question directly.
-- ============================================================================

-- The return columns change, and CREATE OR REPLACE cannot alter a function's
-- result type — the old signature has to go first. This removes a function
-- definition only; no table, column or row is touched.
DROP FUNCTION IF EXISTS barber.db_now();

CREATE OR REPLACE FUNCTION barber.db_now()
RETURNS TABLE(now timestamptz, database_name text, connected_role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- session_user, not current_user: this function is SECURITY DEFINER, so
  -- current_user is the function's owner and would hide which role the
  -- application actually connected as.
  RETURN QUERY SELECT now(), current_database()::text, session_user::text;
END $$;

GRANT EXECUTE ON FUNCTION barber.db_now() TO shorter_app;
