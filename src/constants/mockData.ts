import { User, BarberProfile, Service, Booking, ServiceCategory } from '@/types';

export const MOCK_CATEGORIES: ServiceCategory[] = [
  { id: 'cat1', name: 'Haircuts', icon: 'Scissors', is_active: true },
  { id: 'cat2', name: 'Beard & Shave', icon: 'User', is_active: true },
  { id: 'cat3', name: 'Treatments', icon: 'Sparkles', is_active: true },
  { id: 'cat4', name: 'Coloring', icon: 'Palette', is_active: true },
];

export const MOCK_BARBERS: BarberProfile[] = [
  {
    id: 'b1',
    user_id: 'u2',
    display_name: 'Marcus "The Blade" Thorne',
    bio: 'Master barber with 15 years of experience specializing in classic fades and straight razor shaves. Winner of the 2023 City Style Awards.',
    experience_years: 15,
    rating_avg: 4.9,
    rating_count: 128,
    shop_name: 'Elite Cuts Studio',
    address_text: '123 Main St, Downtown',
    lat: 40.7128,
    lng: -74.0060,
    is_verified: true,
    is_approved: true,
    is_active: true,
    users: {
      full_name: 'Marcus Thorne',
      avatar_url: 'https://i.pravatar.cc/150?u=marcus'
    },
    services: [
      { id: 's1', barber_id: 'b1', name: 'Signature Fade', duration_minutes: 45, price: 45, currency: 'USD', is_active: true, description: 'Precision fade with hot towel finish' },
      { id: 's2', barber_id: 'b1', name: 'Beard Sculpting', duration_minutes: 30, price: 25, currency: 'USD', is_active: true, description: 'Shape and trim with premium oils' },
      { id: 's3', barber_id: 'b1', name: 'The Royal Treatment', duration_minutes: 90, price: 85, currency: 'USD', is_active: true, description: 'Haircut, shave, and facial massage' }
    ]
  },
  {
    id: 'b2',
    user_id: 'u3',
    display_name: 'Elena Rodriguez',
    bio: 'Specializing in modern textures and creative styling. I bring a fresh perspective to traditional barbering.',
    experience_years: 8,
    rating_avg: 4.8,
    rating_count: 94,
    shop_name: 'Urban Edge Barbers',
    address_text: '456 West End Ave, Uptown',
    lat: 40.7831,
    lng: -73.9712,
    is_verified: true,
    is_approved: true,
    is_active: true,
    users: {
      full_name: 'Elena Rodriguez',
      avatar_url: 'https://i.pravatar.cc/150?u=elena'
    },
    services: [
      { id: 's4', barber_id: 'b2', name: 'Modern Texture Cut', duration_minutes: 40, price: 35, currency: 'USD', is_active: true, description: 'Scissor cut with textured finish' },
      { id: 's5', barber_id: 'b2', name: 'Buzz Cut & Lineup', duration_minutes: 20, price: 20, currency: 'USD', is_active: true, description: 'Clean buzz with sharp edges' }
    ]
  },
  {
    id: 'b3',
    user_id: 'u4',
    display_name: 'Sam "Old School" Jenkins',
    bio: 'Traditional barbering at its finest. If you want a cut that never goes out of style, I am your man.',
    experience_years: 25,
    rating_avg: 5.0,
    rating_count: 210,
    shop_name: 'Heritage Barbershop',
    address_text: '789 Oak Lane, East Side',
    lat: 40.7282,
    lng: -73.7949,
    is_verified: true,
    is_approved: true,
    is_active: true,
    users: {
      full_name: 'Sam Jenkins',
      avatar_url: 'https://i.pravatar.cc/150?u=sam'
    },
    services: [
      { id: 's6', barber_id: 'b3', name: 'Classic Scissor Cut', duration_minutes: 50, price: 50, currency: 'USD', is_active: true, description: 'Traditional hand-cut style' },
      { id: 's7', barber_id: 'b3', name: 'Hot Towel Shave', duration_minutes: 45, price: 40, currency: 'USD', is_active: true, description: 'Relaxing straight razor shave' }
    ]
  }
];

export const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'bk1',
    booking_reference: 'BS-A1B2C3',
    customer_id: '123',
    barber_id: 'b1',
    service_id: 's1',
    booking_date: '2026-03-28',
    start_time: '14:00',
    end_time: '14:45',
    status: 'confirmed',
    payment_status: 'pending',
    payment_method: 'pay_at_shop',
    total_amount: 45,
    currency: 'USD',
    barber_profiles: MOCK_BARBERS[0],
    services: MOCK_BARBERS[0].services![0]
  },
  {
    id: 'bk2',
    booking_reference: 'BS-D4E5F6',
    customer_id: '123',
    barber_id: 'b2',
    service_id: 's4',
    booking_date: '2026-03-20',
    start_time: '10:00',
    end_time: '10:40',
    status: 'completed',
    payment_status: 'paid',
    payment_method: 'pay_at_shop',
    total_amount: 35,
    currency: 'USD',
    barber_profiles: MOCK_BARBERS[1],
    services: MOCK_BARBERS[1].services![0]
  }
];
