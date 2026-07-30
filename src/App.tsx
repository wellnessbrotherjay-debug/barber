import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

import Splash from '@/features/onboarding/Splash';
import RoleSelect from '@/features/onboarding/RoleSelect';
import Login from '@/features/auth/Login';

// Customer
import BrowseBarbers from '@/features/customer/BrowseBarbers';
import BarberProfile from '@/features/customer/BarberProfile';
import BookingRequest from '@/features/customer/BookingRequest';
import BookingSent from '@/features/customer/BookingSent';
import BookingHistory from '@/features/customer/BookingHistory';
import PayFee from '@/features/customer/PayFee';
import CustomerProfile from '@/features/customer/CustomerProfile';
import CustomerNotifications from '@/features/customer/CustomerNotifications';
import RateBarber from '@/features/customer/RateBarber';

// Barber
import BarberJobs from '@/features/barber/BarberJobs';
import JobDetail from '@/features/barber/JobDetail';
import AcceptBooking from '@/features/barber/AcceptBooking';
import BarberWallet from '@/features/barber/BarberWallet';
import BarberReviews from '@/features/barber/BarberReviews';
import BarberPerformance from '@/features/barber/BarberPerformance';
import BarberProfileEdit from '@/features/barber/BarberProfileEdit';
import BarberServices from '@/features/barber/BarberServices';
import BarberAvailability from '@/features/barber/BarberAvailability';

function RequireRole({ role, children }: { role: 'customer' | 'barber'; children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user || user.role !== role) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="app-shell">
      <div className="app-frame">
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/welcome" element={<RoleSelect />} />
          <Route path="/login" element={<Login />} />

          {/* Customer */}
          <Route path="/customer" element={<RequireRole role="customer"><BrowseBarbers /></RequireRole>} />
          <Route path="/customer/barber/:id" element={<RequireRole role="customer"><BarberProfile /></RequireRole>} />
          <Route path="/customer/book/:id" element={<RequireRole role="customer"><BookingRequest /></RequireRole>} />
          <Route path="/customer/booking-sent" element={<RequireRole role="customer"><BookingSent /></RequireRole>} />
          <Route path="/customer/pay/:id" element={<RequireRole role="customer"><PayFee /></RequireRole>} />
          <Route path="/customer/bookings" element={<RequireRole role="customer"><BookingHistory /></RequireRole>} />
          <Route path="/customer/notifications" element={<RequireRole role="customer"><CustomerNotifications /></RequireRole>} />
          <Route path="/customer/profile" element={<RequireRole role="customer"><CustomerProfile /></RequireRole>} />
          <Route path="/customer/rate/:id" element={<RequireRole role="customer"><RateBarber /></RequireRole>} />

          {/* Barber */}
          <Route path="/barber" element={<RequireRole role="barber"><BarberJobs tab="incoming" /></RequireRole>} />
          <Route path="/barber/jobs/incoming" element={<RequireRole role="barber"><BarberJobs tab="incoming" /></RequireRole>} />
          <Route path="/barber/jobs/upcoming" element={<RequireRole role="barber"><BarberJobs tab="upcoming" /></RequireRole>} />
          <Route path="/barber/jobs/past" element={<RequireRole role="barber"><BarberJobs tab="past" /></RequireRole>} />
          <Route path="/barber/job/:id" element={<RequireRole role="barber"><JobDetail /></RequireRole>} />
          <Route path="/barber/accept/:id" element={<RequireRole role="barber"><AcceptBooking /></RequireRole>} />
          <Route path="/barber/wallet" element={<RequireRole role="barber"><BarberWallet /></RequireRole>} />
          <Route path="/barber/reviews" element={<RequireRole role="barber"><BarberReviews /></RequireRole>} />
          <Route path="/barber/performance" element={<RequireRole role="barber"><BarberPerformance /></RequireRole>} />
          <Route path="/barber/profile" element={<RequireRole role="barber"><BarberProfileEdit /></RequireRole>} />
          <Route path="/barber/services" element={<RequireRole role="barber"><BarberServices /></RequireRole>} />
          <Route path="/barber/availability" element={<RequireRole role="barber"><BarberAvailability /></RequireRole>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
