import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { authFetch, getToken } from '@/lib/api';

import Splash from '@/features/onboarding/Splash';
import RoleSelect from '@/features/onboarding/RoleSelect';
import Login from '@/features/auth/Login';
import Signup from '@/features/auth/Signup';

// Customer
import BrowseBarbers from '@/features/customer/BrowseBarbers';
import LocationPermission from '@/features/customer/LocationPermission';
import BarbersMap from '@/features/customer/BarbersMap';
import BarberProfile from '@/features/customer/BarberProfile';
import BookingRequest from '@/features/customer/BookingRequest';
import BookingSent from '@/features/customer/BookingSent';
import BookingWaiting from '@/features/customer/BookingWaiting';
import BookingConfirmed from '@/features/customer/BookingConfirmed';
import BookingRejected from '@/features/customer/BookingRejected';
import NoBarbersAvailable from '@/features/customer/NoBarbersAvailable';
import BarberArriving from '@/features/customer/BarberArriving';
import BookingHistory from '@/features/customer/BookingHistory';
import PayFee from '@/features/customer/PayFee';
import CustomerProfile from '@/features/customer/CustomerProfile';
import CustomerNotifications from '@/features/customer/CustomerNotifications';
import RateBarber from '@/features/customer/RateBarber';
import EditProfile from '@/features/customer/EditProfile';
import PaymentMethods from '@/features/customer/PaymentMethods';
import HelpSupport from '@/features/customer/HelpSupport';

// Barber
import BarberJobs from '@/features/barber/BarberJobs';
import JobDetail from '@/features/barber/JobDetail';
import AcceptBooking from '@/features/barber/AcceptBooking';
import DeclineBooking from '@/features/barber/DeclineBooking';
import CancelJob from '@/features/barber/CancelJob';
import BarberJobArriving from '@/features/barber/BarberJobArriving';
import CompleteJob from '@/features/barber/CompleteJob';
import NoShowReport from '@/features/barber/NoShowReport';
import BarberWallet from '@/features/barber/BarberWallet';
import BarberReviews from '@/features/barber/BarberReviews';
import BarberPerformance from '@/features/barber/BarberPerformance';
import BarberProfileEdit from '@/features/barber/BarberProfileEdit';
import BarberServices from '@/features/barber/BarberServices';
import BarberAvailability from '@/features/barber/BarberAvailability';
import BarberOnboarding from '@/features/barber/BarberOnboarding';
import BarberPendingVerification from '@/features/barber/BarberPendingVerification';
import ReportIssue from '@/features/barber/ReportIssue';

// Internal owner/admin & company-owner dashboards.
// There is no real admin/company-owner login flow yet (only customer/barber auth
// exists via useAuthStore) — these are internal-tool entry points, stopgaps until
// real SSO-based admin/company-owner auth is built.
import { AdminDashboard } from '@/features/admin/AdminDashboard';
import { BarberCompanyDashboard } from '@/features/barber/BarberCompanyDashboard';

// A persisted useAuthStore `user` object without a matching real JWT is a
// stale/broken session (e.g. left over from before real auth existed, or a
// token that expired) — every authFetch call would silently 401. Treat that
// as logged-out and clear it, rather than rendering a dead page.
function hasValidSession(user: unknown): boolean {
  return !!user && !!getToken();
}

