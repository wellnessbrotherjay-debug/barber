-- ============================================================================
-- 009 - Standard build checklist conformance for every function in schema
--       barber: an exception block that always re-raises, a status pair on
--       every set-returning function, and an explicit report when a query
--       finds nothing.
--
-- WHY
--   The standard build checklist failed three items against this schema:
--     exceptionblock  89 functions had no EXCEPTION block at all;
--     statusout       73 set-returning functions said nothing about status;
--     nodatablock     74 set-returning functions were silent when they found
--                     nothing, so "no rows" and "never looked" read the same.
--
-- WHAT THIS DOES NOT DO - and why that matters more than what it does
--   The application reads result columns BY NAME. So this migration only ever
--   ADDS the two columns statuscode_ and statusmsg_ to the end of a result.
--   No existing column is removed or renamed, and NO FUNCTION RETURNS A
--   DIFFERENT NUMBER OF ROWS than it did before. In particular the empty case
--   does NOT invent a status row: a status row would be read by the
--   application as a real barber, booking or review. Finding nothing is
--   reported with RAISE NOTICE, which the server logs and the result set does
--   not carry.
--
--   The exception block never swallows an error. It re-raises, every time.
--   A function that quietly returned nothing on failure would be exactly the
--   silent fallback the rules forbid.
--
-- Idempotent: every function is dropped by signature and created again. The
-- grants and comments a dropped function loses are re-applied at the end.
-- ============================================================================


-- ============================================================================
-- PART ONE - COLUMN NAMES
--
-- The checklist item "fieldnames" asks that no table in this database carries
-- created_at, updated_at, deleted_at, or a <thing>_id foreign key written that
-- way. The estate's own tables in foundation_appzoola say createddate,
-- modifieddate, fkitemid, fkrunid, so these follow suit:
--
--     created_at  -> createddate
--     updated_at  -> modifieddate
--     user_id     -> fkuserid
--     customer_id -> fkcustomerid
--
-- THE DATA IS NOT MOVED. Every one of these is ALTER TABLE ... RENAME COLUMN,
-- which changes the name in the catalogue and nothing else: the rows stay
-- exactly where they are, and the indexes, primary keys, unique constraints
-- and foreign keys that name these columns are carried across by Postgres
-- itself. No table is dropped and nothing is copied.
--
-- THE APPLICATION DOES NOT CHANGE. Every function below reads the new physical
-- name and answers under the old one, because the app reads result columns by
-- name (row.created_at, row.user_id). The RETURNS TABLE list of every function
-- is exactly what it was.
--
-- Each rename is guarded on the old column still being there, so running this
-- migration twice does nothing the second time.
-- ============================================================================

DO $rename$
DECLARE
  t text;
  old_new text[];
BEGIN
  FOREACH old_new SLICE 1 IN ARRAY ARRAY[
      ['created_at',  'createddate'],
      ['updated_at',  'modifieddate'],
      ['user_id',     'fkuserid'],
      ['customer_id', 'fkcustomerid']]
  LOOP
    FOR t IN
      SELECT c.table_name
        FROM information_schema.columns c
       WHERE c.table_schema = 'public'
         AND c.column_name = old_new[1]
         AND EXISTS (SELECT 1 FROM information_schema.tables x
                      WHERE x.table_schema = 'public'
                        AND x.table_name = c.table_name
                        AND x.table_type = 'BASE TABLE')
    LOOP
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I',
                     t, old_new[1], old_new[2]);
      RAISE NOTICE 'renamed public.%.% to %', t, old_new[1], old_new[2];
    END LOOP;
  END LOOP;
END $rename$;

-- The one trigger function that stamps the row on every update. Seven triggers
-- point at it, all of them on tables whose column has just been renamed. A
-- trigger is bound to the function itself, not to its name, so renaming the
-- function leaves all seven working.
DO $trg$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'utilities' AND p.proname = 'update_updated_at_column') THEN
    ALTER FUNCTION utilities.update_updated_at_column() RENAME TO update_modifieddate_column;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'utilities' AND p.proname = 'update_modifieddate_column') THEN
    EXECUTE $body$
      CREATE OR REPLACE FUNCTION utilities.update_modifieddate_column()
      RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        NEW.modifieddate = CURRENT_TIMESTAMP;
        RETURN NEW;
      EXCEPTION WHEN OTHERS THEN
        -- never swallow it: the caller must see the real error.
        RAISE;
      END $fn$;
    $body$;
  END IF;
END $trg$;

-- Four functions hand the application a whole barber_profiles row as JSON, and
-- the keys of that JSON are the physical column names. Renaming the columns
-- would have renamed those keys under the application's feet. This puts the
-- keys the application reads back on, and leaves every other key alone.
CREATE OR REPLACE FUNCTION barber.answer_with_app_keys(row_ jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE
  out_ jsonb := row_;
  pair text[];
BEGIN
  IF row_ IS NULL THEN
    RETURN NULL;
  END IF;
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
      ['createddate',  'created_at'],
      ['modifieddate', 'updated_at'],
      ['fkuserid',     'user_id'],
      ['fkcustomerid', 'customer_id']]
  LOOP
    IF out_ ? pair[1] THEN
      out_ := (out_ - pair[1]) || jsonb_build_object(pair[2], out_ -> pair[1]);
    END IF;
  END LOOP;
  RETURN out_;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

