import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { barberService, bookingService } from '@/services/api';
import { format, addDays, startOfDay, isSameDay, addMinutes, parse } from 'date-fns';
import { ChevronLeft, Calendar as CalendarIcon, Clock, CheckCircle2 } from 'lucide-react';
import { generateTimeSlots } from '@/lib/booking-engine';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function BookingFlow() {
  const { barberId, serviceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [selectedDate, setSelectedDate] = React.useState<Date>(startOfDay(new Date()));
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);

  const { data: barber } = useQuery({
    queryKey: ['barber', barberId],
    queryFn: () => barberService.getBarberDetail(barberId!),
  });

  const service = barber?.services?.find((s: any) => s.id === serviceId);

  const days = React.useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => addDays(startOfDay(new Date()), i));
  }, []);

  const slots = React.useMemo(() => {
    if (!service) return [];
    // In a real app, we'd fetch existing bookings for this date
    return generateTimeSlots(
      selectedDate,
      "09:00",
      "18:00",
      service.duration_minutes,
      [] // Mock existing bookings
    );
  }, [selectedDate, service]);

  const bookingMutation = useMutation({
    mutationFn: (bookingData: any) => bookingService.createBooking(bookingData),
    onSuccess: () => {
      toast.success('Booking confirmed!');
      navigate('/bookings');
    },
    onError: (error: any) => {
      toast.error('Failed to create booking: ' + error.message);
    }
  });

  const handleConfirm = () => {
    if (!selectedSlot || !user || !service || !barber) return;

    const startTimeDate = parse(selectedSlot, 'HH:mm', selectedDate);
    const endTimeDate = addMinutes(startTimeDate, service.duration_minutes);

    const bookingData = {
      booking_reference: `BS-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      customer_id: user.id,
      barber_id: barber.id,
      service_id: service.id,
      booking_date: format(selectedDate, 'yyyy-MM-dd'),
      start_time: selectedSlot,
      end_time: format(endTimeDate, 'HH:mm'),
      total_amount: service.price,
      status: 'confirmed',
      payment_status: 'pending',
      payment_method: 'pay_at_shop'
    };

    bookingMutation.mutate(bookingData);
  };

  if (!barber || !service) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-stone-100 rounded-full">
          <ChevronLeft />
        </button>
        <h1 className="text-2xl font-bold">Book Appointment</h1>
      </div>

      {/* Service Summary */}
      <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Service</p>
          <h3 className="text-lg font-bold">{service.name}</h3>
          <p className="text-sm text-neutral-500">{service.duration_minutes} mins • {barber.display_name}</p>
        </div>
        <p className="text-xl font-bold text-primary">${service.price}</p>
      </div>

      {/* Date Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Select Date</h3>
          <span className="text-sm text-neutral-500">{format(selectedDate, 'MMMM yyyy')}</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {days.map((date) => (
            <button
              key={date.toISOString()}
              onClick={() => {
                setSelectedDate(date);
                setSelectedSlot(null);
              }}
              className={cn(
                "flex flex-col items-center justify-center min-w-[70px] h-24 rounded-2xl transition-all border",
                isSameDay(date, selectedDate)
                  ? "bg-primary border-primary text-white shadow-lg shadow-black/10"
                  : "bg-white border-stone-100 text-neutral-600 hover:border-stone-300"
              )}
            >
              <span className="text-xs font-medium uppercase opacity-60">{format(date, 'EEE')}</span>
              <span className="text-xl font-bold">{format(date, 'd')}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Time Selection */}
      <div className="space-y-4">
        <h3 className="font-bold text-lg">Select Time</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {slots.map((slot) => (
            <button
              key={slot.start}
              disabled={!slot.available}
              onClick={() => setSelectedSlot(slot.start)}
              className={cn(
                "py-3 rounded-xl font-bold text-sm transition-all border",
                !slot.available && "opacity-30 cursor-not-allowed bg-stone-50",
                selectedSlot === slot.start
                  ? "bg-accent border-accent text-white shadow-lg shadow-accent/20"
                  : "bg-white border-stone-100 text-neutral-700 hover:border-stone-300"
              )}
            >
              {slot.start}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t md:relative md:bg-transparent md:border-none md:p-0">
        <div className="max-w-2xl mx-auto flex items-center gap-6">
          <div className="hidden md:block flex-1">
            <p className="text-sm text-neutral-500">Total Price</p>
            <p className="text-2xl font-bold">${service.price}</p>
          </div>
          <button
            disabled={!selectedSlot || bookingMutation.isPending}
            onClick={handleConfirm}
            className="flex-1 bg-primary text-white py-4 rounded-2xl font-bold text-lg hover:bg-neutral-800 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-black/10"
          >
            {bookingMutation.isPending ? 'Confirming...' : 'Confirm Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
