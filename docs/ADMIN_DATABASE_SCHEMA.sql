-- Barber App Admin Database (barber_app)
-- Shared database for all tenants - manages companies, API keys, subscriptions

-- Companies (Tenants)
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_email VARCHAR(255) NOT NULL UNIQUE,
  api_key UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  subscription_tier VARCHAR(50) NOT NULL DEFAULT 'starter',
  max_barbers INTEGER DEFAULT 10,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_companies_api_key ON companies(api_key);
CREATE INDEX idx_companies_status ON companies(status);

-- API Key Usage Log (for monitoring and rate limiting)
CREATE TABLE IF NOT EXISTS api_key_usage (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  response_time_ms INTEGER,
  user_agent VARCHAR(255),
  ip_address VARCHAR(45),
  error_message TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_key_usage_company ON api_key_usage(company_id);
CREATE INDEX idx_api_key_usage_timestamp ON api_key_usage(timestamp DESC);

-- Company Entitlements (Feature Gating)
CREATE TABLE IF NOT EXISTS company_entitlements (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  feature VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, feature)
);

-- Default features for each tier
-- starter: basic_booking, basic_reviews, 1_barber
-- pro: custom_branding, api_access, advanced_reports, 5_barbers, team_management
-- enterprise: all_features, 100_barbers, dedicated_support, sso_integration

-- Company Subscription
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id),
  tier VARCHAR(50) NOT NULL DEFAULT 'starter',
  billing_email VARCHAR(255),
  payment_method VARCHAR(50),
  renewal_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Global Settings (Owner/Admin Dashboard)
CREATE TABLE IF NOT EXISTS admin_settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit Log (all admin actions)
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id VARCHAR(255),
  action VARCHAR(100),
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  changes JSONB,
  ip_address VARCHAR(45),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_admin ON audit_log(admin_user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);

-- Booking Metrics (Denormalized for fast reporting)
CREATE TABLE IF NOT EXISTS booking_metrics (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  metric_date DATE NOT NULL,
  total_bookings INTEGER DEFAULT 0,
  completed_bookings INTEGER DEFAULT 0,
  canceled_bookings INTEGER DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  average_rating DECIMAL(3, 2),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, metric_date)
);

CREATE INDEX idx_booking_metrics_company ON booking_metrics(company_id);
CREATE INDEX idx_booking_metrics_date ON booking_metrics(metric_date DESC);

-- Seed data

-- Default admin settings
INSERT INTO admin_settings (key, value) VALUES
  ('platform_name', 'BarberSync'),
  ('support_email', 'support@safetykat.com'),
  ('max_free_barbers', '1'),
  ('payment_processing_fee_percent', '2.9'),
  ('payment_processing_fee_fixed', '0.30')
ON CONFLICT (key) DO NOTHING;

-- Sample company (for testing)
INSERT INTO companies (name, owner_email, api_key, subscription_tier, status)
VALUES
  ('Demo Barbershop', 'demo@example.com', gen_random_uuid(), 'pro', 'active')
ON CONFLICT (owner_email) DO NOTHING;

-- Entitlements for demo company
WITH demo_company AS (
  SELECT id FROM companies WHERE owner_email = 'demo@example.com' LIMIT 1
)
INSERT INTO company_entitlements (company_id, feature, enabled)
SELECT demo_company.id, feature, true
FROM (VALUES
  ('basic_booking'),
  ('basic_reviews'),
  ('custom_branding'),
  ('api_access'),
  ('advanced_reports'),
  ('team_management')
) AS features(feature)
CROSS JOIN demo_company
ON CONFLICT (company_id, feature) DO NOTHING;

-- Create a trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_entitlements_updated_at BEFORE UPDATE ON company_entitlements
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_subscriptions_updated_at BEFORE UPDATE ON company_subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for easy reporting
CREATE OR REPLACE VIEW company_overview AS
SELECT
  c.id,
  c.name,
  c.owner_email,
  c.subscription_tier,
  c.status,
  s.renewal_date,
  COUNT(DISTINCT u.id) as total_barbers,
  COALESCE(SUM(bm.total_bookings), 0) as total_bookings,
  COALESCE(SUM(bm.total_revenue), 0) as total_revenue,
  COALESCE(AVG(bm.average_rating), 0) as average_rating,
  c.created_at
FROM companies c
LEFT JOIN company_subscriptions s ON c.id = s.company_id
LEFT JOIN (SELECT company_id, COUNT(id) as id FROM companies GROUP BY company_id) u ON c.id = u.company_id
LEFT JOIN booking_metrics bm ON c.id = bm.company_id
GROUP BY c.id, c.name, c.owner_email, c.subscription_tier, c.status, s.renewal_date, c.created_at;