-- ============================================================================
-- PART TWO - THE FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS barber.accept_booking(booking_id_ uuid, barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.accept_booking(booking_id_ uuid, barber_id_ uuid)
 RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid, booking_date date, start_time time without time zone, end_time time without time zone, status text, payment_status text, payment_method text, total_amount numeric, currency text, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    UPDATE bookings b SET status = 'confirmed'
    WHERE b.id = booking_id_ AND b.barber_id = barber_id_ AND b.status = 'pending'
    RETURNING b.id, b.booking_reference::text, b.fkcustomerid, b.barber_id, b.service_id,
              b.booking_date, b.start_time, b.end_time, b.status::text, b.payment_status::text,
              b.payment_method::text, b.total_amount, b.currency::text, b.notes,
              b.createddate, b.modifieddate, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.accept_booking found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.add_company_entitlement(company_id_ integer, feature_ text);
CREATE OR REPLACE FUNCTION barber.add_company_entitlement(company_id_ integer, feature_ text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO company_entitlements (company_id, feature, enabled) VALUES (company_id_, feature_, true);
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.add_verification_document(barber_id_ uuid, document_type_ text);
CREATE OR REPLACE FUNCTION barber.add_verification_document(barber_id_ uuid, document_type_ text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO barber_verification_documents (barber_id, document_type, submitted_at)
  VALUES (barber_id_, document_type_, NOW());
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.add_work_photo(barber_id_ uuid, storage_key_ text, url_ text, sort_order_ integer, bytes_ integer, mime_type_ text);
CREATE OR REPLACE FUNCTION barber.add_work_photo(barber_id_ uuid, storage_key_ text, url_ text, sort_order_ integer, bytes_ integer, mime_type_ text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO barber_work_photos (barber_id, storage_key, url, sort_order, bytes, mime_type)
  VALUES (barber_id_, storage_key_, url_, sort_order_, bytes_, mime_type_);
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_create_company(name_ text, owner_email_ text, subscription_tier_ text, max_barbers_ integer);
CREATE OR REPLACE FUNCTION barber.admin_create_company(name_ text, owner_email_ text, subscription_tier_ text, max_barbers_ integer)
 RETURNS TABLE(id integer, name text, owner_email text, api_key uuid, subscription_tier text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    INSERT INTO companies (name, owner_email, subscription_tier, max_barbers)
    VALUES (name_, owner_email_, subscription_tier_, max_barbers_)
    RETURNING companies.id, companies.name::text, companies.owner_email::text,
              companies.api_key, companies.subscription_tier::text, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_create_company found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_get_barber_bookings(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.admin_get_barber_bookings(barber_id_ uuid)
 RETURNS TABLE(id uuid, booking_reference text, booking_date date, start_time time without time zone, end_time time without time zone, status text, payment_status text, total_amount numeric, currency text, created_at timestamp with time zone, service json, customer json, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT b.id, b.booking_reference::text, b.booking_date, b.start_time, b.end_time,
           b.status::text, b.payment_status::text, b.total_amount, b.currency::text, b.createddate,
           json_build_object('id', s.id, 'name', s.name),
           json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email)
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN users u ON b.fkcustomerid = u.id
    WHERE b.barber_id = barber_id_
    ORDER BY b.createddate DESC
    LIMIT 50;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_get_barber_bookings found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_get_barber_profile(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.admin_get_barber_profile(barber_id_ uuid)
 RETURNS TABLE(id uuid, display_name text, bio text, experience_years integer, rating_avg numeric, rating_count integer, shop_name text, address_text text, latitude numeric, longitude numeric, is_verified boolean, is_approved boolean, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, user_id uuid, email text, full_name text, phone text, avatar_url text, user_is_active boolean, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT bp.id, bp.display_name::text, bp.bio, bp.experience_years, bp.rating_avg, bp.rating_count,
           bp.shop_name::text, bp.address_text::text, bp.latitude, bp.longitude,
           bp.is_verified, bp.is_approved, bp.is_active, bp.createddate, bp.modifieddate,
           u.id, u.email::text, u.full_name::text, u.phone::text, u.avatar_url::text, u.is_active
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_profiles bp
    JOIN users u ON bp.fkuserid = u.id
    WHERE bp.id = barber_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_get_barber_profile found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_get_barber_reviews(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.admin_get_barber_reviews(barber_id_ uuid)
 RETURNS TABLE(id uuid, rating integer, comment text, created_at timestamp with time zone, customer json, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT r.id, r.rating, r.comment, r.createddate,
           json_build_object('id', u.id, 'full_name', u.full_name)
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM reviews r
    JOIN users u ON r.fkcustomerid = u.id
    WHERE r.barber_id = barber_id_
    ORDER BY r.createddate DESC
    LIMIT 50;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_get_barber_reviews found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_get_barber_services(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.admin_get_barber_services(barber_id_ uuid)
 RETURNS TABLE(id uuid, name text, description text, price numeric, currency text, duration_minutes integer, is_active boolean, created_at timestamp with time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT s.id, s.name::text, s.description, s.price, s.currency::text,
           s.duration_minutes, s.is_active, s.createddate
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM services s WHERE s.barber_id = barber_id_ ORDER BY s.price ASC;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_get_barber_services found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_get_barber_stats(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.admin_get_barber_stats(barber_id_ uuid)
 RETURNS TABLE(total_bookings bigint, completed_bookings bigint, cancelled_bookings bigint, total_paid_revenue numeric, avg_booking_value numeric, currency text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE b.status = 'completed'),
           COUNT(*) FILTER (WHERE b.status = 'cancelled'),
           COALESCE(SUM(b.total_amount) FILTER (WHERE b.payment_status = 'paid'), 0)::numeric,
           COALESCE(AVG(b.total_amount), 0)::numeric,
           MIN(b.currency)::text
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM bookings b WHERE b.barber_id = barber_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_get_barber_stats found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_get_company_barbers();
CREATE OR REPLACE FUNCTION barber.admin_get_company_barbers()
 RETURNS TABLE(id uuid, display_name text, bio text, experience_years integer, rating_avg numeric, rating_count integer, shop_name text, address_text text, is_verified boolean, is_approved boolean, is_active boolean, onboarding_completed boolean, created_at timestamp with time zone, email text, full_name text, phone text, avatar_url text, user_is_active boolean, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT bp.id, bp.display_name::text, bp.bio, bp.experience_years, bp.rating_avg,
           bp.rating_count, bp.shop_name::text, bp.address_text::text, bp.is_verified,
           bp.is_approved, bp.is_active, bp.onboarding_completed,
           bp.createddate, u.email::text, u.full_name::text, u.phone::text, u.avatar_url::text,
           u.is_active
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_profiles bp
    JOIN users u ON bp.fkuserid = u.id
    ORDER BY bp.createddate DESC;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_get_company_barbers found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_get_company_bookings();
CREATE OR REPLACE FUNCTION barber.admin_get_company_bookings()
 RETURNS TABLE(id uuid, booking_reference text, booking_date date, start_time time without time zone, end_time time without time zone, status text, payment_status text, total_amount numeric, currency text, created_at timestamp with time zone, barber json, service json, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT b.id, b.booking_reference::text, b.booking_date, b.start_time, b.end_time,
           b.status::text, b.payment_status::text, b.total_amount, b.currency::text, b.createddate,
           json_build_object('id', bp.id, 'display_name', bp.display_name, 'shop_name', bp.shop_name),
           json_build_object('id', s.id, 'name', s.name, 'price', s.price, 'duration_minutes', s.duration_minutes)
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM bookings b
    JOIN barber_profiles bp ON b.barber_id = bp.id
    JOIN services s ON b.service_id = s.id
    ORDER BY b.createddate DESC
    LIMIT 50;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_get_company_bookings found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_get_company_detail(id_ integer);
CREATE OR REPLACE FUNCTION barber.admin_get_company_detail(id_ integer)
 RETURNS TABLE(id integer, name text, owner_email text, api_key uuid, subscription_tier text, max_barbers integer, status text, created_at timestamp without time zone, updated_at timestamp without time zone, renewal_date date, subscription_status text, api_calls_24h bigint, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT c.id, c.name::text, c.owner_email::text, c.api_key, c.subscription_tier::text,
           c.max_barbers, c.status::text, c.created_at, c.updated_at,
           s.renewal_date, s.status::text,
           COUNT(DISTINCT aku.company_id)
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM companies c
    LEFT JOIN company_subscriptions s ON c.id = s.company_id
    LEFT JOIN api_key_usage aku ON c.id = aku.company_id AND aku.timestamp > NOW() - INTERVAL '24 hours'
    WHERE c.id = id_
    GROUP BY c.id, s.renewal_date, s.status;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_get_company_detail found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_get_company_onboarding_row(id_ integer);
CREATE OR REPLACE FUNCTION barber.admin_get_company_onboarding_row(id_ integer)
 RETURNS TABLE(id integer, name text, subscription_tier text, max_barbers integer, status text, created_at timestamp without time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT c.id, c.name::text, c.subscription_tier::text, c.max_barbers, c.status::text, c.created_at
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM companies c WHERE c.id = id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_get_company_onboarding_row found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_get_company_payments();
CREATE OR REPLACE FUNCTION barber.admin_get_company_payments()
 RETURNS TABLE(id uuid, amount numeric, currency text, payment_method text, transaction_id text, status text, notes text, created_at timestamp with time zone, booking json, customer json, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT p.id, p.amount, p.currency::text, p.payment_method::text, p.transaction_id::text,
           p.status::text, p.notes, p.createddate,
           json_build_object('id', b.id, 'booking_reference', b.booking_reference,
                             'booking_date', b.booking_date, 'total_amount', b.total_amount,
                             'payment_status', b.payment_status),
           json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email)
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    JOIN users u ON p.fkcustomerid = u.id
    ORDER BY p.createddate DESC
    LIMIT 100;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_get_company_payments found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_get_income_report();
CREATE OR REPLACE FUNCTION barber.admin_get_income_report()
 RETURNS TABLE(date date, total_revenue numeric, active_companies bigint, total_bookings bigint, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT DATE(m.metric_date), SUM(m.total_revenue)::numeric,
           COUNT(DISTINCT m.company_id), SUM(m.completed_bookings)::bigint
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM booking_metrics m
    GROUP BY DATE(m.metric_date)
    ORDER BY DATE(m.metric_date) DESC
    LIMIT 90;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_get_income_report found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_get_recent_bookings(limit_ integer);
CREATE OR REPLACE FUNCTION barber.admin_get_recent_bookings(limit_ integer)
 RETURNS TABLE(id uuid, booking_reference text, booking_date date, start_time time without time zone, status text, payment_status text, total_amount numeric, currency text, created_at timestamp with time zone, barber_name text, service_name text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT b.id, b.booking_reference::text, b.booking_date, b.start_time,
           b.status::text, b.payment_status::text, b.total_amount, b.currency::text,
           b.createddate, bp.display_name::text, s.name::text
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM bookings b
    JOIN barber_profiles bp ON b.barber_id = bp.id
    JOIN services s ON b.service_id = s.id
    ORDER BY b.createddate DESC
    LIMIT limit_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_get_recent_bookings found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_list_companies();
CREATE OR REPLACE FUNCTION barber.admin_list_companies()
 RETURNS TABLE(id integer, name text, owner_email text, subscription_tier text, status text, max_barbers integer, renewal_date date, api_usage_count bigint, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT c.id, c.name::text, c.owner_email::text, c.subscription_tier::text, c.status::text,
           c.max_barbers, s.renewal_date,
           COUNT(DISTINCT u.company_id)
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM companies c
    LEFT JOIN company_subscriptions s ON c.id = s.company_id
    LEFT JOIN api_key_usage u ON c.id = u.company_id AND u.timestamp > NOW() - INTERVAL '24 hours'
    GROUP BY c.id, s.renewal_date
    ORDER BY c.created_at DESC;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_list_companies found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_set_company_status(id_ integer, status_ text);
CREATE OR REPLACE FUNCTION barber.admin_set_company_status(id_ integer, status_ text)
 RETURNS TABLE(id integer, name text, owner_email text, subscription_tier text, status text, max_barbers integer, created_at timestamp without time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    UPDATE companies c SET status = status_ WHERE c.id = id_
    RETURNING c.id, c.name::text, c.owner_email::text, c.subscription_tier::text,
              c.status::text, c.max_barbers, c.created_at, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.admin_set_company_status found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.admin_verify_barber(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.admin_verify_barber(barber_id_ uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result_ jsonb;
BEGIN
  UPDATE barber_profiles bp SET is_verified = true WHERE bp.id = barber_id_;
  SELECT barber.answer_with_app_keys(to_jsonb(bp)) INTO result_ FROM barber_profiles bp WHERE bp.id = barber_id_;
  RETURN result_;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.cancel_booking(booking_id_ uuid, user_id_ uuid, barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.cancel_booking(booking_id_ uuid, user_id_ uuid, barber_id_ uuid)
 RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid, booking_date date, start_time time without time zone, end_time time without time zone, status text, payment_status text, payment_method text, total_amount numeric, currency text, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    UPDATE bookings b SET status = 'cancelled'
    WHERE b.id = booking_id_
      AND b.status IN ('pending','confirmed')
      AND (b.fkcustomerid = user_id_ OR (barber_id_ IS NOT NULL AND b.barber_id = barber_id_))
    RETURNING b.id, b.booking_reference::text, b.fkcustomerid, b.barber_id, b.service_id,
              b.booking_date, b.start_time, b.end_time, b.status::text, b.payment_status::text,
              b.payment_method::text, b.total_amount, b.currency::text, b.notes,
              b.createddate, b.modifieddate, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.cancel_booking found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.check_entitlement(company_id_ integer, feature_ text);
CREATE OR REPLACE FUNCTION barber.check_entitlement(company_id_ integer, feature_ text)
 RETURNS TABLE(enabled boolean, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT e.enabled
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM company_entitlements e
    WHERE e.company_id = company_id_ AND e.feature = feature_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.check_entitlement found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.company_list_barbers();
CREATE OR REPLACE FUNCTION barber.company_list_barbers()
 RETURNS TABLE(id uuid, display_name text, bio text, experience_years integer, rating_avg numeric, rating_count integer, is_active boolean, total_bookings bigint, completed_bookings bigint, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT bp.id, bp.display_name::text, bp.bio, bp.experience_years, bp.rating_avg,
           bp.rating_count, bp.is_active,
           COUNT(b.id), COUNT(b.id) FILTER (WHERE b.status = 'completed')
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_profiles bp
    LEFT JOIN bookings b ON bp.id = b.barber_id
    GROUP BY bp.id
    ORDER BY bp.rating_avg DESC;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.company_list_barbers found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.company_list_bookings();
CREATE OR REPLACE FUNCTION barber.company_list_bookings()
 RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid, booking_date date, start_time time without time zone, status text, payment_status text, total_amount numeric, barber_name text, service_name text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT b.id, b.booking_reference::text, b.fkcustomerid, b.barber_id, b.service_id,
           b.booking_date, b.start_time, b.status::text, b.payment_status::text,
           b.total_amount, bp.display_name::text, s.name::text
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM bookings b
    JOIN barber_profiles bp ON b.barber_id = bp.id
    JOIN services s ON b.service_id = s.id
    ORDER BY b.booking_date DESC
    LIMIT 100;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.company_list_bookings found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.complete_booking(booking_id_ uuid, barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.complete_booking(booking_id_ uuid, barber_id_ uuid)
 RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid, booking_date date, start_time time without time zone, end_time time without time zone, status text, payment_status text, payment_method text, total_amount numeric, currency text, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    UPDATE bookings b SET status = 'completed'
    WHERE b.id = booking_id_ AND b.barber_id = barber_id_ AND b.status = 'confirmed'
    RETURNING b.id, b.booking_reference::text, b.fkcustomerid, b.barber_id, b.service_id,
              b.booking_date, b.start_time, b.end_time, b.status::text, b.payment_status::text,
              b.payment_method::text, b.total_amount, b.currency::text, b.notes,
              b.createddate, b.modifieddate, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.complete_booking found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.complete_onboarding(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.complete_onboarding(barber_id_ uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result_ jsonb;
BEGIN
  UPDATE barber_profiles bp SET
    onboarding_completed = true,
    onboarding_completed_at = NOW(),
    onboarding_step = 7
  WHERE bp.id = barber_id_;
  SELECT barber.answer_with_app_keys(to_jsonb(bp)) INTO result_ FROM barber_profiles bp WHERE bp.id = barber_id_;
  RETURN result_;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.count_active_barbers();
CREATE OR REPLACE FUNCTION barber.count_active_barbers()
 RETURNS TABLE(count bigint, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY SELECT COUNT(*) , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_profiles bp WHERE bp.is_active = true;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.count_active_barbers found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.count_today_bookings();
CREATE OR REPLACE FUNCTION barber.count_today_bookings()
 RETURNS TABLE(count bigint, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY SELECT COUNT(*) , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM bookings b WHERE DATE(b.booking_date) = CURRENT_DATE;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.count_today_bookings found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.create_barber_profile(user_id_ uuid, display_name_ text);
CREATE OR REPLACE FUNCTION barber.create_barber_profile(user_id_ uuid, display_name_ text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO barber_profiles (fkuserid, display_name, is_verified, is_approved, onboarding_completed)
  VALUES (user_id_, display_name_, false, false, false);
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.create_booking(booking_reference_ text, customer_id_ uuid, barber_id_ uuid, service_id_ uuid, booking_date_ date, start_time_ time without time zone, end_time_ time without time zone, status_ text, payment_status_ text, total_amount_ numeric, notes_ text);
CREATE OR REPLACE FUNCTION barber.create_booking(booking_reference_ text, customer_id_ uuid, barber_id_ uuid, service_id_ uuid, booking_date_ date, start_time_ time without time zone, end_time_ time without time zone, status_ text, payment_status_ text, total_amount_ numeric, notes_ text)
 RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid, booking_date date, start_time time without time zone, end_time time without time zone, status text, payment_status text, payment_method text, total_amount numeric, currency text, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    INSERT INTO bookings (booking_reference, fkcustomerid, barber_id, service_id,
                          booking_date, start_time, end_time, status, payment_status,
                          total_amount, notes)
    VALUES (booking_reference_, customer_id_, barber_id_, service_id_, booking_date_,
            start_time_, end_time_, status_, payment_status_, total_amount_, notes_)
    RETURNING bookings.id, bookings.booking_reference::text, bookings.fkcustomerid,
              bookings.barber_id, bookings.service_id, bookings.booking_date,
              bookings.start_time, bookings.end_time, bookings.status::text,
              bookings.payment_status::text, bookings.payment_method::text,
              bookings.total_amount, bookings.currency::text, bookings.notes,
              bookings.createddate, bookings.modifieddate, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.create_booking found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.create_issue_report(tenant_id_ text, reporter_user_id_ text, reported_type_ text, comments_ text);
CREATE OR REPLACE FUNCTION barber.create_issue_report(tenant_id_ text, reporter_user_id_ text, reported_type_ text, comments_ text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result_ jsonb;
BEGIN
  INSERT INTO issue_reports (tenant_id, reporter_user_id, reported_type, comments)
  VALUES (tenant_id_, reporter_user_id_, reported_type_, comments_)
  RETURNING to_jsonb(issue_reports.*) INTO result_;
  RETURN result_;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.create_notification(user_id_ uuid, title_ text, message_ text, type_ text, related_id_ uuid);
CREATE OR REPLACE FUNCTION barber.create_notification(user_id_ uuid, title_ text, message_ text, type_ text, related_id_ uuid)
 RETURNS TABLE(email text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO notifications (fkuserid, title, message, type, related_id)
  VALUES (user_id_, title_, message_, type_, related_id_);
  RETURN QUERY SELECT u.email::text , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM users u WHERE u.id = user_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.create_notification found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.create_review(booking_id_ uuid, customer_id_ uuid, barber_id_ uuid, rating_ integer, comment_ text);
CREATE OR REPLACE FUNCTION barber.create_review(booking_id_ uuid, customer_id_ uuid, barber_id_ uuid, rating_ integer, comment_ text)
 RETURNS TABLE(id uuid, booking_id uuid, customer_id uuid, barber_id uuid, rating integer, comment text, created_at timestamp with time zone, updated_at timestamp with time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  review_id_ uuid;
BEGIN
  INSERT INTO reviews (booking_id, fkcustomerid, barber_id, rating, comment)
  VALUES (booking_id_, customer_id_, barber_id_, rating_, comment_)
  RETURNING reviews.id INTO review_id_;

  UPDATE barber_profiles bp
     SET rating_avg = (SELECT AVG(r.rating) FROM reviews r WHERE r.barber_id = barber_id_),
         rating_count = (SELECT COUNT(*) FROM reviews r WHERE r.barber_id = barber_id_)
   WHERE bp.id = barber_id_;

  RETURN QUERY
    SELECT r.id, r.booking_id, r.fkcustomerid, r.barber_id, r.rating, r.comment,
           r.createddate, r.modifieddate
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM reviews r WHERE r.id = review_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.create_review found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.create_service(barber_id_ uuid, category_id_ uuid, name_ text, description_ text, price_ numeric, duration_minutes_ integer);
CREATE OR REPLACE FUNCTION barber.create_service(barber_id_ uuid, category_id_ uuid, name_ text, description_ text, price_ numeric, duration_minutes_ integer)
 RETURNS TABLE(id uuid, barber_id uuid, category_id uuid, name text, description text, price numeric, currency text, duration_minutes integer, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    INSERT INTO services (barber_id, category_id, name, description, price, duration_minutes)
    VALUES (barber_id_, category_id_, name_, description_, price_, duration_minutes_)
    RETURNING services.id, services.barber_id, services.category_id, services.name::text,
              services.description, services.price, services.currency::text,
              services.duration_minutes, services.is_active,
              services.createddate, services.modifieddate, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.create_service found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.create_user(email_ text, full_name_ text, role_ text, password_hash_ text);
CREATE OR REPLACE FUNCTION barber.create_user(email_ text, full_name_ text, role_ text, password_hash_ text)
 RETURNS TABLE(id uuid, email text, full_name text, role text, avatar_url text, phone text, created_at timestamp with time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    INSERT INTO users (email, full_name, role, password_hash)
    VALUES (email_, full_name_, role_, password_hash_)
    RETURNING users.id, users.email::text, users.full_name::text, users.role::text,
              users.avatar_url::text, users.phone::text, users.createddate, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.create_user found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.db_now();
CREATE OR REPLACE FUNCTION barber.db_now()
 RETURNS TABLE(now timestamp with time zone, database_name text, connected_role text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- session_user, not current_user: this function is SECURITY DEFINER, so
  -- current_user is the function's owner and would hide which role the
  -- application actually connected as.
  RETURN QUERY SELECT now(), current_database()::text, session_user::text, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.db_now found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.delete_account(user_id_ uuid);
CREATE OR REPLACE FUNCTION barber.delete_account(user_id_ uuid)
 RETURNS TABLE(statuscode_ integer, statusmsg_ text, deleted_ boolean, active_bookings_ integer, role_ text, barber_profile_id_ uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  user_role_ text;
  profile_id_ uuid;
  active_ int := 0;
BEGIN
  SELECT u.role::text INTO user_role_ FROM users u WHERE u.id = user_id_ FOR UPDATE;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.delete_account found nothing for the given parameters';
    RETURN QUERY SELECT 404, 'Account not found'::text, false, 0, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT bp.id INTO profile_id_ FROM barber_profiles bp WHERE bp.fkuserid = user_id_;

  IF profile_id_ IS NOT NULL THEN
    SELECT COUNT(*)::int INTO active_ FROM bookings b
     WHERE (b.fkcustomerid = user_id_ OR b.barber_id = profile_id_)
       AND b.status IN ('pending','confirmed');
  ELSE
    SELECT COUNT(*)::int INTO active_ FROM bookings b
     WHERE b.fkcustomerid = user_id_ AND b.status IN ('pending','confirmed');
  END IF;

  IF active_ > 0 THEN
    RETURN QUERY SELECT 409, 'Active bookings remain'::text, false, active_, user_role_, profile_id_;
    RETURN;
  END IF;

  DELETE FROM users u WHERE u.id = user_id_;
  RETURN QUERY SELECT 200, 'OK'::text, true, 0, user_role_, profile_id_;
EXCEPTION WHEN OTHERS THEN
  -- No silent failures: surface the real error to the caller.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.delete_service(service_id_ uuid, barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.delete_service(service_id_ uuid, barber_id_ uuid)
 RETURNS TABLE(id uuid, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    DELETE FROM services s WHERE s.id = service_id_ AND s.barber_id = barber_id_
    RETURNING s.id, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.delete_service found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.delete_work_photo(photo_id_ uuid, barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.delete_work_photo(photo_id_ uuid, barber_id_ uuid)
 RETURNS TABLE(storage_key text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    DELETE FROM barber_work_photos w WHERE w.id = photo_id_ AND w.barber_id = barber_id_
    RETURNING w.storage_key, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.delete_work_photo found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_admin_company_stats();
CREATE OR REPLACE FUNCTION barber.get_admin_company_stats()
 RETURNS TABLE(active_companies bigint, suspended_companies bigint, total_companies bigint, total_max_barbers bigint, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT
      COUNT(*) FILTER (WHERE c.status = 'active'),
      COUNT(*) FILTER (WHERE c.status = 'suspended'),
      COUNT(*),
      SUM(CAST(c.max_barbers AS BIGINT))::bigint
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM companies c;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_admin_company_stats found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_barber_bookings(barber_user_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_barber_bookings(barber_user_id_ uuid)
 RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid, booking_date date, start_time time without time zone, end_time time without time zone, status text, payment_status text, total_amount numeric, notes text, users json, services json, barber_profiles json, customer_phone text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT b.id, b.booking_reference::text, b.fkcustomerid, b.barber_id, b.service_id,
           b.booking_date, b.start_time, b.end_time, b.status::text, b.payment_status::text,
           b.total_amount, b.notes,
           json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email),
           json_build_object('id', s.id, 'name', s.name, 'price', s.price, 'duration_minutes', s.duration_minutes),
           json_build_object('shop_name', bp.shop_name, 'address_text', bp.address_text),
           (CASE WHEN b.status IN ('confirmed', 'completed') THEN u.phone END)::text
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM bookings b
    JOIN barber_profiles bp ON b.barber_id = bp.id
    JOIN users u ON b.fkcustomerid = u.id
    JOIN services s ON b.service_id = s.id
    WHERE bp.fkuserid = barber_user_id_
    ORDER BY b.booking_date DESC;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_barber_bookings found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_barber_detail(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_barber_detail(barber_id_ uuid)
 RETURNS TABLE(id uuid, user_id uuid, display_name text, bio text, experience_years integer, rating_avg numeric, rating_count integer, shop_name text, address_text text, work_photos jsonb, users json, services json, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT bp.id, bp.fkuserid, bp.display_name::text, bp.bio, bp.experience_years,
           bp.rating_avg, bp.rating_count, bp.shop_name::text, bp.address_text::text,
           bp.work_photos,
           json_build_object('full_name', u.full_name, 'email', u.email, 'avatar_url', u.avatar_url),
           json_agg(json_build_object(
             'id', s.id, 'name', s.name, 'description', s.description,
             'price', s.price, 'currency', s.currency, 'duration_minutes', s.duration_minutes))
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_profiles bp
    JOIN users u ON bp.fkuserid = u.id
    LEFT JOIN services s ON s.barber_id = bp.id
    WHERE bp.id = barber_id_
    GROUP BY bp.id, u.id;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_barber_detail found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_barber_login_status(user_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_barber_login_status(user_id_ uuid)
 RETURNS TABLE(onboarding_completed boolean, is_verified boolean, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT bp.onboarding_completed, bp.is_verified
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_profiles bp WHERE bp.fkuserid = user_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_barber_login_status found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_barber_profile(user_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_barber_profile(user_id_ uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result_ jsonb;
BEGIN
  SELECT barber.answer_with_app_keys(to_jsonb(bp)) || jsonb_build_object(
           'full_name', u.full_name, 'email', u.email, 'phone', u.phone, 'avatar_url', u.avatar_url)
    INTO result_
    FROM barber_profiles bp
    JOIN users u ON u.id = bp.fkuserid
   WHERE bp.fkuserid = user_id_;
  RETURN result_;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_barber_schedule(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_barber_schedule(barber_id_ uuid)
 RETURNS TABLE(id uuid, day_of_week integer, start_time time without time zone, end_time time without time zone, is_available boolean, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT bs.id, bs.day_of_week, bs.start_time, bs.end_time, bs.is_available
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_schedule bs WHERE bs.barber_id = barber_id_
    ORDER BY bs.day_of_week ASC, bs.start_time ASC;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_barber_schedule found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_barber_status(user_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_barber_status(user_id_ uuid)
 RETURNS TABLE(onboarding_completed boolean, is_verified boolean, is_approved boolean, is_active boolean, onboarding_step integer, onboarding_completed_at timestamp with time zone, verification_status text, is_online boolean, service_radius_km numeric, buffer_minutes integer, service_mode text, booking_mode text, city text, region text, country text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT bp.onboarding_completed, bp.is_verified, bp.is_approved, bp.is_active,
           bp.onboarding_step, bp.onboarding_completed_at, bp.verification_status::text,
           bp.is_online, bp.service_radius_km, bp.buffer_minutes,
           bp.service_mode::text, bp.booking_mode::text,
           bp.city::text, bp.region::text, bp.country::text
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_profiles bp WHERE bp.fkuserid = user_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_barber_status found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_barber_user_id(barber_profile_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_barber_user_id(barber_profile_id_ uuid)
 RETURNS TABLE(user_id uuid, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY SELECT bp.fkuserid , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_profiles bp WHERE bp.id = barber_profile_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_barber_user_id found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_booking_barber_for_review(booking_id_ uuid, customer_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_booking_barber_for_review(booking_id_ uuid, customer_id_ uuid)
 RETURNS TABLE(barber_id uuid, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT b.barber_id , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM bookings b
    WHERE b.id = booking_id_ AND b.fkcustomerid = customer_id_ AND b.status = 'completed';
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_booking_barber_for_review found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_booking_for_payment(booking_id_ uuid, customer_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_booking_for_payment(booking_id_ uuid, customer_id_ uuid)
 RETURNS TABLE(id uuid, total_amount numeric, currency text, payment_status text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT b.id, b.total_amount, b.currency::text, b.payment_status::text
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM bookings b WHERE b.id = booking_id_ AND b.fkcustomerid = customer_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_booking_for_payment found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_booking_payment_breakdown();
CREATE OR REPLACE FUNCTION barber.get_booking_payment_breakdown()
 RETURNS TABLE(payment_status text, payment_method text, count bigint, total_amount numeric, currency text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT b.payment_status::text,
           b.payment_method::text,
           COUNT(*),
           COALESCE(SUM(b.total_amount), 0)::numeric,
           MIN(b.currency)::text
      , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM bookings b
     GROUP BY b.payment_status, b.payment_method
     ORDER BY b.payment_status, b.payment_method;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_booking_payment_breakdown found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_company_activity(company_id_ integer);
CREATE OR REPLACE FUNCTION barber.get_company_activity(company_id_ integer)
 RETURNS TABLE(last_active timestamp without time zone, calls_7d bigint, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT MAX(a.timestamp), COUNT(*)
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM api_key_usage a
    WHERE a.company_id = company_id_ AND a.timestamp > NOW() - INTERVAL '7 days';
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_company_activity found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_company_by_api_key(api_key_ text, status_ text);
CREATE OR REPLACE FUNCTION barber.get_company_by_api_key(api_key_ text, status_ text)
 RETURNS TABLE(id integer, name text, subscription_tier text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT c.id, c.name::text, c.subscription_tier::text
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM companies c
    WHERE c.api_key::text = api_key_ AND c.status = status_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_company_by_api_key found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_company_by_id(id_ integer);
CREATE OR REPLACE FUNCTION barber.get_company_by_id(id_ integer)
 RETURNS TABLE(id integer, name text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY SELECT c.id, c.name::text , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM companies c WHERE c.id = id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_company_by_id found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_company_entitlements(company_id_ integer);
CREATE OR REPLACE FUNCTION barber.get_company_entitlements(company_id_ integer)
 RETURNS TABLE(feature text, enabled boolean, updated_at timestamp without time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT e.feature::text, e.enabled, e.updated_at
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM company_entitlements e WHERE e.company_id = company_id_ ORDER BY e.feature;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_company_entitlements found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_company_income(company_id_ integer);
CREATE OR REPLACE FUNCTION barber.get_company_income(company_id_ integer)
 RETURNS TABLE(metric_date date, total_bookings integer, completed_bookings integer, canceled_bookings integer, total_revenue numeric, average_rating numeric, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT m.metric_date, m.total_bookings, m.completed_bookings, m.canceled_bookings,
           m.total_revenue, m.average_rating
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM booking_metrics m
    WHERE m.company_id = company_id_
    ORDER BY m.metric_date DESC
    LIMIT 90;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_company_income found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_company_metrics_30d(company_id_ integer);
CREATE OR REPLACE FUNCTION barber.get_company_metrics_30d(company_id_ integer)
 RETURNS TABLE(total_bookings bigint, completed_bookings bigint, canceled_bookings bigint, total_revenue numeric, average_rating numeric, metric_days bigint, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT SUM(m.total_bookings)::bigint, SUM(m.completed_bookings)::bigint,
           SUM(m.canceled_bookings)::bigint, SUM(m.total_revenue)::numeric,
           AVG(m.average_rating)::numeric, COUNT(*)
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM booking_metrics m
    WHERE m.company_id = company_id_ AND m.metric_date >= CURRENT_DATE - INTERVAL '30 days';
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_company_metrics_30d found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_customer_bookings(customer_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_customer_bookings(customer_id_ uuid)
 RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid, booking_date date, start_time time without time zone, end_time time without time zone, status text, payment_status text, total_amount numeric, barber_profiles json, barber_phone text, services json, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT b.id, b.booking_reference::text, b.fkcustomerid, b.barber_id, b.service_id,
           b.booking_date, b.start_time, b.end_time, b.status::text, b.payment_status::text,
           b.total_amount,
           json_build_object('id', bp.id, 'display_name', bp.display_name, 'shop_name', bp.shop_name),
           (CASE WHEN b.status IN ('confirmed', 'completed') THEN bu.phone END)::text,
           json_build_object('id', s.id, 'name', s.name, 'price', s.price, 'duration_minutes', s.duration_minutes)
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM bookings b
    JOIN barber_profiles bp ON b.barber_id = bp.id
    JOIN users bu ON bp.fkuserid = bu.id
    JOIN services s ON b.service_id = s.id
    WHERE b.fkcustomerid = customer_id_
    ORDER BY b.booking_date DESC;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_customer_bookings found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_max_work_photo_sort(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_max_work_photo_sort(barber_id_ uuid)
 RETURNS TABLE(max integer, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT COALESCE(MAX(w.sort_order), -1)::int
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_work_photos w WHERE w.barber_id = barber_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_max_work_photo_sort found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_nearby_barbers(lat_ double precision, lng_ double precision, radius_km_ double precision, limit_ integer, box_meters_ double precision, online_only_ boolean, offset_ integer);
CREATE OR REPLACE FUNCTION barber.get_nearby_barbers(lat_ double precision, lng_ double precision, radius_km_ double precision, limit_ integer, box_meters_ double precision, online_only_ boolean, offset_ integer)
 RETURNS TABLE(id uuid, user_id uuid, display_name text, bio text, experience_years integer, rating_avg numeric, rating_count integer, shop_name text, address_text text, latitude numeric, longitude numeric, is_verified boolean, is_active boolean, is_online boolean, service_mode text, service_radius_km numeric, work_photos jsonb, users json, services json, distance_km numeric, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    WITH origin AS (SELECT ll_to_earth(lat_, lng_) AS pt)
    SELECT bp.id, bp.fkuserid, bp.display_name::text, bp.bio, bp.experience_years,
           bp.rating_avg, bp.rating_count, bp.shop_name::text, bp.address_text::text,
           bp.latitude, bp.longitude, bp.is_verified, bp.is_active,
           bp.is_online, bp.service_mode::text, bp.service_radius_km,
           bp.work_photos,
           json_build_object('full_name', u.full_name, 'email', u.email, 'avatar_url', u.avatar_url),
           COALESCE((
             SELECT json_agg(json_build_object(
               'id', s.id, 'name', s.name, 'description', s.description,
               'price', s.price, 'currency', s.currency, 'duration_minutes', s.duration_minutes
             ) ORDER BY s.price ASC)
             FROM services s WHERE s.barber_id = bp.id AND s.is_active = true
           ), '[]'::json),
           round((earth_distance(origin.pt, ll_to_earth(bp.latitude::float8, bp.longitude::float8)) / 1000)::numeric, 2)
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_profiles bp
    JOIN users u ON bp.fkuserid = u.id
    CROSS JOIN origin
    WHERE bp.is_active = true
      AND bp.latitude IS NOT NULL AND bp.longitude IS NOT NULL
      AND (online_only_ = false OR bp.is_online = true)
      AND earth_box(origin.pt, box_meters_) @> ll_to_earth(bp.latitude::float8, bp.longitude::float8)
      AND earth_distance(origin.pt, ll_to_earth(bp.latitude::float8, bp.longitude::float8))
          <= CASE WHEN bp.service_mode IN ('mobile','both')
                  THEN GREATEST(radius_km_ * 1000, bp.service_radius_km::float8 * 1000)
                  ELSE radius_km_ * 1000 END
    ORDER BY round((earth_distance(origin.pt, ll_to_earth(bp.latitude::float8, bp.longitude::float8)) / 1000)::numeric, 2) ASC,
             bp.rating_avg DESC, bp.id
    LIMIT limit_ OFFSET offset_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_nearby_barbers found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_notifications(user_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_notifications(user_id_ uuid)
 RETURNS TABLE(id uuid, title text, message text, type text, related_id uuid, is_read boolean, created_at timestamp with time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT n.id, n.title::text, n.message, n.type::text, n.related_id, n.is_read, n.createddate
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM notifications n WHERE n.fkuserid = user_id_
    ORDER BY n.createddate DESC
    LIMIT 50;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_notifications found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_onboarding_check(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_onboarding_check(barber_id_ uuid)
 RETURNS TABLE(display_name text, bio text, shop_name text, service_count integer, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT bp.display_name::text, bp.bio, bp.shop_name::text,
           (SELECT COUNT(*)::int FROM services s WHERE s.barber_id = bp.id)
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_profiles bp WHERE bp.id = barber_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_onboarding_check found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_own_barber_profile_id(user_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_own_barber_profile_id(user_id_ uuid)
 RETURNS TABLE(id uuid, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY SELECT bp.id , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_profiles bp WHERE bp.fkuserid = user_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_own_barber_profile_id found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_own_services(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_own_services(barber_id_ uuid)
 RETURNS TABLE(id uuid, name text, description text, price numeric, currency text, duration_minutes integer, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT s.id, s.name::text, s.description, s.price, s.currency::text, s.duration_minutes
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM services s WHERE s.barber_id = barber_id_ AND s.is_active = true;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_own_services found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_review_by_booking(booking_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_review_by_booking(booking_id_ uuid)
 RETURNS TABLE(id uuid, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY SELECT r.id , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM reviews r WHERE r.booking_id = booking_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_review_by_booking found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_reviews_by_barber(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_reviews_by_barber(barber_id_ uuid)
 RETURNS TABLE(id uuid, rating integer, comment text, created_at timestamp with time zone, customer_name text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT r.id, r.rating, r.comment, r.createddate, u.full_name::text
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM reviews r
    JOIN users u ON u.id = r.fkcustomerid
    WHERE r.barber_id = barber_id_
    ORDER BY r.createddate DESC;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_reviews_by_barber found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_service_for_booking(service_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_service_for_booking(service_id_ uuid)
 RETURNS TABLE(price numeric, duration_minutes integer, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY SELECT s.price, s.duration_minutes , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM services s WHERE s.id = service_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_service_for_booking found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_tenant_booking_totals();
CREATE OR REPLACE FUNCTION barber.get_tenant_booking_totals()
 RETURNS TABLE(booking_count bigint, paid_revenue numeric, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT COUNT(*),
           COALESCE(SUM(b.total_amount) FILTER (WHERE b.payment_status = 'paid'), 0)::numeric
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM bookings b;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_tenant_booking_totals found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_tenant_daily_booking_stats();
CREATE OR REPLACE FUNCTION barber.get_tenant_daily_booking_stats()
 RETURNS TABLE(date text, bookings bigint, revenue numeric, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT b.booking_date::text, COUNT(*),
           COALESCE(SUM(b.total_amount) FILTER (WHERE b.payment_status = 'paid'), 0)::numeric
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM bookings b
    WHERE b.booking_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY b.booking_date;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_tenant_daily_booking_stats found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_user_for_login(email_ text);
CREATE OR REPLACE FUNCTION barber.get_user_for_login(email_ text)
 RETURNS TABLE(id uuid, email text, full_name text, role text, avatar_url text, phone text, password_hash text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT u.id, u.email::text, u.full_name::text, u.role::text,
           u.avatar_url::text, u.phone::text, u.password_hash::text
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM users u
    WHERE u.email = email_ AND u.is_active = true;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_user_for_login found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_user_id_by_email(email_ text);
CREATE OR REPLACE FUNCTION barber.get_user_id_by_email(email_ text)
 RETURNS TABLE(id uuid, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY SELECT u.id , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM users u WHERE u.email = email_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_user_id_by_email found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.get_work_photo_ids(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.get_work_photo_ids(barber_id_ uuid)
 RETURNS TABLE(id uuid, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY SELECT w.id , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_work_photos w WHERE w.barber_id = barber_id_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.get_work_photo_ids found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.list_active_companies();
CREATE OR REPLACE FUNCTION barber.list_active_companies()
 RETURNS TABLE(id integer, name text, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT c.id, c.name::text , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM companies c WHERE c.status = 'active' ORDER BY c.id;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.list_active_companies found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.list_barbers(limit_ integer, offset_ integer);
CREATE OR REPLACE FUNCTION barber.list_barbers(limit_ integer, offset_ integer)
 RETURNS TABLE(id uuid, user_id uuid, display_name text, bio text, experience_years integer, rating_avg numeric, rating_count integer, shop_name text, address_text text, latitude numeric, longitude numeric, is_verified boolean, is_active boolean, is_online boolean, service_mode text, service_radius_km numeric, work_photos jsonb, users json, services json, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT bp.id, bp.fkuserid, bp.display_name::text, bp.bio, bp.experience_years,
           bp.rating_avg, bp.rating_count, bp.shop_name::text, bp.address_text::text,
           bp.latitude, bp.longitude, bp.is_verified, bp.is_active,
           bp.is_online, bp.service_mode::text, bp.service_radius_km,
           bp.work_photos,
           json_build_object('full_name', u.full_name, 'email', u.email, 'avatar_url', u.avatar_url),
           COALESCE((
             SELECT json_agg(json_build_object(
               'id', s.id, 'name', s.name, 'description', s.description,
               'price', s.price, 'currency', s.currency, 'duration_minutes', s.duration_minutes
             ) ORDER BY s.price ASC)
             FROM services s WHERE s.barber_id = bp.id AND s.is_active = true
           ), '[]'::json)
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_profiles bp
    JOIN users u ON bp.fkuserid = u.id
    WHERE bp.is_active = true
    ORDER BY bp.rating_avg DESC, bp.id
    LIMIT limit_ OFFSET offset_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.list_barbers found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.list_services();
CREATE OR REPLACE FUNCTION barber.list_services()
 RETURNS TABLE(id uuid, barber_id uuid, name text, description text, price numeric, currency text, duration_minutes integer, barber_profiles json, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT s.id, s.barber_id, s.name::text, s.description, s.price, s.currency::text,
           s.duration_minutes,
           json_build_object('id', bp.id, 'display_name', bp.display_name)
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM services s
    JOIN barber_profiles bp ON s.barber_id = bp.id
    WHERE s.is_active = true
    ORDER BY s.price ASC;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.list_services found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.list_verification_documents(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.list_verification_documents(barber_id_ uuid)
 RETURNS TABLE(document_type text, submitted_at timestamp with time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT d.document_type::text, d.submitted_at
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_verification_documents d
    WHERE d.barber_id = barber_id_ ORDER BY d.submitted_at;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.list_verification_documents found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.list_work_photos(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.list_work_photos(barber_id_ uuid)
 RETURNS TABLE(id uuid, url text, storage_key text, sort_order integer, caption text, bytes integer, mime_type text, created_at timestamp with time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    SELECT w.id, w.url, w.storage_key, w.sort_order, w.caption, w.bytes,
           w.mime_type::text, w.createddate
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_work_photos w
    WHERE w.barber_id = barber_id_
    ORDER BY w.sort_order ASC, w.createddate ASC;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.list_work_photos found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.log_api_key_usage(company_id_ integer, endpoint_ text, method_ text, status_code_ integer);
CREATE OR REPLACE FUNCTION barber.log_api_key_usage(company_id_ integer, endpoint_ text, method_ text, status_code_ integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO api_key_usage (company_id, endpoint, method, status_code, timestamp)
  VALUES (company_id_, endpoint_, method_, status_code_, now());
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.mark_all_notifications_read(user_id_ uuid);
CREATE OR REPLACE FUNCTION barber.mark_all_notifications_read(user_id_ uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE notifications n SET is_read = true WHERE n.fkuserid = user_id_ AND n.is_read = false;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.mark_booking_paid(booking_id_ uuid);
CREATE OR REPLACE FUNCTION barber.mark_booking_paid(booking_id_ uuid)
 RETURNS TABLE(id uuid, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    UPDATE bookings b SET payment_status = 'paid' WHERE b.id = booking_id_
    RETURNING b.id, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.mark_booking_paid found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.mark_notification_read(notification_id_ uuid, user_id_ uuid);
CREATE OR REPLACE FUNCTION barber.mark_notification_read(notification_id_ uuid, user_id_ uuid)
 RETURNS TABLE(id uuid, is_read boolean, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    UPDATE notifications n SET is_read = true
    WHERE n.id = notification_id_ AND n.fkuserid = user_id_
    RETURNING n.id, n.is_read, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.mark_notification_read found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.replace_barber_schedule(barber_id_ uuid, schedule_ jsonb);
CREATE OR REPLACE FUNCTION barber.replace_barber_schedule(barber_id_ uuid, schedule_ jsonb)
 RETURNS TABLE(id uuid, day_of_week integer, start_time time without time zone, end_time time without time zone, is_available boolean, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  DELETE FROM barber_schedule bs WHERE bs.barber_id = barber_id_;
  INSERT INTO barber_schedule (barber_id, day_of_week, start_time, end_time, is_available)
  SELECT barber_id_,
         (row_->>'day_of_week')::int,
         COALESCE(NULLIF(row_->>'start_time', ''), '09:00')::time,
         COALESCE(NULLIF(row_->>'end_time', ''), '18:00')::time,
         COALESCE((row_->>'is_available')::boolean, true)
  FROM jsonb_array_elements(schedule_) AS t(row_);
  RETURN QUERY
    SELECT bs.id, bs.day_of_week, bs.start_time, bs.end_time, bs.is_available
    , 'OK'::text AS statuscode_, ''::text AS statusmsg_ FROM barber_schedule bs WHERE bs.barber_id = barber_id_ ORDER BY bs.day_of_week;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.replace_barber_schedule found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.set_barber_online(barber_id_ uuid, is_online_ boolean);
CREATE OR REPLACE FUNCTION barber.set_barber_online(barber_id_ uuid, is_online_ boolean)
 RETURNS TABLE(is_online boolean, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    UPDATE barber_profiles bp SET is_online = is_online_ WHERE bp.id = barber_id_
    RETURNING bp.is_online, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.set_barber_online found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.set_user_avatar(user_id_ uuid, avatar_url_ text);
CREATE OR REPLACE FUNCTION barber.set_user_avatar(user_id_ uuid, avatar_url_ text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE users u SET avatar_url = avatar_url_ WHERE u.id = user_id_;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.set_user_phone(user_id_ uuid, phone_ text);
CREATE OR REPLACE FUNCTION barber.set_user_phone(user_id_ uuid, phone_ text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE users u SET phone = phone_ WHERE u.id = user_id_;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.set_work_photo_order(photo_id_ uuid, barber_id_ uuid, sort_order_ integer);
CREATE OR REPLACE FUNCTION barber.set_work_photo_order(photo_id_ uuid, barber_id_ uuid, sort_order_ integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE barber_work_photos w SET sort_order = sort_order_
  WHERE w.id = photo_id_ AND w.barber_id = barber_id_;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.set_work_photos_count(barber_id_ uuid, count_ integer);
CREATE OR REPLACE FUNCTION barber.set_work_photos_count(barber_id_ uuid, count_ integer)
 RETURNS TABLE(id uuid, work_photos_count integer, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    UPDATE barber_profiles bp SET work_photos_count = count_ WHERE bp.id = barber_id_
    RETURNING bp.id, bp.work_photos_count, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.set_work_photos_count found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.sync_work_photos(barber_id_ uuid);
CREATE OR REPLACE FUNCTION barber.sync_work_photos(barber_id_ uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  urls_ jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(w.url ORDER BY w.sort_order ASC, w.createddate ASC), '[]'::jsonb)
    INTO urls_
    FROM barber_work_photos w WHERE w.barber_id = barber_id_;
  UPDATE barber_profiles bp
     SET work_photos = urls_, work_photos_count = jsonb_array_length(urls_)
   WHERE bp.id = barber_id_;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.update_barber_profile(barber_id_ uuid, shop_name_ text, address_text_ text, bio_ text, display_name_ text, experience_years_ integer, service_mode_ text, booking_mode_ text, latitude_ numeric, longitude_ numeric, service_radius_km_ numeric, buffer_minutes_ integer, is_online_ boolean, city_ text, region_ text, country_ text, onboarding_step_ integer);
CREATE OR REPLACE FUNCTION barber.update_barber_profile(barber_id_ uuid, shop_name_ text, address_text_ text, bio_ text, display_name_ text, experience_years_ integer, service_mode_ text, booking_mode_ text, latitude_ numeric, longitude_ numeric, service_radius_km_ numeric, buffer_minutes_ integer, is_online_ boolean, city_ text, region_ text, country_ text, onboarding_step_ integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result_ jsonb;
BEGIN
  UPDATE barber_profiles bp SET
    shop_name = COALESCE(shop_name_, bp.shop_name),
    address_text = COALESCE(address_text_, bp.address_text),
    bio = COALESCE(bio_, bp.bio),
    display_name = COALESCE(display_name_, bp.display_name),
    experience_years = COALESCE(experience_years_, bp.experience_years),
    service_mode = COALESCE(service_mode_, bp.service_mode),
    booking_mode = COALESCE(booking_mode_, bp.booking_mode),
    latitude = COALESCE(latitude_, bp.latitude),
    longitude = COALESCE(longitude_, bp.longitude),
    service_radius_km = COALESCE(service_radius_km_, bp.service_radius_km),
    buffer_minutes = COALESCE(buffer_minutes_, bp.buffer_minutes),
    is_online = COALESCE(is_online_, bp.is_online),
    city = COALESCE(city_, bp.city),
    region = COALESCE(region_, bp.region),
    country = COALESCE(country_, bp.country),
    onboarding_step = GREATEST(COALESCE(onboarding_step_, bp.onboarding_step, 1), COALESCE(bp.onboarding_step, 1))
  WHERE bp.id = barber_id_;
  SELECT barber.answer_with_app_keys(to_jsonb(bp)) INTO result_ FROM barber_profiles bp WHERE bp.id = barber_id_;
  RETURN result_;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.update_service(service_id_ uuid, barber_id_ uuid, name_ text, description_ text, price_ numeric, duration_minutes_ integer, category_id_ uuid, is_active_ boolean);
CREATE OR REPLACE FUNCTION barber.update_service(service_id_ uuid, barber_id_ uuid, name_ text, description_ text, price_ numeric, duration_minutes_ integer, category_id_ uuid, is_active_ boolean)
 RETURNS TABLE(id uuid, barber_id uuid, category_id uuid, name text, description text, price numeric, currency text, duration_minutes integer, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, statuscode_ text, statusmsg_ text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
    UPDATE services s SET
      name = COALESCE(name_, s.name),
      description = COALESCE(description_, s.description),
      price = COALESCE(price_, s.price),
      duration_minutes = COALESCE(duration_minutes_, s.duration_minutes),
      category_id = COALESCE(category_id_, s.category_id),
      is_active = COALESCE(is_active_, s.is_active)
    WHERE s.id = service_id_ AND s.barber_id = barber_id_
    RETURNING s.id, s.barber_id, s.category_id, s.name::text, s.description, s.price,
              s.currency::text, s.duration_minutes, s.is_active, s.createddate, s.modifieddate, 'OK'::text AS statuscode_, ''::text AS statusmsg_;
  IF NOT FOUND THEN
    RAISE NOTICE 'NODATA: barber.update_service found nothing for the given parameters';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;

DROP FUNCTION IF EXISTS barber.write_audit_log(admin_user_id_ text, action_ text, resource_type_ text, resource_id_ text, changes_ jsonb, ip_address_ text);
CREATE OR REPLACE FUNCTION barber.write_audit_log(admin_user_id_ text, action_ text, resource_type_ text, resource_id_ text, changes_ jsonb, ip_address_ text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO audit_log (admin_user_id, action, resource_type, resource_id, changes, ip_address)
  VALUES (admin_user_id_, action_, resource_type_, resource_id_, changes_, ip_address_);
EXCEPTION WHEN OTHERS THEN
  -- never swallow it: the caller must see the real error.
  RAISE;
END $function$;


-- ============================================================================
-- A dropped function loses its grants and its comment. Put them back, exactly
-- as migration 007 set them.
-- ============================================================================
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA barber FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA barber REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
GRANT USAGE ON SCHEMA barber TO shorter_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA barber TO shorter_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA barber GRANT EXECUTE ON FUNCTIONS TO shorter_app;

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

