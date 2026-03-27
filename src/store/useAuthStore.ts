import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'customer' | 'barber' | 'admin';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
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
      logout: () => set({ user: null, session: null }),
    }),
    {
      name: 'barbersync-auth',
    }
  )
);
