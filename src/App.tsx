import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

import Splash from '@/features/onboarding/Splash';
import RoleSelect from '@/features/onboarding/RoleSelect';
import Login from '@/features/auth/Login';

export default function App() {
  const { user } = useAuthStore();

  return (
    <div className="app-shell">
      <div className="app-frame">
        <Routes>
          {/* Onboarding */}
          <Route path="/" element={<Splash />} />
          <Route path="/welcome" element={<RoleSelect />} />
          <Route path="/login" element={<Login />} />

          {/* Authenticated placeholders – built next */}
          <Route
            path="/customer/*"
            element={user?.role === 'customer' ? <div className="p-6">Customer Home (coming next)</div> : <Navigate to="/welcome" />}
          />
          <Route
            path="/barber/*"
            element={user?.role === 'barber' ? <div className="p-6">Barber Home (coming next)</div> : <Navigate to="/welcome" />}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
