-- 003_barber_functions.sql
-- HARD RULE: no raw SQL in application code. Every data operation the Shorter
-- server performs goes through one of these built-in functions; the app layer
-- only ever calls SELECT * FROM barber.<fn>(...).
--
-- Conventions (platform Postgres standards):
--   * one function per name, never overloaded
--   * input params named with trailing underscore (user_id_)
--   * SECURITY DEFINER, owned by postgres; app role barber_app gets EXECUTE only
--   * errors RAISE (no silent failures); delete_account returns statuscode_/statusmsg_
--
-- Idempotent: CREATE OR REPLACE everywhere. Applied to foundation_barber_<id>
-- tenant DBs, barber_app_template, and the shared admin DB barber_app —
-- plpgsql bodies are not parsed for table existence at CREATE time, so
-- functions whose tables live in another database are inert but harmless.

CREATE SCHEMA IF NOT EXISTS barber;

-- ============================================================================
-- SHARED / INFRA
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.db_now()
RETURNS TABLE(now timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT now();
END $$;

-- ============================================================================
-- TENANT MIDDLEWARE (admin DB: barber_app)
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.get_company_by_api_key(api_key_ text, status_ text)
RETURNS TABLE(id int, name text, subscription_tier text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT c.id, c.name::text, c.subscription_tier::text
    FROM companies c
    WHERE c.api_key::text = api_key_ AND c.status = status_;
END $$;

CREATE OR REPLACE FUNCTION barber.log_api_key_usage(company_id_ int, endpoint_ text, method_ text, status_code_ int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO api_key_usage (company_id, endpoint, method, status_code, timestamp)
  VALUES (company_id_, endpoint_, method_, status_code_, now());
END $$;

CREATE OR REPLACE FUNCTION barber.check_entitlement(company_id_ int, feature_ text)
RETURNS TABLE(enabled boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT e.enabled
    FROM company_entitlements e
    WHERE e.company_id = company_id_ AND e.feature = feature_;
END $$;

-- ============================================================================
-- AUTH (tenant DB)
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.get_user_id_by_email(email_ text)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT u.id FROM users u WHERE u.email = email_;
END $$;

CREATE OR REPLACE FUNCTION barber.create_user(email_ text, full_name_ text, role_ text, password_hash_ text)
RETURNS TABLE(id uuid, email text, full_name text, role text, avatar_url text, phone text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    INSERT INTO users (email, full_name, role, password_hash)
    VALUES (email_, full_name_, role_, password_hash_)
    RETURNING users.id, users.email::text, users.full_name::text, users.role::text,
              users.avatar_url::text, users.phone::text, users.created_at;
END $$;

CREATE OR REPLACE FUNCTION barber.create_barber_profile(user_id_ uuid, display_name_ text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO barber_profiles (user_id, display_name, is_verified, is_approved, onboarding_completed)
  VALUES (user_id_, display_name_, false, false, false);
END $$;

CREATE OR REPLACE FUNCTION barber.get_user_for_login(email_ text)
RETURNS TABLE(id uuid, email text, full_name text, role text, avatar_url text, phone text, password_hash text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT u.id, u.email::text, u.full_name::text, u.role::text,
           u.avatar_url::text, u.phone::text, u.password_hash::text
    FROM users u
    WHERE u.email = email_ AND u.is_active = true;
END $$;

CREATE OR REPLACE FUNCTION barber.get_barber_login_status(user_id_ uuid)
RETURNS TABLE(onboarding_completed boolean, is_verified boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT bp.onboarding_completed, bp.is_verified
    FROM barber_profiles bp WHERE bp.user_id = user_id_;
END $$;

-- ============================================================================
-- STRIPE WEBHOOK (tenant DB)
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.mark_booking_paid(booking_id_ uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    UPDATE bookings b SET payment_status = 'paid' WHERE b.id = booking_id_
    RETURNING b.id;
END $$;

-- ============================================================================
-- ADMIN DASHBOARD (admin DB)
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.get_admin_company_stats()
RETURNS TABLE(active_companies bigint, suspended_companies bigint, total_companies bigint, total_max_barbers bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT
      COUNT(*) FILTER (WHERE c.status = 'active'),
      COUNT(*) FILTER (WHERE c.status = 'suspended'),
      COUNT(*),
      SUM(CAST(c.max_barbers AS BIGINT))::bigint
    FROM companies c;
END $$;

CREATE OR REPLACE FUNCTION barber.list_active_companies()
RETURNS TABLE(id int, name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT c.id, c.name::text FROM companies c WHERE c.status = 'active' ORDER BY c.id;
END $$;

-- Tenant DB: last-30-days daily bookings/revenue rollup.
CREATE OR REPLACE FUNCTION barber.get_tenant_daily_booking_stats()
RETURNS TABLE(date text, bookings bigint, revenue numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT b.booking_date::text, COUNT(*),
           COALESCE(SUM(b.total_amount) FILTER (WHERE b.payment_status = 'paid'), 0)::numeric
    FROM bookings b
    WHERE b.booking_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY b.booking_date;
END $$;

CREATE OR REPLACE FUNCTION barber.get_tenant_booking_totals()
RETURNS TABLE(booking_count bigint, paid_revenue numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT COUNT(*),
           COALESCE(SUM(b.total_amount) FILTER (WHERE b.payment_status = 'paid'), 0)::numeric
    FROM bookings b;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_list_companies()
RETURNS TABLE(id int, name text, owner_email text, subscription_tier text, status text,
              max_barbers int, renewal_date date, api_usage_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT c.id, c.name::text, c.owner_email::text, c.subscription_tier::text, c.status::text,
           c.max_barbers, s.renewal_date,
           COUNT(DISTINCT u.company_id)
    FROM companies c
    LEFT JOIN company_subscriptions s ON c.id = s.company_id
    LEFT JOIN api_key_usage u ON c.id = u.company_id AND u.timestamp > NOW() - INTERVAL '24 hours'
    GROUP BY c.id, s.renewal_date
    ORDER BY c.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_create_company(name_ text, owner_email_ text, subscription_tier_ text, max_barbers_ int)
RETURNS TABLE(id int, name text, owner_email text, api_key uuid, subscription_tier text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    INSERT INTO companies (name, owner_email, subscription_tier, max_barbers)
    VALUES (name_, owner_email_, subscription_tier_, max_barbers_)
    RETURNING companies.id, companies.name::text, companies.owner_email::text,
              companies.api_key, companies.subscription_tier::text;
END $$;

CREATE OR REPLACE FUNCTION barber.add_company_entitlement(company_id_ int, feature_ text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO company_entitlements (company_id, feature, enabled) VALUES (company_id_, feature_, true);
END $$;

CREATE OR REPLACE FUNCTION barber.get_company_by_id(id_ int)
RETURNS TABLE(id int, name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT c.id, c.name::text FROM companies c WHERE c.id = id_;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_get_company_detail(id_ int)
RETURNS TABLE(id int, name text, owner_email text, api_key uuid, subscription_tier text,
              max_barbers int, status text, created_at timestamp, updated_at timestamp,
              renewal_date date, subscription_status text, api_calls_24h bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT c.id, c.name::text, c.owner_email::text, c.api_key, c.subscription_tier::text,
           c.max_barbers, c.status::text, c.created_at, c.updated_at,
           s.renewal_date, s.status::text,
           COUNT(DISTINCT aku.company_id)
    FROM companies c
    LEFT JOIN company_subscriptions s ON c.id = s.company_id
    LEFT JOIN api_key_usage aku ON c.id = aku.company_id AND aku.timestamp > NOW() - INTERVAL '24 hours'
    WHERE c.id = id_
    GROUP BY c.id, s.renewal_date, s.status;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_set_company_status(id_ int, status_ text)
RETURNS TABLE(id int, name text, owner_email text, subscription_tier text, status text,
              max_barbers int, created_at timestamp)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    UPDATE companies c SET status = status_ WHERE c.id = id_
    RETURNING c.id, c.name::text, c.owner_email::text, c.subscription_tier::text,
              c.status::text, c.max_barbers, c.created_at;
END $$;

-- Tenant DB: bookings list for the admin company drill-down.
CREATE OR REPLACE FUNCTION barber.admin_get_company_bookings()
RETURNS TABLE(id uuid, booking_reference text, booking_date date, start_time time, end_time time,
              status text, payment_status text, total_amount numeric, currency text,
              created_at timestamptz, barber json, service json)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT b.id, b.booking_reference::text, b.booking_date, b.start_time, b.end_time,
           b.status::text, b.payment_status::text, b.total_amount, b.currency::text, b.created_at,
           json_build_object('id', bp.id, 'display_name', bp.display_name, 'shop_name', bp.shop_name),
           json_build_object('id', s.id, 'name', s.name, 'price', s.price, 'duration_minutes', s.duration_minutes)
    FROM bookings b
    JOIN barber_profiles bp ON b.barber_id = bp.id
    JOIN services s ON b.service_id = s.id
    ORDER BY b.created_at DESC
    LIMIT 50;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_get_company_barbers()
RETURNS TABLE(id uuid, display_name text, bio text, experience_years int, rating_avg numeric,
              rating_count int, shop_name text, address_text text, is_verified boolean,
              is_approved boolean, is_active boolean, onboarding_completed boolean,
              created_at timestamptz, email text, full_name text, phone text, avatar_url text,
              user_is_active boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT bp.id, bp.display_name::text, bp.bio, bp.experience_years, bp.rating_avg,
           bp.rating_count, bp.shop_name::text, bp.address_text::text, bp.is_verified,
           bp.is_approved, bp.is_active, bp.onboarding_completed,
           bp.created_at, u.email::text, u.full_name::text, u.phone::text, u.avatar_url::text,
           u.is_active
    FROM barber_profiles bp
    JOIN users u ON bp.user_id = u.id
    ORDER BY bp.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_get_barber_profile(barber_id_ uuid)
RETURNS TABLE(id uuid, display_name text, bio text, experience_years int, rating_avg numeric,
              rating_count int, shop_name text, address_text text, latitude numeric, longitude numeric,
              is_verified boolean, is_approved boolean, is_active boolean,
              created_at timestamptz, updated_at timestamptz,
              user_id uuid, email text, full_name text, phone text, avatar_url text,
              user_is_active boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT bp.id, bp.display_name::text, bp.bio, bp.experience_years, bp.rating_avg, bp.rating_count,
           bp.shop_name::text, bp.address_text::text, bp.latitude, bp.longitude,
           bp.is_verified, bp.is_approved, bp.is_active, bp.created_at, bp.updated_at,
           u.id, u.email::text, u.full_name::text, u.phone::text, u.avatar_url::text, u.is_active
    FROM barber_profiles bp
    JOIN users u ON bp.user_id = u.id
    WHERE bp.id = barber_id_;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_get_barber_services(barber_id_ uuid)
RETURNS TABLE(id uuid, name text, description text, price numeric, currency text,
              duration_minutes int, is_active boolean, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT s.id, s.name::text, s.description, s.price, s.currency::text,
           s.duration_minutes, s.is_active, s.created_at
    FROM services s WHERE s.barber_id = barber_id_ ORDER BY s.price ASC;
END $$;

CREATE OR REPLACE FUNCTION barber.get_barber_schedule(barber_id_ uuid)
RETURNS TABLE(id uuid, day_of_week int, start_time time, end_time time, is_available boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT bs.id, bs.day_of_week, bs.start_time, bs.end_time, bs.is_available
    FROM barber_schedule bs WHERE bs.barber_id = barber_id_
    ORDER BY bs.day_of_week ASC, bs.start_time ASC;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_get_barber_bookings(barber_id_ uuid)
RETURNS TABLE(id uuid, booking_reference text, booking_date date, start_time time, end_time time,
              status text, payment_status text, total_amount numeric, currency text,
              created_at timestamptz, service json, customer json)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT b.id, b.booking_reference::text, b.booking_date, b.start_time, b.end_time,
           b.status::text, b.payment_status::text, b.total_amount, b.currency::text, b.created_at,
           json_build_object('id', s.id, 'name', s.name),
           json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email)
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN users u ON b.customer_id = u.id
    WHERE b.barber_id = barber_id_
    ORDER BY b.created_at DESC
    LIMIT 50;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_get_barber_reviews(barber_id_ uuid)
RETURNS TABLE(id uuid, rating int, comment text, created_at timestamptz, customer json)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT r.id, r.rating, r.comment, r.created_at,
           json_build_object('id', u.id, 'full_name', u.full_name)
    FROM reviews r
    JOIN users u ON r.customer_id = u.id
    WHERE r.barber_id = barber_id_
    ORDER BY r.created_at DESC
    LIMIT 50;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_get_barber_stats(barber_id_ uuid)
RETURNS TABLE(total_bookings bigint, completed_bookings bigint, cancelled_bookings bigint,
              total_paid_revenue numeric, avg_booking_value numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE b.status = 'completed'),
           COUNT(*) FILTER (WHERE b.status = 'cancelled'),
           COALESCE(SUM(b.total_amount) FILTER (WHERE b.payment_status = 'paid'), 0)::numeric,
           COALESCE(AVG(b.total_amount), 0)::numeric
    FROM bookings b WHERE b.barber_id = barber_id_;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_get_company_payments()
RETURNS TABLE(id uuid, amount numeric, currency text, payment_method text, transaction_id text,
              status text, notes text, created_at timestamptz, booking json, customer json)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.amount, p.currency::text, p.payment_method::text, p.transaction_id::text,
           p.status::text, p.notes, p.created_at,
           json_build_object('id', b.id, 'booking_reference', b.booking_reference,
                             'booking_date', b.booking_date, 'total_amount', b.total_amount,
                             'payment_status', b.payment_status),
           json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email)
    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    JOIN users u ON p.customer_id = u.id
    ORDER BY p.created_at DESC
    LIMIT 100;
END $$;

CREATE OR REPLACE FUNCTION barber.get_booking_payment_breakdown()
RETURNS TABLE(payment_status text, payment_method text, count bigint, total_amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT b.payment_status::text, b.payment_method::text, COUNT(*),
           COALESCE(SUM(b.total_amount), 0)::numeric
    FROM bookings b
    GROUP BY b.payment_status, b.payment_method
    ORDER BY b.payment_status;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_get_company_onboarding_row(id_ int)
RETURNS TABLE(id int, name text, subscription_tier text, max_barbers int, status text, created_at timestamp)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT c.id, c.name::text, c.subscription_tier::text, c.max_barbers, c.status::text, c.created_at
    FROM companies c WHERE c.id = id_;
END $$;

CREATE OR REPLACE FUNCTION barber.get_company_entitlements(company_id_ int)
RETURNS TABLE(feature text, enabled boolean, updated_at timestamp)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT e.feature::text, e.enabled, e.updated_at
    FROM company_entitlements e WHERE e.company_id = company_id_ ORDER BY e.feature;
END $$;

CREATE OR REPLACE FUNCTION barber.get_company_activity(company_id_ int)
RETURNS TABLE(last_active timestamp, calls_7d bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT MAX(a.timestamp), COUNT(*)
    FROM api_key_usage a
    WHERE a.company_id = company_id_ AND a.timestamp > NOW() - INTERVAL '7 days';
END $$;

CREATE OR REPLACE FUNCTION barber.count_active_barbers()
RETURNS TABLE(count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT COUNT(*) FROM barber_profiles bp WHERE bp.is_active = true;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_get_recent_bookings(limit_ int)
RETURNS TABLE(id uuid, booking_reference text, booking_date date, start_time time,
              status text, payment_status text, total_amount numeric, currency text,
              created_at timestamptz, barber_name text, service_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT b.id, b.booking_reference::text, b.booking_date, b.start_time,
           b.status::text, b.payment_status::text, b.total_amount, b.currency::text,
           b.created_at, bp.display_name::text, s.name::text
    FROM bookings b
    JOIN barber_profiles bp ON b.barber_id = bp.id
    JOIN services s ON b.service_id = s.id
    ORDER BY b.created_at DESC
    LIMIT limit_;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_get_income_report()
RETURNS TABLE(date date, total_revenue numeric, active_companies bigint, total_bookings bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT DATE(m.metric_date), SUM(m.total_revenue)::numeric,
           COUNT(DISTINCT m.company_id), SUM(m.completed_bookings)::bigint
    FROM booking_metrics m
    GROUP BY DATE(m.metric_date)
    ORDER BY DATE(m.metric_date) DESC
    LIMIT 90;
END $$;

-- ============================================================================
-- COMPANY DASHBOARD (admin DB + tenant DB)
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.get_company_metrics_30d(company_id_ int)
RETURNS TABLE(total_bookings bigint, completed_bookings bigint, canceled_bookings bigint,
              total_revenue numeric, average_rating numeric, metric_days bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT SUM(m.total_bookings)::bigint, SUM(m.completed_bookings)::bigint,
           SUM(m.canceled_bookings)::bigint, SUM(m.total_revenue)::numeric,
           AVG(m.average_rating)::numeric, COUNT(*)
    FROM booking_metrics m
    WHERE m.company_id = company_id_ AND m.metric_date >= CURRENT_DATE - INTERVAL '30 days';
END $$;

CREATE OR REPLACE FUNCTION barber.count_today_bookings()
RETURNS TABLE(count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT COUNT(*) FROM bookings b WHERE DATE(b.booking_date) = CURRENT_DATE;
END $$;

CREATE OR REPLACE FUNCTION barber.company_list_bookings()
RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid,
              booking_date date, start_time time, status text, payment_status text,
              total_amount numeric, barber_name text, service_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT b.id, b.booking_reference::text, b.customer_id, b.barber_id, b.service_id,
           b.booking_date, b.start_time, b.status::text, b.payment_status::text,
           b.total_amount, bp.display_name::text, s.name::text
    FROM bookings b
    JOIN barber_profiles bp ON b.barber_id = bp.id
    JOIN services s ON b.service_id = s.id
    ORDER BY b.booking_date DESC
    LIMIT 100;
END $$;

CREATE OR REPLACE FUNCTION barber.get_company_income(company_id_ int)
RETURNS TABLE(metric_date date, total_bookings int, completed_bookings int, canceled_bookings int,
              total_revenue numeric, average_rating numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT m.metric_date, m.total_bookings, m.completed_bookings, m.canceled_bookings,
           m.total_revenue, m.average_rating
    FROM booking_metrics m
    WHERE m.company_id = company_id_
    ORDER BY m.metric_date DESC
    LIMIT 90;
END $$;

CREATE OR REPLACE FUNCTION barber.company_list_barbers()
RETURNS TABLE(id uuid, display_name text, bio text, experience_years int, rating_avg numeric,
              rating_count int, is_active boolean, total_bookings bigint, completed_bookings bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT bp.id, bp.display_name::text, bp.bio, bp.experience_years, bp.rating_avg,
           bp.rating_count, bp.is_active,
           COUNT(b.id), COUNT(b.id) FILTER (WHERE b.status = 'completed')
    FROM barber_profiles bp
    LEFT JOIN bookings b ON bp.id = b.barber_id
    GROUP BY bp.id
    ORDER BY bp.rating_avg DESC;
END $$;

-- ============================================================================
-- PUBLIC BARBER DISCOVERY (tenant DB)
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.list_barbers(limit_ int, offset_ int)
RETURNS TABLE(id uuid, user_id uuid, display_name text, bio text, experience_years int,
              rating_avg numeric, rating_count int, shop_name text, address_text text,
              latitude numeric, longitude numeric, is_verified boolean, is_active boolean,
              is_online boolean, service_mode text, service_radius_km numeric,
              work_photos jsonb, users json, services json)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT bp.id, bp.user_id, bp.display_name::text, bp.bio, bp.experience_years,
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
    FROM barber_profiles bp
    JOIN users u ON bp.user_id = u.id
    WHERE bp.is_active = true
    ORDER BY bp.rating_avg DESC, bp.id
    LIMIT limit_ OFFSET offset_;
END $$;

CREATE OR REPLACE FUNCTION barber.get_nearby_barbers(lat_ float8, lng_ float8, radius_km_ float8,
                                                     limit_ int, box_meters_ float8,
                                                     online_only_ boolean, offset_ int)
RETURNS TABLE(id uuid, user_id uuid, display_name text, bio text, experience_years int,
              rating_avg numeric, rating_count int, shop_name text, address_text text,
              latitude numeric, longitude numeric, is_verified boolean, is_active boolean,
              is_online boolean, service_mode text, service_radius_km numeric,
              work_photos jsonb, users json, services json, distance_km numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    WITH origin AS (SELECT ll_to_earth(lat_, lng_) AS pt)
    SELECT bp.id, bp.user_id, bp.display_name::text, bp.bio, bp.experience_years,
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
    FROM barber_profiles bp
    JOIN users u ON bp.user_id = u.id
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
END $$;

CREATE OR REPLACE FUNCTION barber.get_barber_detail(barber_id_ uuid)
RETURNS TABLE(id uuid, user_id uuid, display_name text, bio text, experience_years int,
              rating_avg numeric, rating_count int, shop_name text, address_text text,
              work_photos jsonb, users json, services json)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT bp.id, bp.user_id, bp.display_name::text, bp.bio, bp.experience_years,
           bp.rating_avg, bp.rating_count, bp.shop_name::text, bp.address_text::text,
           bp.work_photos,
           json_build_object('full_name', u.full_name, 'email', u.email, 'avatar_url', u.avatar_url),
           json_agg(json_build_object(
             'id', s.id, 'name', s.name, 'description', s.description,
             'price', s.price, 'currency', s.currency, 'duration_minutes', s.duration_minutes))
    FROM barber_profiles bp
    JOIN users u ON bp.user_id = u.id
    LEFT JOIN services s ON s.barber_id = bp.id
    WHERE bp.id = barber_id_
    GROUP BY bp.id, u.id;
END $$;

-- ============================================================================
-- BOOKINGS (tenant DB)
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.get_customer_bookings(customer_id_ uuid)
RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid,
              booking_date date, start_time time, end_time time, status text, payment_status text,
              total_amount numeric, barber_profiles json, barber_phone text, services json)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT b.id, b.booking_reference::text, b.customer_id, b.barber_id, b.service_id,
           b.booking_date, b.start_time, b.end_time, b.status::text, b.payment_status::text,
           b.total_amount,
           json_build_object('id', bp.id, 'display_name', bp.display_name, 'shop_name', bp.shop_name),
           (CASE WHEN b.status IN ('confirmed', 'completed') THEN bu.phone END)::text,
           json_build_object('id', s.id, 'name', s.name, 'price', s.price, 'duration_minutes', s.duration_minutes)
    FROM bookings b
    JOIN barber_profiles bp ON b.barber_id = bp.id
    JOIN users bu ON bp.user_id = bu.id
    JOIN services s ON b.service_id = s.id
    WHERE b.customer_id = customer_id_
    ORDER BY b.booking_date DESC;
END $$;

CREATE OR REPLACE FUNCTION barber.get_barber_bookings(barber_user_id_ uuid)
RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid,
              booking_date date, start_time time, end_time time, status text, payment_status text,
              total_amount numeric, notes text, users json, services json, barber_profiles json,
              customer_phone text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT b.id, b.booking_reference::text, b.customer_id, b.barber_id, b.service_id,
           b.booking_date, b.start_time, b.end_time, b.status::text, b.payment_status::text,
           b.total_amount, b.notes,
           json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email),
           json_build_object('id', s.id, 'name', s.name, 'price', s.price, 'duration_minutes', s.duration_minutes),
           json_build_object('shop_name', bp.shop_name, 'address_text', bp.address_text),
           (CASE WHEN b.status IN ('confirmed', 'completed') THEN u.phone END)::text
    FROM bookings b
    JOIN barber_profiles bp ON b.barber_id = bp.id
    JOIN users u ON b.customer_id = u.id
    JOIN services s ON b.service_id = s.id
    WHERE bp.user_id = barber_user_id_
    ORDER BY b.booking_date DESC;
END $$;

CREATE OR REPLACE FUNCTION barber.get_service_for_booking(service_id_ uuid)
RETURNS TABLE(price numeric, duration_minutes int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT s.price, s.duration_minutes FROM services s WHERE s.id = service_id_;
END $$;

CREATE OR REPLACE FUNCTION barber.create_booking(booking_reference_ text, customer_id_ uuid,
    barber_id_ uuid, service_id_ uuid, booking_date_ date, start_time_ time, end_time_ time,
    status_ text, payment_status_ text, total_amount_ numeric, notes_ text)
RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid,
              booking_date date, start_time time, end_time time, status text, payment_status text,
              payment_method text, total_amount numeric, currency text, notes text,
              created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    INSERT INTO bookings (booking_reference, customer_id, barber_id, service_id,
                          booking_date, start_time, end_time, status, payment_status,
                          total_amount, notes)
    VALUES (booking_reference_, customer_id_, barber_id_, service_id_, booking_date_,
            start_time_, end_time_, status_, payment_status_, total_amount_, notes_)
    RETURNING bookings.id, bookings.booking_reference::text, bookings.customer_id,
              bookings.barber_id, bookings.service_id, bookings.booking_date,
              bookings.start_time, bookings.end_time, bookings.status::text,
              bookings.payment_status::text, bookings.payment_method::text,
              bookings.total_amount, bookings.currency::text, bookings.notes,
              bookings.created_at, bookings.updated_at;
END $$;

CREATE OR REPLACE FUNCTION barber.accept_booking(booking_id_ uuid, barber_id_ uuid)
RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid,
              booking_date date, start_time time, end_time time, status text, payment_status text,
              payment_method text, total_amount numeric, currency text, notes text,
              created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    UPDATE bookings b SET status = 'confirmed'
    WHERE b.id = booking_id_ AND b.barber_id = barber_id_ AND b.status = 'pending'
    RETURNING b.id, b.booking_reference::text, b.customer_id, b.barber_id, b.service_id,
              b.booking_date, b.start_time, b.end_time, b.status::text, b.payment_status::text,
              b.payment_method::text, b.total_amount, b.currency::text, b.notes,
              b.created_at, b.updated_at;
END $$;

CREATE OR REPLACE FUNCTION barber.complete_booking(booking_id_ uuid, barber_id_ uuid)
RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid,
              booking_date date, start_time time, end_time time, status text, payment_status text,
              payment_method text, total_amount numeric, currency text, notes text,
              created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    UPDATE bookings b SET status = 'completed'
    WHERE b.id = booking_id_ AND b.barber_id = barber_id_ AND b.status = 'confirmed'
    RETURNING b.id, b.booking_reference::text, b.customer_id, b.barber_id, b.service_id,
              b.booking_date, b.start_time, b.end_time, b.status::text, b.payment_status::text,
              b.payment_method::text, b.total_amount, b.currency::text, b.notes,
              b.created_at, b.updated_at;
END $$;

CREATE OR REPLACE FUNCTION barber.cancel_booking(booking_id_ uuid, user_id_ uuid, barber_id_ uuid)
RETURNS TABLE(id uuid, booking_reference text, customer_id uuid, barber_id uuid, service_id uuid,
              booking_date date, start_time time, end_time time, status text, payment_status text,
              payment_method text, total_amount numeric, currency text, notes text,
              created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    UPDATE bookings b SET status = 'cancelled'
    WHERE b.id = booking_id_
      AND b.status IN ('pending','confirmed')
      AND (b.customer_id = user_id_ OR (barber_id_ IS NOT NULL AND b.barber_id = barber_id_))
    RETURNING b.id, b.booking_reference::text, b.customer_id, b.barber_id, b.service_id,
              b.booking_date, b.start_time, b.end_time, b.status::text, b.payment_status::text,
              b.payment_method::text, b.total_amount, b.currency::text, b.notes,
              b.created_at, b.updated_at;
END $$;

CREATE OR REPLACE FUNCTION barber.get_booking_for_payment(booking_id_ uuid, customer_id_ uuid)
RETURNS TABLE(id uuid, total_amount numeric, currency text, payment_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT b.id, b.total_amount, b.currency::text, b.payment_status::text
    FROM bookings b WHERE b.id = booking_id_ AND b.customer_id = customer_id_;
END $$;

-- ============================================================================
-- NOTIFICATIONS (tenant DB)
-- ============================================================================

-- Inserts the notification AND returns the owner's email for the best-effort
-- email copy — one logical operation.
CREATE OR REPLACE FUNCTION barber.create_notification(user_id_ uuid, title_ text, message_ text,
                                                      type_ text, related_id_ uuid)
RETURNS TABLE(email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (user_id_, title_, message_, type_, related_id_);
  RETURN QUERY SELECT u.email::text FROM users u WHERE u.id = user_id_;
END $$;

CREATE OR REPLACE FUNCTION barber.get_barber_user_id(barber_profile_id_ uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT bp.user_id FROM barber_profiles bp WHERE bp.id = barber_profile_id_;
END $$;

CREATE OR REPLACE FUNCTION barber.get_notifications(user_id_ uuid)
RETURNS TABLE(id uuid, title text, message text, type text, related_id uuid,
              is_read boolean, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT n.id, n.title::text, n.message, n.type::text, n.related_id, n.is_read, n.created_at
    FROM notifications n WHERE n.user_id = user_id_
    ORDER BY n.created_at DESC
    LIMIT 50;
END $$;

CREATE OR REPLACE FUNCTION barber.mark_notification_read(notification_id_ uuid, user_id_ uuid)
RETURNS TABLE(id uuid, is_read boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    UPDATE notifications n SET is_read = true
    WHERE n.id = notification_id_ AND n.user_id = user_id_
    RETURNING n.id, n.is_read;
END $$;

CREATE OR REPLACE FUNCTION barber.mark_all_notifications_read(user_id_ uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE notifications n SET is_read = true WHERE n.user_id = user_id_ AND n.is_read = false;
END $$;

-- ============================================================================
-- REVIEWS (tenant DB)
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.get_booking_barber_for_review(booking_id_ uuid, customer_id_ uuid)
RETURNS TABLE(barber_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT b.barber_id FROM bookings b
    WHERE b.id = booking_id_ AND b.customer_id = customer_id_ AND b.status = 'completed';
END $$;

CREATE OR REPLACE FUNCTION barber.get_review_by_booking(booking_id_ uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT r.id FROM reviews r WHERE r.booking_id = booking_id_;
END $$;

-- Creates the review AND refreshes the barber's rating aggregate atomically.
CREATE OR REPLACE FUNCTION barber.create_review(booking_id_ uuid, customer_id_ uuid,
                                                barber_id_ uuid, rating_ int, comment_ text)
RETURNS TABLE(id uuid, booking_id uuid, customer_id uuid, barber_id uuid, rating int,
              comment text, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  review_id_ uuid;
BEGIN
  INSERT INTO reviews (booking_id, customer_id, barber_id, rating, comment)
  VALUES (booking_id_, customer_id_, barber_id_, rating_, comment_)
  RETURNING reviews.id INTO review_id_;

  UPDATE barber_profiles bp
     SET rating_avg = (SELECT AVG(r.rating) FROM reviews r WHERE r.barber_id = barber_id_),
         rating_count = (SELECT COUNT(*) FROM reviews r WHERE r.barber_id = barber_id_)
   WHERE bp.id = barber_id_;

  RETURN QUERY
    SELECT r.id, r.booking_id, r.customer_id, r.barber_id, r.rating, r.comment,
           r.created_at, r.updated_at
    FROM reviews r WHERE r.id = review_id_;
END $$;

CREATE OR REPLACE FUNCTION barber.get_reviews_by_barber(barber_id_ uuid)
RETURNS TABLE(id uuid, rating int, comment text, created_at timestamptz, customer_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT r.id, r.rating, r.comment, r.created_at, u.full_name::text
    FROM reviews r
    JOIN users u ON u.id = r.customer_id
    WHERE r.barber_id = barber_id_
    ORDER BY r.created_at DESC;
END $$;

-- ============================================================================
-- SERVICES (tenant DB)
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.list_services()
RETURNS TABLE(id uuid, barber_id uuid, name text, description text, price numeric,
              currency text, duration_minutes int, barber_profiles json)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT s.id, s.barber_id, s.name::text, s.description, s.price, s.currency::text,
           s.duration_minutes,
           json_build_object('id', bp.id, 'display_name', bp.display_name)
    FROM services s
    JOIN barber_profiles bp ON s.barber_id = bp.id
    WHERE s.is_active = true
    ORDER BY s.price ASC;
END $$;

CREATE OR REPLACE FUNCTION barber.get_own_services(barber_id_ uuid)
RETURNS TABLE(id uuid, name text, description text, price numeric, currency text, duration_minutes int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT s.id, s.name::text, s.description, s.price, s.currency::text, s.duration_minutes
    FROM services s WHERE s.barber_id = barber_id_ AND s.is_active = true;
END $$;

CREATE OR REPLACE FUNCTION barber.create_service(barber_id_ uuid, category_id_ uuid, name_ text,
                                                 description_ text, price_ numeric, duration_minutes_ int)
RETURNS TABLE(id uuid, barber_id uuid, category_id uuid, name text, description text, price numeric,
              currency text, duration_minutes int, is_active boolean,
              created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    INSERT INTO services (barber_id, category_id, name, description, price, duration_minutes)
    VALUES (barber_id_, category_id_, name_, description_, price_, duration_minutes_)
    RETURNING services.id, services.barber_id, services.category_id, services.name::text,
              services.description, services.price, services.currency::text,
              services.duration_minutes, services.is_active,
              services.created_at, services.updated_at;
END $$;

CREATE OR REPLACE FUNCTION barber.update_service(service_id_ uuid, barber_id_ uuid, name_ text,
    description_ text, price_ numeric, duration_minutes_ int, category_id_ uuid, is_active_ boolean)
RETURNS TABLE(id uuid, barber_id uuid, category_id uuid, name text, description text, price numeric,
              currency text, duration_minutes int, is_active boolean,
              created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
              s.currency::text, s.duration_minutes, s.is_active, s.created_at, s.updated_at;
END $$;

CREATE OR REPLACE FUNCTION barber.delete_service(service_id_ uuid, barber_id_ uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    DELETE FROM services s WHERE s.id = service_id_ AND s.barber_id = barber_id_
    RETURNING s.id;
END $$;

-- ============================================================================
-- BARBER PROFILE / STATUS / SCHEDULE / ONBOARDING (tenant DB)
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.get_own_barber_profile_id(user_id_ uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT bp.id FROM barber_profiles bp WHERE bp.user_id = user_id_;
END $$;

CREATE OR REPLACE FUNCTION barber.get_barber_status(user_id_ uuid)
RETURNS TABLE(onboarding_completed boolean, is_verified boolean, is_approved boolean,
              is_active boolean, onboarding_step int, onboarding_completed_at timestamptz,
              verification_status text, is_online boolean, service_radius_km numeric,
              buffer_minutes int, service_mode text, booking_mode text,
              city text, region text, country text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT bp.onboarding_completed, bp.is_verified, bp.is_approved, bp.is_active,
           bp.onboarding_step, bp.onboarding_completed_at, bp.verification_status::text,
           bp.is_online, bp.service_radius_km, bp.buffer_minutes,
           bp.service_mode::text, bp.booking_mode::text,
           bp.city::text, bp.region::text, bp.country::text
    FROM barber_profiles bp WHERE bp.user_id = user_id_;
END $$;

-- Full own-profile row (bp.* + user fields) as one jsonb blob so new columns
-- keep flowing through without a function change.
CREATE OR REPLACE FUNCTION barber.get_barber_profile(user_id_ uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  result_ jsonb;
BEGIN
  SELECT to_jsonb(bp) || jsonb_build_object(
           'full_name', u.full_name, 'email', u.email, 'phone', u.phone, 'avatar_url', u.avatar_url)
    INTO result_
    FROM barber_profiles bp
    JOIN users u ON u.id = bp.user_id
   WHERE bp.user_id = user_id_;
  RETURN result_;
END $$;

CREATE OR REPLACE FUNCTION barber.update_barber_profile(barber_id_ uuid, shop_name_ text,
    address_text_ text, bio_ text, display_name_ text, experience_years_ int,
    service_mode_ text, booking_mode_ text, latitude_ numeric, longitude_ numeric,
    service_radius_km_ numeric, buffer_minutes_ int, is_online_ boolean,
    city_ text, region_ text, country_ text, onboarding_step_ int)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
  SELECT to_jsonb(bp) INTO result_ FROM barber_profiles bp WHERE bp.id = barber_id_;
  RETURN result_;
END $$;

CREATE OR REPLACE FUNCTION barber.set_user_avatar(user_id_ uuid, avatar_url_ text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE users u SET avatar_url = avatar_url_ WHERE u.id = user_id_;
END $$;

CREATE OR REPLACE FUNCTION barber.set_user_phone(user_id_ uuid, phone_ text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE users u SET phone = phone_ WHERE u.id = user_id_;
END $$;

CREATE OR REPLACE FUNCTION barber.set_barber_online(barber_id_ uuid, is_online_ boolean)
RETURNS TABLE(is_online boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    UPDATE barber_profiles bp SET is_online = is_online_ WHERE bp.id = barber_id_
    RETURNING bp.is_online;
END $$;

-- Replaces the whole weekly schedule atomically and returns the new week.
CREATE OR REPLACE FUNCTION barber.replace_barber_schedule(barber_id_ uuid, schedule_ jsonb)
RETURNS TABLE(id uuid, day_of_week int, start_time time, end_time time, is_available boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
    FROM barber_schedule bs WHERE bs.barber_id = barber_id_ ORDER BY bs.day_of_week;
END $$;

-- Everything the onboarding-complete gate needs in one call.
CREATE OR REPLACE FUNCTION barber.get_onboarding_check(barber_id_ uuid)
RETURNS TABLE(display_name text, bio text, shop_name text, service_count int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT bp.display_name::text, bp.bio, bp.shop_name::text,
           (SELECT COUNT(*)::int FROM services s WHERE s.barber_id = bp.id)
    FROM barber_profiles bp WHERE bp.id = barber_id_;
END $$;

CREATE OR REPLACE FUNCTION barber.complete_onboarding(barber_id_ uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  result_ jsonb;
BEGIN
  UPDATE barber_profiles bp SET
    onboarding_completed = true,
    onboarding_completed_at = NOW(),
    onboarding_step = 7
  WHERE bp.id = barber_id_;
  SELECT to_jsonb(bp) INTO result_ FROM barber_profiles bp WHERE bp.id = barber_id_;
  RETURN result_;
END $$;

CREATE OR REPLACE FUNCTION barber.add_verification_document(barber_id_ uuid, document_type_ text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO barber_verification_documents (barber_id, document_type, submitted_at)
  VALUES (barber_id_, document_type_, NOW());
END $$;

CREATE OR REPLACE FUNCTION barber.list_verification_documents(barber_id_ uuid)
RETURNS TABLE(document_type text, submitted_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT d.document_type::text, d.submitted_at
    FROM barber_verification_documents d
    WHERE d.barber_id = barber_id_ ORDER BY d.submitted_at;
END $$;

CREATE OR REPLACE FUNCTION barber.set_work_photos_count(barber_id_ uuid, count_ int)
RETURNS TABLE(id uuid, work_photos_count int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    UPDATE barber_profiles bp SET work_photos_count = count_ WHERE bp.id = barber_id_
    RETURNING bp.id, bp.work_photos_count;
END $$;

CREATE OR REPLACE FUNCTION barber.admin_verify_barber(barber_id_ uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  result_ jsonb;
BEGIN
  UPDATE barber_profiles bp SET is_verified = true WHERE bp.id = barber_id_;
  SELECT to_jsonb(bp) INTO result_ FROM barber_profiles bp WHERE bp.id = barber_id_;
  RETURN result_;
END $$;

-- ============================================================================
-- WORK PHOTOS / UPLOADS (tenant DB)
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.get_max_work_photo_sort(barber_id_ uuid)
RETURNS TABLE(max int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT COALESCE(MAX(w.sort_order), -1)::int
    FROM barber_work_photos w WHERE w.barber_id = barber_id_;
END $$;

CREATE OR REPLACE FUNCTION barber.add_work_photo(barber_id_ uuid, storage_key_ text, url_ text,
                                                 sort_order_ int, bytes_ int, mime_type_ text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO barber_work_photos (barber_id, storage_key, url, sort_order, bytes, mime_type)
  VALUES (barber_id_, storage_key_, url_, sort_order_, bytes_, mime_type_);
END $$;

-- Re-denormalises barber_profiles.work_photos (+count) from the relational rows.
CREATE OR REPLACE FUNCTION barber.sync_work_photos(barber_id_ uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  urls_ jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(w.url ORDER BY w.sort_order ASC, w.created_at ASC), '[]'::jsonb)
    INTO urls_
    FROM barber_work_photos w WHERE w.barber_id = barber_id_;
  UPDATE barber_profiles bp
     SET work_photos = urls_, work_photos_count = jsonb_array_length(urls_)
   WHERE bp.id = barber_id_;
END $$;

CREATE OR REPLACE FUNCTION barber.list_work_photos(barber_id_ uuid)
RETURNS TABLE(id uuid, url text, storage_key text, sort_order int, caption text,
              bytes int, mime_type text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT w.id, w.url, w.storage_key, w.sort_order, w.caption, w.bytes,
           w.mime_type::text, w.created_at
    FROM barber_work_photos w
    WHERE w.barber_id = barber_id_
    ORDER BY w.sort_order ASC, w.created_at ASC;
END $$;

CREATE OR REPLACE FUNCTION barber.delete_work_photo(photo_id_ uuid, barber_id_ uuid)
RETURNS TABLE(storage_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    DELETE FROM barber_work_photos w WHERE w.id = photo_id_ AND w.barber_id = barber_id_
    RETURNING w.storage_key;
END $$;

CREATE OR REPLACE FUNCTION barber.get_work_photo_ids(barber_id_ uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT w.id FROM barber_work_photos w WHERE w.barber_id = barber_id_;
END $$;

CREATE OR REPLACE FUNCTION barber.set_work_photo_order(photo_id_ uuid, barber_id_ uuid, sort_order_ int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE barber_work_photos w SET sort_order = sort_order_
  WHERE w.id = photo_id_ AND w.barber_id = barber_id_;
END $$;

-- ============================================================================
-- ISSUE REPORTS + AUDIT (admin DB)
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.create_issue_report(tenant_id_ text, reporter_user_id_ text,
                                                      reported_type_ text, comments_ text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  result_ jsonb;
BEGIN
  INSERT INTO issue_reports (tenant_id, reporter_user_id, reported_type, comments)
  VALUES (tenant_id_, reporter_user_id_, reported_type_, comments_)
  RETURNING to_jsonb(issue_reports.*) INTO result_;
  RETURN result_;
END $$;

CREATE OR REPLACE FUNCTION barber.write_audit_log(admin_user_id_ text, action_ text,
    resource_type_ text, resource_id_ text, changes_ jsonb, ip_address_ text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO audit_log (admin_user_id, action, resource_type, resource_id, changes, ip_address)
  VALUES (admin_user_id_, action_, resource_type_, resource_id_, changes_, ip_address_);
END $$;

-- ============================================================================
-- ACCOUNT DELETION (tenant DB) — the whole guarded transaction in one function.
-- statuscode_ 200 = deleted, 404 = not found, 409 = active bookings remain.
-- ============================================================================

CREATE OR REPLACE FUNCTION barber.delete_account(user_id_ uuid)
RETURNS TABLE(statuscode_ int, statusmsg_ text, deleted_ boolean, active_bookings_ int,
              role_ text, barber_profile_id_ uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  user_role_ text;
  profile_id_ uuid;
  active_ int := 0;
BEGIN
  SELECT u.role::text INTO user_role_ FROM users u WHERE u.id = user_id_ FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 404, 'Account not found'::text, false, 0, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT bp.id INTO profile_id_ FROM barber_profiles bp WHERE bp.user_id = user_id_;

  IF profile_id_ IS NOT NULL THEN
    SELECT COUNT(*)::int INTO active_ FROM bookings b
     WHERE (b.customer_id = user_id_ OR b.barber_id = profile_id_)
       AND b.status IN ('pending','confirmed');
  ELSE
    SELECT COUNT(*)::int INTO active_ FROM bookings b
     WHERE b.customer_id = user_id_ AND b.status IN ('pending','confirmed');
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
END $$;

-- ============================================================================
-- GRANTS — app connects as barber_app (never postgres) and can ONLY execute.
-- ============================================================================

GRANT USAGE ON SCHEMA barber TO barber_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA barber TO barber_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA barber GRANT EXECUTE ON FUNCTIONS TO barber_app;
