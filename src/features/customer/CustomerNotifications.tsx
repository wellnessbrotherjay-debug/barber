import React, { useEffect, useState } from 'react';
import CustomerNav from '@/components/CustomerNav';
import { authFetch } from '@/lib/api';

// Notifications screen (Figma: Notifications tab). Layout is verbatim from the
// locked Figma frame — a plain titled list of bordered cards. The data is now
// real: rows are written server-side on booking lifecycle events (request /
// accept / complete / cancel) and read back via GET /api/notifications, which
// is scoped to the authenticated user only. Opening this screen marks
// everything read (POST /api/notifications/read-all) so the unread state
// clears the same way the design implies.

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

// "2m ago" / "1h ago" / "Yesterday" — matching the sample copy drawn in the
// Figma frame rather than inventing a new date format.
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CustomerNotifications() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authFetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Notification[]) => {
        if (cancelled) return;
        setNotifs(Array.isArray(data) ? data : []);
        // Viewing the list marks everything read (fire-and-forget).
        if (Array.isArray(data) && data.some((n) => !n.is_read)) {
          authFetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-white pb-[88px]">
      <div className="px-5 pt-14 pb-4"><h1 className="text-[16px] font-bold">Notifications</h1></div>
      <div className="px-5 space-y-3">
        {!loading && notifs.length === 0 && (
          <p className="text-center text-sm text-[#a09cab] py-8">You're all caught up — no notifications yet</p>
        )}
        {notifs.map((n) => (
          <div key={n.id} className="border border-[#d2dbe9] rounded-xl p-4">
            <div className="flex justify-between mb-1">
              <p className="font-semibold text-sm">{n.title}</p>
              <span className="text-[10px] text-[#a09cab]">{relativeTime(n.created_at)}</span>
            </div>
            <p className="text-xs text-[#514e59]">{n.message}</p>
          </div>
        ))}
      </div>
      <CustomerNav active="notifications" />
    </div>
  );
}
