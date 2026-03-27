import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { bookingService } from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Calendar, Clock, MapPin, Scissors, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Booking } from '@/types';

export default function BookingHistory() {
  const { user } = useAuthStore();
  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ['bookings', user?.id],
    queryFn: () => bookingService.getCustomerBookings(user!.id),
    enabled: !!user?.id,
  });

  if (isLoading) return <div className="p-8 text-center">Loading bookings...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Your Appointments</h2>
        <div className="flex p-1 bg-stone-100 rounded-xl">
          <button className="px-4 py-2 bg-white rounded-lg text-sm font-bold shadow-sm">Upcoming</button>
          <button className="px-4 py-2 text-sm font-bold text-neutral-500">Past</button>
        </div>
      </div>

      {!bookings || bookings.length === 0 ? (
        <div className="bg-white p-12 rounded-[2.5rem] border border-stone-100 text-center space-y-4">
          <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto">
            <Calendar className="w-10 h-10 text-stone-200" />
          </div>
          <div>
            <h3 className="text-xl font-bold">No bookings yet</h3>
            <p className="text-neutral-500">Your scheduled appointments will appear here.</p>
          </div>
          <button className="btn-primary">Find a Barber</button>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking: any) => (
            <div 
              key={booking.id}
              className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-14 h-14 bg-stone-100 rounded-2xl flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">{format(new Date(booking.booking_date), 'MMM')}</span>
                    <span className="text-xl font-bold text-primary leading-none">{format(new Date(booking.booking_date), 'd')}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{booking.barber_profiles.display_name}</h4>
                    <p className="text-sm text-neutral-500">{booking.services.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    booking.status === 'confirmed' ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"
                  )}>
                    {booking.status}
                  </span>
                  <p className="text-lg font-bold mt-2">${booking.total_amount}</p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-stone-50 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <Clock className="w-4 h-4 text-accent" />
                    {booking.start_time}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <MapPin className="w-4 h-4 text-accent" />
                    {booking.barber_profiles.shop_name}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-primary transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
