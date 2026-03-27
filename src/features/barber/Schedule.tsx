import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { bookingService } from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Calendar as CalendarIcon, Clock, User, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';

export default function BarberSchedule() {
  const { user } = useAuthStore();
  
  // In a real app, we'd fetch the barber's specific bookings
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['barber-bookings', user?.id],
    queryFn: () => bookingService.getCustomerBookings(user!.id), // Reusing service for demo
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700 border-green-200';
      case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Schedule</h2>
          <p className="text-neutral-500">Manage your upcoming appointments and availability.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-stone-200 rounded-xl font-bold text-sm hover:bg-stone-50 transition-all">
            Today
          </button>
          <button className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all shadow-lg shadow-black/10">
            Add Blockout
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-stone-200 animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group by Date Logic would go here, for now a list */}
          <div className="space-y-3">
            {bookings?.map((booking) => (
              <div 
                key={booking.id}
                className="bg-white p-5 rounded-3xl border border-stone-100 shadow-sm flex items-center gap-6 group hover:border-accent/30 transition-all"
              >
                <div className="w-20 text-center space-y-1">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                    {isToday(new Date(booking.booking_date)) ? 'Today' : format(new Date(booking.booking_date), 'MMM d')}
                  </p>
                  <p className="text-lg font-black text-primary">{booking.start_time}</p>
                </div>

                <div className="h-12 w-px bg-stone-100" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-lg truncate">John Doe</h4>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                      getStatusColor(booking.status)
                    )}>
                      {booking.status}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-500 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    {booking.services?.name} • 45 mins
                  </p>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors">
                    <CheckCircle2 className="w-6 h-6" />
                  </button>
                  <button className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                    <XCircle className="w-6 h-6" />
                  </button>
                  <button className="p-2 text-neutral-400 hover:bg-stone-100 rounded-xl transition-colors">
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
