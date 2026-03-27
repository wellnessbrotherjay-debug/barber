import { 
  addMinutes, 
  format, 
  parse, 
  isBefore, 
  startOfDay, 
  addDays, 
  eachDayOfInterval,
  setHours,
  setMinutes,
  isEqual
} from 'date-fns';

export interface TimeSlot {
  start: string; // HH:mm
  end: string;   // HH:mm
  available: boolean;
}

/**
 * Generates time slots for a given day based on barber availability and existing bookings.
 */
export function generateTimeSlots(
  date: Date,
  startTime: string, // "09:00"
  endTime: string,   // "18:00"
  durationMinutes: number,
  existingBookings: { start_time: string; end_time: string }[] = []
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  
  let current = parse(startTime, 'HH:mm', date);
  const end = parse(endTime, 'HH:mm', date);

  while (isBefore(current, end)) {
    const slotEnd = addMinutes(current, durationMinutes);
    if (!isBefore(slotEnd, end) && !isEqual(slotEnd, end)) break;

    const slotStartStr = format(current, 'HH:mm');
    const slotEndStr = format(slotEnd, 'HH:mm');

    // Check for overlaps with existing bookings
    const isBooked = existingBookings.some(booking => {
      const bStart = booking.start_time;
      const bEnd = booking.end_time;
      
      // Overlap logic: (StartA < EndB) and (EndA > StartB)
      return (slotStartStr < bEnd) && (slotEndStr > bStart);
    });

    slots.push({
      start: slotStartStr,
      end: slotEndStr,
      available: !isBooked
    });

    // Move to next slot (could be current + duration or current + 30 mins for more granularity)
    current = addMinutes(current, 30); 
  }

  return slots;
}
