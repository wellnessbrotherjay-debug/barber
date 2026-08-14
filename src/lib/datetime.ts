// Shared booking date/time formatting.
//
// The API returns booking_date as an ISO timestamp and start_time as "HH:MM:SS".
// Several screens were printing those raw ("2026-08-11T14:00:00.000Z 18:30:00").
// The board renders them as "Tue, 6:30 PM" / "Tuesday, Oct 24 • 10:00 AM".

export function formatTime(value: string): string {
  const [h, m] = (value || '').split(':');
  const hour = Number(h);
  if (!Number.isFinite(hour)) return value || '';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m ?? '00'} ${suffix}`;
}

/** "Tue, 6:30 PM" — the board's booking-card format. */
export function formatShortDateTime(dateValue: string, timeValue: string): string {
  const d = new Date(dateValue);
  const day = Number.isNaN(d.getTime())
    ? dateValue
    : d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${day}, ${formatTime(timeValue)}`;
}

/** "Tuesday, Oct 24" — the board's confirmation format. */
export function formatLongDate(dateValue: string): string {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return dateValue;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