function RequireRole({ role, children }: { role: 'customer' | 'barber'; children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  if (!hasValidSession(user)) {
    logout();
    return <Navigate to="/welcome" replace />;
  }
  if (user!.role !== role) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

// Gates the whole /barber/* tree (except /barber/onboarding itself) behind
// the barber's onboarding_completed / is_verified status carried on the auth
// store's user object (populated from the signup/login response — see
// src/server/index.ts POST /api/auth/signup|login). Restarting at step 1 if
// onboarding was left incomplete is an accepted simplification (no resume).
function RequireOnboardedBarber({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  if (!hasValidSession(user)) {
    logout();
    return <Navigate to="/welcome" replace />;
  }
  if (user!.role !== 'barber') return <Navigate to="/welcome" replace />;
  if (user!.onboarding_completed === false) return <Navigate to="/barber/onboarding" replace />;
  if (user!.onboarding_completed === true && user!.is_verified === false) {
    return <BarberPendingVerification />;
  }
  return <>{children}</>;
}

// TEMP: internal-tool stopgap until real admin SSO login exists. Sets the
// admin session cookie the backend's requireAdmin middleware checks for
// (src/server/middleware/tenant.ts ~line 89-90: cookie "session" containing
// "admin" + header "x-admin-role: true"). This is NOT a security boundary —
// requireAdmin is the actual gate; this route is only reachable if someone
// already knows the internal URL. Do not treat this as authentication.
function AdminDashboardEntry() {
  React.useEffect(() => {
    document.cookie = 'session=admin-owner; path=/';
  }, []);
  return <AdminDashboard />;
}

// TEMP: single-tenant demo mode until company-owner login exists. Seeds the
// demo company's API key into localStorage so BarberCompanyDashboard's
// existing Bearer-token fetch (same mechanism the rest of the app already
// uses via the demo tenant) authenticates against /api/v1/company/*.
const DEMO_COMPANY_API_KEY = '00afed7c-b585-4421-a68e-ba42b2dd7d17';
function CompanyDashboardEntry() {
  React.useEffect(() => {
    localStorage.setItem('companyApiKey', DEMO_COMPANY_API_KEY);
  }, []);
  return <BarberCompanyDashboard />;
}

// Refreshes onboarding_completed/is_verified for a persisted barber session
// on app load (e.g. reopening the app days later) via the lightweight
// GET /api/barber/status endpoint, so a stale localStorage snapshot from
// signup/login time doesn't wrongly gate/ungate the app.
function useRefreshBarberStatus() {
  const { user, setUser } = useAuthStore();
  React.useEffect(() => {
    if (!user || user.role !== 'barber') return;
    let cancelled = false;
    authFetch('/api/barber/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((status) => {
        if (!cancelled && status) {
          setUser({ ...user, onboarding_completed: status.onboarding_completed, is_verified: status.is_verified });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}

export default function App() {
  useRefreshBarberStatus();
  return (
    <div className="app-shell">
      <div className="app-frame">
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/welcome" element={<RoleSelect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Customer */}
          <Route path="/customer" element={<RequireRole role="customer"><BrowseBarbers /></RequireRole>} />
          {/* board frame 15 */}
          <Route path="/customer/map" element={<RequireRole role="customer"><BarbersMap /></RequireRole>} />
          {/* board frame 13 */}
          <Route path="/customer/location" element={<RequireRole role="customer"><LocationPermission /></RequireRole>} />
          <Route path="/customer/barber/:id" element={<RequireRole role="customer"><BarberProfile /></RequireRole>} />
          <Route path="/customer/book/:id" element={<RequireRole role="customer"><BookingRequest /></RequireRole>} />
          <Route path="/customer/booking-sent" element={<RequireRole role="customer"><BookingSent /></RequireRole>} />
          <Route path="/customer/waiting/:id" element={<RequireRole role="customer"><BookingWaiting /></RequireRole>} />
          <Route path="/customer/booking-confirmed/:id" element={<RequireRole role="customer"><BookingConfirmed /></RequireRole>} />
          <Route path="/customer/booking-rejected/:id" element={<RequireRole role="customer"><BookingRejected /></RequireRole>} />
          <Route path="/customer/arriving/:id" element={<RequireRole role="customer"><BarberArriving /></RequireRole>} />
          <Route path="/customer/no-barbers" element={<RequireRole role="customer"><NoBarbersAvailable /></RequireRole>} />
          <Route path="/customer/pay/:id" element={<RequireRole role="customer"><PayFee /></RequireRole>} />
          <Route path="/customer/bookings" element={<RequireRole role="customer"><BookingHistory /></RequireRole>} />
          <Route path="/customer/notifications" element={<RequireRole role="customer"><CustomerNotifications /></RequireRole>} />
          <Route path="/customer/profile" element={<RequireRole role="customer"><CustomerProfile /></RequireRole>} />
          <Route path="/customer/profile/edit" element={<RequireRole role="customer"><EditProfile /></RequireRole>} />
          <Route path="/customer/payment-methods" element={<RequireRole role="customer"><PaymentMethods /></RequireRole>} />
          <Route path="/customer/help" element={<RequireRole role="customer"><HelpSupport /></RequireRole>} />
          <Route path="/customer/rate/:id" element={<RequireRole role="customer"><RateBarber /></RequireRole>} />

          {/* Barber onboarding — reachable regardless of onboarding/verification status */}
          <Route path="/barber/onboarding" element={<RequireRole role="barber"><BarberOnboarding /></RequireRole>} />

          {/* Barber */}
          <Route path="/barber" element={<RequireRole role="barber"><RequireOnboardedBarber><BarberJobs tab="incoming" /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/jobs/incoming" element={<RequireRole role="barber"><RequireOnboardedBarber><BarberJobs tab="incoming" /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/jobs/upcoming" element={<RequireRole role="barber"><RequireOnboardedBarber><BarberJobs tab="upcoming" /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/jobs/past" element={<RequireRole role="barber"><RequireOnboardedBarber><BarberJobs tab="past" /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/job/:id" element={<RequireRole role="barber"><RequireOnboardedBarber><JobDetail /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/accept/:id" element={<RequireRole role="barber"><RequireOnboardedBarber><AcceptBooking /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/decline/:id" element={<RequireRole role="barber"><RequireOnboardedBarber><DeclineBooking /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/cancel/:id" element={<RequireRole role="barber"><RequireOnboardedBarber><CancelJob /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/arriving/:id" element={<RequireRole role="barber"><RequireOnboardedBarber><BarberJobArriving /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/complete/:id" element={<RequireRole role="barber"><RequireOnboardedBarber><CompleteJob /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/no-show/:id" element={<RequireRole role="barber"><RequireOnboardedBarber><NoShowReport /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/wallet" element={<RequireRole role="barber"><RequireOnboardedBarber><BarberWallet /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/reviews" element={<RequireRole role="barber"><RequireOnboardedBarber><BarberReviews /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/performance" element={<RequireRole role="barber"><RequireOnboardedBarber><BarberPerformance /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/profile" element={<RequireRole role="barber"><RequireOnboardedBarber><BarberProfileEdit /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/services" element={<RequireRole role="barber"><RequireOnboardedBarber><BarberServices /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/availability" element={<RequireRole role="barber"><RequireOnboardedBarber><BarberAvailability /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/report-issue" element={<RequireRole role="barber"><RequireOnboardedBarber><ReportIssue /></RequireOnboardedBarber></RequireRole>} />
          <Route path="/barber/help" element={<RequireRole role="barber"><RequireOnboardedBarber><HelpSupport /></RequireOnboardedBarber></RequireRole>} />

          {/* Internal owner/admin & company-owner dashboards (stopgap auth, see above).
              NOTE: the admin entry is intentionally at /owner/dashboard, not /admin/dashboard —
              the backend already owns the path /admin/dashboard as a JSON API route
              (src/server/index.ts), and the SPA catch-all explicitly excludes any path
              starting with /admin so the API route always wins there. Putting the React
              route at the same path would mean navigating to it in a browser gets the
              raw 403/JSON from requireAdmin instead of the app shell. /company/dashboard
              has no such collision (the API lives at /api/v1/company/dashboard). */}
          <Route path="/owner/dashboard" element={<AdminDashboardEntry />} />
          <Route path="/company/dashboard" element={<CompanyDashboardEntry />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
