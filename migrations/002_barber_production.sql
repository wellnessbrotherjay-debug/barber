-- 002_barber_production.sql
-- Production barber onboarding: location/radius/availability/verification fields,
-- relational work photos, and geospatial discovery.
--
-- Idempotent: safe to re-run, and applied to both the live tenant DB
-- (foundation_barber_1) and barber_app_template so new tenants inherit it.
--
-- Tenancy note: physical isolation is PER TENANT (one DB per company,
-- foundation_barber_<tenant_id>). Barbers are ROWS inside that DB, owned via
-- barber_profiles.user_id -> users.id. There is deliberately no database per
-- barber. Ownership on every barber-scoped table resolves through barber_id.

CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- ---------------------------------------------------------------------------
-- barber_profiles: fields the Figma onboarding collects but had nowhere to live
-- ---------------------------------------------------------------------------
ALTER TABLE barber_profiles
  ADD COLUMN IF NOT EXISTS service_radius_km numeric(6,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS buffer_minutes    integer      NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS is_online         boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS city              varchar(160),
  ADD COLUMN IF NOT EXISTS region            varchar(160),
  ADD COLUMN IF NOT EXISTS country           varchar(120),
  -- Figma step 3 shows pending / in review / approved / rejected. The legacy
  -- is_verified/is_approved booleans stay authoritative for existing code;
  -- this column carries the richer state the UI needs.
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unsubmitted',
  -- Resume support: which onboarding step (1-7) the barber should land on.
  ADD COLUMN IF NOT EXISTS onboarding_step   integer      NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

DO $$ BEGIN
  ALTER TABLE barber_profiles
    ADD CONSTRAINT barber_profiles_verification_status_check
    CHECK (verification_status IN ('unsubmitted','pending','in_review','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE barber_profiles
    ADD CONSTRAINT barber_profiles_service_mode_check
    CHECK (service_mode IN ('in_shop','mobile','both'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE barber_profiles
    ADD CONSTRAINT barber_profiles_onboarding_step_check
    CHECK (onboarding_step BETWEEN 1 AND 7);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill verification_status from the legacy booleans so existing rows are
-- consistent the moment the new column goes live.
UPDATE barber_profiles
   SET verification_status = CASE
         WHEN is_verified OR is_approved THEN 'approved'
         ELSE verification_status
       END
 WHERE verification_status = 'unsubmitted' AND (is_verified OR is_approved);

UPDATE barber_profiles
   SET onboarding_step = 7,
       onboarding_completed_at = COALESCE(onboarding_completed_at, updated_at)
 WHERE onboarding_completed = true AND onboarding_completed_at IS NULL;

-- ---------------------------------------------------------------------------
-- barber_work_photos: relational gallery (ordering, captions, deletion,
-- storage keys). barber_profiles.work_photos jsonb is retained and kept in
-- sync by the API as a read-optimised denormalisation for the public profile
-- endpoints, so existing gallery/lightbox code keeps working unchanged.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS barber_work_photos (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  barber_id   uuid NOT NULL REFERENCES barber_profiles(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  url         text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  caption     text,
  bytes       integer,
  mime_type   varchar(80),
  created_at  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_barber_work_photos_barber
  ON barber_work_photos (barber_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_barber_work_photos_storage_key
  ON barber_work_photos (storage_key);

-- ---------------------------------------------------------------------------
-- Discovery indexes. Query pattern is:
--   WHERE is_active AND is_online AND verification_status='approved'
--     AND earth_box(customer, radius) @> ll_to_earth(lat,lng)
--   ORDER BY earth_distance(...)
-- so we need a GiST index on the earth point plus a partial btree on the
-- boolean discovery filters.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_barber_profiles_earth
  ON barber_profiles USING gist (ll_to_earth(latitude::float8, longitude::float8))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_barber_profiles_discoverable
  ON barber_profiles (is_active, is_online, verification_status)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_barber_profiles_created_at
  ON barber_profiles (created_at DESC);

-- Services are listed per barber constantly; the existing idx_services_barber_id
-- covers it, but active-only listing benefits from a composite.
CREATE INDEX IF NOT EXISTS idx_services_barber_active
  ON services (barber_id, is_active);
