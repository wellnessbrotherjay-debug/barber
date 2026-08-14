import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearToken } from '@/lib/api';

export type UserRole = 'customer' | 'barber' | 'admin';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  onboarding_completed?: boolean;
  is_verified?: boolean;
}

interface AuthState {
  user: User | null;
  session: any | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: any | null) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isLoading: true,
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => { clearToken(); set({ user: null, session: null }); },
    }),
    {
      name: 'barbersync-auth',
    }
  )
);
