import { useEffect, useState } from 'react';
import { authFetch } from './api';
import { useAuthStore } from '../store/useAuthStore';

/**
 * One booking, by its id, for the signed-in customer.
 *
 * WHY THIS EXISTS
 *   Five screens each declared the same booking state and then wrote out the
 *   same fetch to get it: ask for the customer's bookings, find the one whose id
 *   is in the address, and set it — with the same cancellation flag so a screen
 *   that has already gone does not set state. Five copies of one idea is five
 *   places to fix when the way a booking is fetched changes, and four of them
 *   will be missed.
 *
 * The endpoint returns only the bookings belonging to the signed-in customer —
 * the server resolves them from the token — so asking for one by id here can
 * never reach somebody else's.
 *
 * Each screen has its own shape for the parts of a booking it cares about, so
 * the shape is the caller's to name.
 */
export function useBooking<T extends { id: string }>(bookingId: string | undefined) {
  const user = useAuthStore((s) => s.user);
  const [booking, setBooking] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !bookingId) return;
    let cancelled = false;
    authFetch('/api/bookings')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: T[]) => {
        if (!cancelled) setBooking(data.find((b) => b.id === bookingId) || null);
      })
      .catch((err) => {
        // An error nobody is told about is one you hear about from a customer.
        console.error('[useBooking] could not load the booking:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, user?.id]);

  return { booking, loading, setBooking };
}
