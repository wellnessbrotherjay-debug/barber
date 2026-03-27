import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { User, BarberProfile, Booking } from '@/types';
import { MOCK_BARBERS, MOCK_BOOKINGS } from '@/constants/mockData';

const IS_MOCK = 
  !import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.VITE_SUPABASE_URL.includes('placeholder') ||
  import.meta.env.VITE_SUPABASE_URL.includes('your-project');

if (IS_MOCK) {
  console.log('🚀 App running in MOCK mode with local data');
}

export const authService = {
  async getCurrentUser(): Promise<User | null> {
    if (IS_MOCK) return useAuthStore.getState().user;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    return profile as User;
  },

  async signOut() {
    if (!IS_MOCK) await supabase.auth.signOut();
    useAuthStore.getState().logout();
  }
};

export const barberService = {
  async getBarbers(): Promise<BarberProfile[]> {
    if (IS_MOCK) return MOCK_BARBERS;

    const { data, error } = await supabase
      .from('barber_profiles')
      .select('*, users(full_name, avatar_url)')
      .eq('is_active', true)
      .eq('is_approved', true);
    
    if (error) {
      console.warn('Supabase fetch failed, falling back to mock data:', error);
      return MOCK_BARBERS;
    }
    
    if (!data || data.length === 0) {
      console.log('Supabase returned empty, showing mock data for demo');
      return MOCK_BARBERS;
    }

    return data as BarberProfile[];
  },

  async getBarberDetail(id: string): Promise<BarberProfile> {
    if (IS_MOCK) {
      const barber = MOCK_BARBERS.find(b => b.id === id);
      if (!barber) throw new Error('Barber not found');
      return barber;
    }

    const { data, error } = await supabase
      .from('barber_profiles')
      .select('*, users(full_name, avatar_url), services(*)')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      console.warn('Barber detail fetch failed, using mock data');
      return MOCK_BARBERS.find(b => b.id === id) || MOCK_BARBERS[0];
    }
    
    return data as BarberProfile;
  }
};

export const bookingService = {
  async getCustomerBookings(customerId: string): Promise<Booking[]> {
    if (IS_MOCK) return MOCK_BOOKINGS;

    const { data, error } = await supabase
      .from('bookings')
      .select('*, barber_profiles(display_name, shop_name), services(name)')
      .eq('customer_id', customerId)
      .order('booking_date', { ascending: false });
    
    if (error || !data || data.length === 0) {
      console.warn('Bookings fetch failed or empty, using mock data');
      return MOCK_BOOKINGS;
    }
    
    return data as Booking[];
  },

  async createBooking(bookingData: any): Promise<Booking> {
    if (IS_MOCK) {
      const newBooking = {
        ...bookingData,
        id: Math.random().toString(36).substring(2, 9),
        barber_profiles: MOCK_BARBERS.find(b => b.id === bookingData.barber_id),
        services: MOCK_BARBERS.find(b => b.id === bookingData.barber_id)?.services?.find(s => s.id === bookingData.service_id)
      };
      MOCK_BOOKINGS.unshift(newBooking);
      return newBooking as Booking;
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert([bookingData])
      .select()
      .single();
    
    if (error) throw error;
    return data as Booking;
  }
};
