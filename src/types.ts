export type UserRole = 'customer' | 'barber' | 'admin';

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  is_active: boolean;
}

export interface BarberProfile {
  id: string;
  user_id: string;
  display_name: string;
  bio?: string;
  experience_years: number;
  rating_avg: number;
  rating_count: number;
  shop_name: string;
  address_text: string;
  lat?: number;
  lng?: number;
  is_verified: boolean;
  is_approved: boolean;
  is_active: boolean;
  users?: {
    full_name: string;
    avatar_url?: string;
  };
  services?: Service[];
}

export interface Service {
  id: string;
  barber_id: string;
  category_id?: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  currency: string;
  is_active: boolean;
}

export interface Booking {
  id: string;
  booking_reference: string;
  customer_id: string;
  barber_id: string;
  service_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method: string;
  total_amount: number;
  currency: string;
  notes?: string;
  barber_profiles?: BarberProfile;
  services?: Service;
}
