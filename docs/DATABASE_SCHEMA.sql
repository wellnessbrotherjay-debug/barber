-- Barber App Database Schema for LOKI PostgreSQL
-- Run this script to initialize the database with RLS policies

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS TABLE (Authentication & Profiles)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('customer', 'barber', 'admin')),
  avatar_url TEXT,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- BARBER PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS barber_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  bio TEXT,
  experience_years INTEGER,
  rating_avg DECIMAL(3,1) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  shop_name VARCHAR(255),
  address_text VARCHAR(500),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  is_verified BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_barber_profiles_user_id ON barber_profiles(user_id);
CREATE INDEX idx_barber_profiles_is_active ON barber_profiles(is_active);
CREATE INDEX idx_barber_profiles_location ON barber_profiles(latitude, longitude);

-- ============================================================================
-- SERVICE CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO service_categories (name, icon) VALUES
  ('Haircuts', 'Scissors'),
  ('Beard & Shave', 'User'),
  ('Treatments', 'Sparkles'),
  ('Coloring', 'Palette')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- BARBER SERVICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barber_id UUID NOT NULL REFERENCES barber_profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES service_categories(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  duration_minutes INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_services_barber_id ON services(barber_id);
CREATE INDEX idx_services_category_id ON services(category_id);
CREATE INDEX idx_services_is_active ON services(is_active);

-- ============================================================================
-- BOOKINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_reference VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES barber_profiles(id),
  service_id UUID NOT NULL REFERENCES services(id),
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded')),
  payment_method VARCHAR(50),
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_barber_id ON bookings(barber_id);
CREATE INDEX idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);

-- ============================================================================
-- REVIEWS & RATINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES barber_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_barber_id ON reviews(barber_id);
CREATE INDEX idx_reviews_customer_id ON reviews(customer_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- ============================================================================
-- PAYMENTS & TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(50) NOT NULL,
  transaction_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ============================================================================
-- BARBER AVAILABILITY / SCHEDULE
-- ============================================================================

CREATE TABLE IF NOT EXISTS barber_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barber_id UUID NOT NULL REFERENCES barber_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_barber_schedule_barber_id ON barber_schedule(barber_id);
CREATE INDEX idx_barber_schedule_day ON barber_schedule(day_of_week);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(50) NOT NULL, -- 'booking', 'payment', 'review', etc.
  related_id UUID, -- booking_id, review_id, etc.
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users: Can only view/update their own profile
CREATE POLICY "users_self_select" ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_self_update" ON users FOR UPDATE
  USING (auth.uid() = id);

-- Barber Profiles: Public read, only owner can update
CREATE POLICY "barber_profiles_public_read" ON barber_profiles FOR SELECT
  USING (is_active = true);

CREATE POLICY "barber_profiles_owner_update" ON barber_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Services: Public read (active only)
CREATE POLICY "services_public_read" ON services FOR SELECT
  USING (is_active = true);

CREATE POLICY "services_owner_write" ON services FOR INSERT, UPDATE, DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM barber_profiles WHERE id = barber_id
    )
  );

-- Bookings: Customers see their own, barbers see theirs
CREATE POLICY "bookings_customer_read" ON bookings FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "bookings_barber_read" ON bookings FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM barber_profiles WHERE id = barber_id
    )
  );

CREATE POLICY "bookings_customer_insert" ON bookings FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Reviews: Users can see reviews, only booking customer can create
CREATE POLICY "reviews_read" ON reviews FOR SELECT
  USING (true);

CREATE POLICY "reviews_insert" ON reviews FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Payments: Only relevant parties can view
CREATE POLICY "payments_customer_read" ON payments FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "payments_barber_read" ON payments FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM barber_profiles
      WHERE id IN (SELECT barber_id FROM bookings WHERE id = payments.booking_id)
    )
  );

-- Notifications: Users can only see their own
CREATE POLICY "notifications_read" ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- AUDIT TRIGGERS (track updates)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER barber_profiles_updated_at BEFORE UPDATE ON barber_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER barber_schedule_updated_at BEFORE UPDATE ON barber_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA (Demo Barbers)
-- ============================================================================

-- Create demo users
INSERT INTO users (email, full_name, role) VALUES
  ('marcus.thorne@barbers.com', 'Marcus Thorne', 'barber'),
  ('elena.rodriguez@barbers.com', 'Elena Rodriguez', 'barber'),
  ('sam.jenkins@barbers.com', 'Sam Jenkins', 'barber'),
  ('john.customer@gmail.com', 'John Customer', 'customer'),
  ('jane.customer@gmail.com', 'Jane Customer', 'customer')
ON CONFLICT (email) DO NOTHING;

-- Create barber profiles (after users exist)
INSERT INTO barber_profiles (user_id, display_name, bio, experience_years, rating_avg, shop_name, address_text)
SELECT id, 'Marcus "The Blade" Thorne', 'Master barber with 15 years of experience', 15, 4.9, 'Elite Cuts Studio', '123 Main St'
FROM users WHERE email = 'marcus.thorne@barbers.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO barber_profiles (user_id, display_name, bio, experience_years, rating_avg, shop_name, address_text)
SELECT id, 'Elena Rodriguez', 'Modern textures and creative styling', 8, 4.8, 'Urban Edge Barbers', '456 West End Ave'
FROM users WHERE email = 'elena.rodriguez@barbers.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO barber_profiles (user_id, display_name, bio, experience_years, rating_avg, shop_name, address_text)
SELECT id, 'Sam "Old School" Jenkins', 'Traditional barbering at its finest', 25, 5.0, 'Heritage Barbershop', '789 Oak Lane'
FROM users WHERE email = 'sam.jenkins@barbers.com'
ON CONFLICT (user_id) DO NOTHING;

-- Create services for first barber
INSERT INTO services (barber_id, name, description, price, duration_minutes)
SELECT id, 'Signature Fade', 'Precision fade with hot towel finish', 45, 45
FROM barber_profiles WHERE display_name = 'Marcus "The Blade" Thorne'
ON CONFLICT DO NOTHING;

INSERT INTO services (barber_id, name, description, price, duration_minutes)
SELECT id, 'Beard Sculpting', 'Shape and trim with premium oils', 25, 30
FROM barber_profiles WHERE display_name = 'Marcus "The Blade" Thorne'
ON CONFLICT DO NOTHING;
