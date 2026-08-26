-- ============================================================================
-- 008 — Money totals say which currency they are in.
--
-- WHY
--   Two admin screens formatted a total using a currency the screen itself
--   assumed, with one country's code written into the formatting helper. The
--   no-hardcoding check found it. The honest fix is not to move the guess
--   somewhere else: a total is meaningless without its currency, so the
--   database that adds the numbers up is what should say which currency it
--   added them in.
--
--   Both aggregates now read the currency from the same rows they are summing,
--   which is the same place the amount comes from.
-- ============================================================================

DROP FUNCTION IF EXISTS barber.admin_get_barber_stats(uuid);

CREATE OR REPLACE FUNCTION barber.admin_get_barber_stats(barber_id_ uuid)
RETURNS TABLE(total_bookings bigint, completed_bookings bigint, cancelled_bookings bigint,
              total_paid_revenue numeric, avg_booking_value numeric, currency text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE b.status = 'completed'),
           COUNT(*) FILTER (WHERE b.status = 'cancelled'),
           COALESCE(SUM(b.total_amount) FILTER (WHERE b.payment_status = 'paid'), 0)::numeric,
           COALESCE(AVG(b.total_amount), 0)::numeric,
           MIN(b.currency)::text
    FROM bookings b WHERE b.barber_id = barber_id_;
END $$;

DROP FUNCTION IF EXISTS barber.get_booking_payment_breakdown();

CREATE OR REPLACE FUNCTION barber.get_booking_payment_breakdown()
RETURNS TABLE(payment_status text, payment_method text, count bigint,
              total_amount numeric, currency text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT b.payment_status::text,
           b.payment_method::text,
           COUNT(*),
           COALESCE(SUM(b.total_amount), 0)::numeric,
           MIN(b.currency)::text
      FROM bookings b
     GROUP BY b.payment_status, b.payment_method
     ORDER BY b.payment_status, b.payment_method;
END $$;

GRANT EXECUTE ON FUNCTION barber.admin_get_barber_stats(uuid) TO shorter_app;
GRANT EXECUTE ON FUNCTION barber.get_booking_payment_breakdown() TO shorter_app;

-- A recreated function is a NEW function: Postgres grants EXECUTE on it to
-- PUBLIC again and it carries no comment, so both must be set here or the two
-- functions above quietly undo migration 007.
REVOKE EXECUTE ON FUNCTION barber.admin_get_barber_stats(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION barber.get_booking_payment_breakdown() FROM PUBLIC;

COMMENT ON FUNCTION barber.admin_get_barber_stats(uuid) IS
  'Shorter: booking counts and paid revenue for one barber, with the currency the amounts are in. Admin screens only; executable by the application role alone.';
COMMENT ON FUNCTION barber.get_booking_payment_breakdown() IS
  'Shorter: bookings grouped by payment status and method, with totals and the currency those totals are in. Admin screens only; executable by the application role alone.';
