/**
 * BarberSync Database Schema (PostgreSQL / Supabase)
 * 
 * Run this in your Supabase SQL Editor to set up the database.
 */

/*
-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('customer', 'barber', 'admin');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- 2. TABLES

-- Users table (extends Supabase Auth)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role user_role DEFAULT 'customer' NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Profiles
CREATE TABLE public.customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  default_location_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Barber Profiles
CREATE TABLE public.barber_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  experience_years INTEGER,
  rating_avg DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  shop_name TEXT,
  address_text TEXT,
  lat DECIMAL(9,6),
  lng DECIMAL(9,6),
  is_verified BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Service Categories
CREATE TABLE public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Services
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID REFERENCES public.barber_profiles(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Barber Availability
CREATE TABLE public.barber_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID REFERENCES public.barber_profiles(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  UNIQUE(barber_id, day_of_week)
);

-- Blocked Slots
CREATE TABLE public.blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID REFERENCES public.barber_profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT
);

-- Bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.users(id) NOT NULL,
  barber_id UUID REFERENCES public.barber_profiles(id) NOT NULL,
  service_id UUID REFERENCES public.services(id) NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status booking_status DEFAULT 'pending' NOT NULL,
  payment_status payment_status DEFAULT 'pending' NOT NULL,
  payment_method TEXT DEFAULT 'pay_at_shop',
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  cancelled_by UUID REFERENCES public.users(id),
  cancellation_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.users(id) NOT NULL,
  barber_id UUID REFERENCES public.barber_profiles(id) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id)
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data_json JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Favorite Barbers
CREATE TABLE public.favorite_barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  barber_id UUID REFERENCES public.barber_profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, barber_id)
);

-- 3. RLS POLICIES (Row Level Security)

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Users: Anyone can read public info, only self can update
CREATE POLICY "Public profiles are viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Barber Profiles: Anyone can view, only owner can update
CREATE POLICY "Barber profiles are viewable by everyone" ON public.barber_profiles FOR SELECT USING (true);
CREATE POLICY "Barbers can update own profile" ON public.barber_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Bookings: Customers and Barbers can see their own
CREATE POLICY "Users can view their own bookings" ON public.bookings FOR SELECT USING (
  auth.uid() = customer_id OR 
  auth.uid() IN (SELECT user_id FROM public.barber_profiles WHERE id = barber_id)
);

-- 4. FUNCTIONS & TRIGGERS

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_barber_profiles_updated_at BEFORE UPDATE ON public.barber_profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
*/
