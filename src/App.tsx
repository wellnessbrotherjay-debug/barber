import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

import Splash from '@/features/onboarding/Splash';
import RoleSelect from '@/features/onboarding/RoleSelect';
import Login from '@/features/auth/Login';
import BrowseBarbers from '@/features/customer/BrowseBarbers';

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

          <Route
            path="/customer"
            element={
              <RequireRole role="customer">
                <BrowseBarbers />
              </RequireRole>
            }
          />
          <Route
            path="/customer/*"
            element={
              <RequireRole role="customer">
                <BrowseBarbers />
              </RequireRole>
            }
          />

          <Route
            path="/barber/*"
            element={
              <RequireRole role="barber">
                <div className="p-6 pt-16 text-[#1c1b1f]">Barber Home (building next)</div>
              </RequireRole>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
