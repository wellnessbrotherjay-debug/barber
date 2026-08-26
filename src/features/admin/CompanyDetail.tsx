import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  ChevronLeft, CalendarClock, Users, DollarSign, Settings, Star,
  ShieldCheck, ShieldAlert, Scissors, Clock, ArrowLeft,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

function adminHeaders() {
  return {
    'Authorization': `Bearer ${localStorage.getItem('adminApiKey')}`,
    'X-Admin-Role': 'true',
  };
}

// The currency belongs to the company being shown, so it is passed in and
// formatted by the platform rather than assumed to be one country's.
function money(n: string | number, currency: string) {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(v || 0);
}

function statusBadge(status: string) {
  return (
    <Badge variant={status === 'active' ? 'success' : status === 'suspended' ? 'error' : 'warning'}>
      {status}
    </Badge>
  );
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Company {
  id: number;
  name: string;
  owner_email: string;
  subscription_tier: string;
  status: string;
  max_barbers: number;
  created_at: string;
  renewal_date?: string | null;
}

interface CompanyDetailData extends Company {
  api_key: string;
}

interface TenantBooking {
  id: string;
  booking_reference: string;
  booking_date: string;
  start_time: string;
  end_time?: string;
  status: string;
  payment_status: string;
  total_amount: string | number;
  currency: string;
  created_at: string;
  barber?: { display_name: string; shop_name: string };
  service?: { name: string; price: string | number };
}

interface Barber {
  id: string;
  display_name: string;
  bio: string | null;
  experience_years: number | null;
  rating_avg: string | number;
  rating_count: number;
  shop_name: string | null;
  address_text: string | null;
  is_verified: boolean;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  currency: string;
  duration_minutes: number;
  is_active: boolean;
}

interface ScheduleSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer: { id: string; full_name: string };
}

interface BarberDetail {
  profile: Barber & { latitude: string | null; longitude: string | null; updated_at: string };
  services: Service[];
  schedule: ScheduleSlot[];
  recent_bookings: any[];
  reviews: Review[];
  stats: {
    total_bookings: string | number;
    completed_bookings: string | number;
    cancelled_bookings: string | number;
    total_paid_revenue: string | number;
    currency: string;
    avg_booking_value: string | number;
  };
}

interface Payment {
  id: string;
  amount: string | number;
  currency: string;
  payment_method: string;
  transaction_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  booking: { id: string; booking_reference: string; booking_date: string; total_amount: string | number; payment_status: string };
  customer: { id: string; full_name: string; email: string };
}

interface PaymentsResponse {
  payments: Payment[];
  booking_payment_status_breakdown: { payment_status: string; payment_method: string | null; count: string | number; total_amount: string | number; currency: string }[];
}

interface OnboardingResponse {
  company: Company;
  entitlements: { feature: string; enabled: boolean; updated_at: string }[];
  capacity: { max_barbers: number; active_barbers: number; usage_pct: number | null };
  activity: { last_active: string | null; calls_7d: string | number };
}

type Tab = 'overview' | 'barbers' | 'bookings' | 'payments';

// The company record and its suspend/reactivate control are needed on every tab,
// so they are kept separate from the per-tab loading below. Splitting the data
// work in two is what lets the screen component stay short.
function useCompanyOverview(companyId: number) {
  const [detail, setDetail] = useState<CompanyDetailData | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [detailRes, onboardingRes] = await Promise.all([
        fetch(`${API_URL}/admin/companies/${companyId}`, { headers: adminHeaders(), credentials: 'include' }),
        fetch(`${API_URL}/admin/companies/${companyId}/onboarding`, { headers: adminHeaders(), credentials: 'include' }),
      ]);
      if (!detailRes.ok) throw new Error(`Failed to fetch company: ${detailRes.status}`);
      setDetail(await detailRes.json());
      if (onboardingRes.ok) setOnboarding(await onboardingRes.json());
    } catch (err) {
      setError(`${err}`);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  async function toggleStatus() {
    if (!detail) return;
    const nextStatus = detail.status === 'active' ? 'suspended' : 'active';
    try {
      setStatusUpdating(true);
      const response = await fetch(`${API_URL}/admin/companies/${detail.id}/status`, {
        method: 'PATCH',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error(`Failed to update status: ${response.status}`);
      const updated = await response.json();
      setDetail({ ...detail, status: updated.status });
    } catch (err) {
      setError(`${err}`);
    } finally {
      setStatusUpdating(false);
    }
  }

  return { detail, onboarding, loading, error, statusUpdating, toggleStatus };
}

// Each tab fetches its own slice lazily. Keeping all four together here means the
// screen component below is only about layout and which tab is showing.
function useCompanyTabData(companyId: number, tab: Tab, selectedBarberId: string | null) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersLoading, setBarbersLoading] = useState(false);
  const [barbersError, setBarbersError] = useState('');

  const [barberDetail, setBarberDetail] = useState<BarberDetail | null>(null);
  const [barberDetailLoading, setBarberDetailLoading] = useState(false);
  const [barberDetailError, setBarberDetailError] = useState('');

  const [bookings, setBookings] = useState<TenantBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState('');

  const [payments, setPayments] = useState<PaymentsResponse | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');

  const fetchBarbers = useCallback(async () => {
    try {
      setBarbersLoading(true);
      setBarbersError('');
      const res = await fetch(`${API_URL}/admin/companies/${companyId}/barbers`, { headers: adminHeaders(), credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to fetch barbers: ${res.status}`);
      setBarbers(await res.json());
    } catch (err) {
      setBarbersError(`${err}`);
    } finally {
      setBarbersLoading(false);
    }
  }, [companyId]);

  const fetchBarberDetail = useCallback(async (barberId: string) => {
    try {
      setBarberDetailLoading(true);
      setBarberDetailError('');
      const res = await fetch(`${API_URL}/admin/companies/${companyId}/barbers/${barberId}`, { headers: adminHeaders(), credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to fetch barber: ${res.status}`);
      setBarberDetail(await res.json());
    } catch (err) {
      setBarberDetailError(`${err}`);
    } finally {
      setBarberDetailLoading(false);
    }
  }, [companyId]);

  const fetchBookings = useCallback(async () => {
    try {
      setBookingsLoading(true);
      setBookingsError('');
      const res = await fetch(`${API_URL}/admin/companies/${companyId}/bookings`, { headers: adminHeaders(), credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to fetch bookings: ${res.status}`);
      setBookings(await res.json());
    } catch (err) {
      setBookingsError(`${err}`);
    } finally {
      setBookingsLoading(false);
    }
  }, [companyId]);

  const fetchPayments = useCallback(async () => {
    try {
      setPaymentsLoading(true);
      setPaymentsError('');
      const res = await fetch(`${API_URL}/admin/companies/${companyId}/payments`, { headers: adminHeaders(), credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to fetch payments: ${res.status}`);
      setPayments(await res.json());
    } catch (err) {
      setPaymentsError(`${err}`);
    } finally {
      setPaymentsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (tab === 'barbers' && !selectedBarberId) fetchBarbers();
    if (tab === 'bookings') fetchBookings();
    if (tab === 'payments') fetchPayments();
  }, [tab, selectedBarberId, fetchBarbers, fetchBookings, fetchPayments]);
  useEffect(() => {
    if (selectedBarberId) fetchBarberDetail(selectedBarberId);
  }, [selectedBarberId, fetchBarberDetail]);

  return {
    barbers, barbersLoading, barbersError,
    barberDetail, setBarberDetail, barberDetailLoading, barberDetailError,
    bookings, bookingsLoading, bookingsError,
    payments, paymentsLoading, paymentsError,
  };
}

// The identity banner sits above the tabs and never changes when the tab changes,
// so it is its own piece.
function CompanyHeaderCard({
  detail, statusUpdating, onToggleStatus,
}: { detail: CompanyDetailData; statusUpdating: boolean; onToggleStatus: () => void }) {
  return (
    <Card className="mb-6 bg-white border border-[#d4d2e3]">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1c1b1f] mb-1">{detail.name}</h2>
          <p className="text-[#a09cab] mb-3">{detail.owner_email}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {statusBadge(detail.status)}
            <Badge variant="outline">{detail.subscription_tier}</Badge>
            <Badge variant="default">{detail.max_barbers} max barbers</Badge>
          </div>
        </div>
        <Button
          variant={detail.status === 'active' ? 'destructive' : 'primary'}
          onClick={onToggleStatus}
          disabled={statusUpdating}
        >
          {statusUpdating ? 'Updating...' : detail.status === 'active' ? 'Suspend Company' : 'Reactivate Company'}
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 text-sm">
        <div>
          <p className="text-[#a09cab] mb-1">API Key</p>
          <p className="text-[#1c1b1f] font-mono text-xs break-all">{detail.api_key}</p>
        </div>
        <div>
          <p className="text-[#a09cab] mb-1">Created</p>
          <p className="text-[#1c1b1f]">{detail.created_at ? new Date(detail.created_at).toLocaleString() : '—'}</p>
        </div>
        <div>
          <p className="text-[#a09cab] mb-1">Renewal Date</p>
          <p className="text-[#1c1b1f]">{detail.renewal_date ? new Date(detail.renewal_date).toLocaleDateString() : '—'}</p>
        </div>
      </div>
    </Card>
  );
}

// The tab row is a self-contained control: it only needs to know which tab is
// current and how to report a new choice.
function CompanyTabBar({ tab, onSelect }: { tab: Tab; onSelect: (next: Tab) => void }) {
  return (
    <div className="flex items-center gap-2 mb-6 flex-wrap">
      {([
        ['overview', 'Overview', Settings],
        ['barbers', 'Barbers', Users],
        ['bookings', 'Bookings', CalendarClock],
        ['payments', 'Payments', DollarSign],
      ] as [Tab, string, any][]).map(([key, label, Icon]) => (
        <Button
          key={key}
          variant={tab === key ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onSelect(key)}
        >
          <Icon className="w-4 h-4" /> {label}
        </Button>
      ))}
    </div>
  );
}

// The overview tab is a fixed pair of summary cards fed by a single payload.
function OverviewTab({ onboarding }: { onboarding: OnboardingResponse | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="bg-white border border-[#d4d2e3]">
        <h3 className="text-lg font-bold text-[#1c1b1f] mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-[#C8A96A]" /> Onboarding &amp; Capacity
        </h3>
        {onboarding ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#a09cab]">Barber capacity</span>
              <span className="text-[#1c1b1f] font-semibold">
                {onboarding.capacity.active_barbers} / {onboarding.capacity.max_barbers}
                {onboarding.capacity.usage_pct !== null && ` (${onboarding.capacity.usage_pct}%)`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#a09cab]">Subscription tier</span>
              <Badge variant="outline">{onboarding.company.subscription_tier}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-[#a09cab]">API calls (last 7 days)</span>
              <span className="text-[#1c1b1f]">{onboarding.activity.calls_7d}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#a09cab]">Last API activity</span>
              <span className="text-[#1c1b1f]">
                {onboarding.activity.last_active ? new Date(onboarding.activity.last_active).toLocaleString() : 'No activity recorded'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[#a09cab]">Onboarding data unavailable.</p>
        )}
      </Card>

      <Card className="bg-white border border-[#d4d2e3]">
        <h3 className="text-lg font-bold text-[#1c1b1f] mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#C8A96A]" /> Feature Entitlements
        </h3>
        {onboarding && onboarding.entitlements.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {onboarding.entitlements.map((e) => (
              <Badge key={e.feature} variant={e.enabled ? 'success' : 'outline'}>
                {e.feature}{e.enabled ? '' : ' (off)'}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-[#a09cab]">No entitlements configured for this company.</p>
        )}
      </Card>
    </div>
  );
}

// The roster is the list half of a list/detail pair, so it stands apart from the
// single-barber view it opens.
function BarberRosterCard({
  barbers, loading, error, onSelectBarber,
}: { barbers: Barber[]; loading: boolean; error: string; onSelectBarber: (id: string) => void }) {
  return (
    <Card className="bg-white border border-[#d4d2e3]">
      <h3 className="text-lg font-bold text-[#1c1b1f] mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-[#C8A96A]" /> Barber Roster
      </h3>
      {error && <p className="text-red-700 mb-4">{error}</p>}
      {loading ? (
        <p className="text-[#a09cab]">Loading barbers...</p>
      ) : barbers.length === 0 ? (
        <p className="text-[#a09cab]">No barbers registered for this company yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#a09cab] border-b border-[#d4d2e3]">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Shop</th>
                <th className="py-2 pr-4">Experience</th>
                <th className="py-2 pr-4">Rating</th>
                <th className="py-2 pr-4">Verification</th>
                <th className="py-2 pr-4">Active</th>
                <th className="py-2 pr-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {barbers.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-[#f2f1fa] hover:bg-[#f2f1fa] cursor-pointer"
                  onClick={() => onSelectBarber(b.id)}
                >
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-[#1c1b1f]">{b.display_name}</p>
                    <p className="text-xs text-[#a09cab]">{b.email}</p>
                  </td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">
                    <p>{b.shop_name || '—'}</p>
                    <p className="text-xs text-[#a09cab]">{b.address_text || ''}</p>
                  </td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{b.experience_years ?? '—'} yrs</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">
                    <span className="inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-[#C8A96A]" fill="#C8A96A" />
                      {Number(b.rating_avg || 0).toFixed(1)} ({b.rating_count})
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {b.is_verified ? (
                      <Badge variant="success"><ShieldCheck className="w-3 h-3" /> Verified</Badge>
                    ) : (
                      <Badge variant="warning"><ShieldAlert className="w-3 h-3" /> Pending</Badge>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={b.is_active ? 'success' : 'error'}>{b.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-[#a09cab]">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// Identity plus headline numbers for one barber — the top card of the barber page.
function BarberProfileCard({ barberDetail }: { barberDetail: BarberDetail }) {
  return (
    <Card className="bg-white border border-[#d4d2e3]">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-xl font-bold text-[#1c1b1f]">{barberDetail.profile.display_name}</h3>
          <p className="text-[#a09cab]">{barberDetail.profile.email} · {barberDetail.profile.phone || 'no phone on file'}</p>
          <p className="text-[#a09cab] mt-1">{barberDetail.profile.shop_name} — {barberDetail.profile.address_text}</p>
          {barberDetail.profile.bio && <p className="text-[#1c1b1f] mt-3 max-w-xl">{barberDetail.profile.bio}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {barberDetail.profile.is_verified ? (
            <Badge variant="success"><ShieldCheck className="w-3 h-3" /> Verified</Badge>
          ) : (
            <Badge variant="warning"><ShieldAlert className="w-3 h-3" /> Pending verification</Badge>
          )}
          <Badge variant={barberDetail.profile.is_active ? 'success' : 'error'}>
            {barberDetail.profile.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <Badge variant="outline">{barberDetail.profile.experience_years ?? '—'} yrs experience</Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-sm">
        <div>
          <p className="text-[#a09cab] mb-1">Total bookings</p>
          <p className="text-[#1c1b1f] font-semibold text-lg">{barberDetail.stats.total_bookings}</p>
        </div>
        <div>
          <p className="text-[#a09cab] mb-1">Completed</p>
          <p className="text-[#1c1b1f] font-semibold text-lg">{barberDetail.stats.completed_bookings}</p>
        </div>
        <div>
          <p className="text-[#a09cab] mb-1">Paid revenue</p>
          <p className="text-[#1c1b1f] font-semibold text-lg">{money(barberDetail.stats.total_paid_revenue, barberDetail.stats.currency)}</p>
        </div>
        <div>
          <p className="text-[#a09cab] mb-1">Avg rating</p>
          <p className="text-[#1c1b1f] font-semibold text-lg">
            {Number(barberDetail.profile.rating_avg || 0).toFixed(1)} ({barberDetail.profile.rating_count})
          </p>
        </div>
      </div>
    </Card>
  );
}

// One component per kind of barber record, so the barber page below reads as a
// short list of sections instead of one long wall of markup.
function BarberServicesCard({ services }: { services: Service[] }) {
  return (
    <Card className="bg-white border border-[#d4d2e3]">
      <h4 className="text-base font-bold text-[#1c1b1f] mb-3 flex items-center gap-2">
        <Scissors className="w-4 h-4 text-[#C8A96A]" /> Services
      </h4>
      {services.length === 0 ? (
        <p className="text-[#a09cab]">No services listed.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {services.map((s) => (
            <div key={s.id} className="border border-[#d4d2e3] rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[#1c1b1f]">{s.name}</span>
                <span className="text-[#1c1b1f]">{money(s.price, s.currency)}</span>
              </div>
              <p className="text-xs text-[#a09cab]">{s.duration_minutes} min · {s.is_active ? 'active' : 'inactive'}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function BarberScheduleCard({ schedule }: { schedule: ScheduleSlot[] }) {
  return (
    <Card className="bg-white border border-[#d4d2e3]">
      <h4 className="text-base font-bold text-[#1c1b1f] mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-[#C8A96A]" /> Availability / Schedule
      </h4>
      {schedule.length === 0 ? (
        <p className="text-[#a09cab]">No schedule set up yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          {schedule.map((sl) => (
            <div key={sl.id} className="flex justify-between border border-[#f2f1fa] rounded px-3 py-2">
              <span className="text-[#1c1b1f]">{DAYS[sl.day_of_week]}</span>
              <span className={sl.is_available ? 'text-[#1c1b1f]' : 'text-[#a09cab] line-through'}>
                {sl.start_time}–{sl.end_time}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function BarberRecentBookingsCard({ recentBookings }: { recentBookings: any[] }) {
  return (
    <Card className="bg-white border border-[#d4d2e3]">
      <h4 className="text-base font-bold text-[#1c1b1f] mb-3 flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-[#C8A96A]" /> Recent Bookings
      </h4>
      {recentBookings.length === 0 ? (
        <p className="text-[#a09cab]">No bookings yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#a09cab] border-b border-[#d4d2e3]">
                <th className="py-2 pr-4">Reference</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Service</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Payment</th>
                <th className="py-2 pr-4">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((b: any) => (
                <tr key={b.id} className="border-b border-[#f2f1fa]">
                  <td className="py-3 pr-4 font-mono text-xs text-[#1c1b1f]">{b.booking_reference}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{b.booking_date} {b.start_time}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{b.customer?.full_name || '—'}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{b.service?.name || '—'}</td>
                  <td className="py-3 pr-4"><Badge variant="outline">{b.status}</Badge></td>
                  <td className="py-3 pr-4">
                    <Badge variant={b.payment_status === 'paid' ? 'success' : 'warning'}>{b.payment_status}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{money(b.total_amount, b.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function BarberReviewsCard({ reviews }: { reviews: Review[] }) {
  return (
    <Card className="bg-white border border-[#d4d2e3]">
      <h4 className="text-base font-bold text-[#1c1b1f] mb-3 flex items-center gap-2">
        <Star className="w-4 h-4 text-[#C8A96A]" /> Reviews
      </h4>
      {reviews.length === 0 ? (
        <p className="text-[#a09cab]">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="border-b border-[#f2f1fa] pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[#C8A96A]">
                  <Star className="w-3.5 h-3.5" fill="#C8A96A" /> {r.rating}/5
                </span>
                <span className="text-xs text-[#a09cab]">{r.customer?.full_name} · {new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {r.comment && <p className="text-sm text-[#1c1b1f] mt-1">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// The single-barber page: its own back control and loading/error states, then the
// section cards above in order.
function BarberDetailPanel({
  barberDetail, loading, error, onBack,
}: { barberDetail: BarberDetail | null; loading: boolean; error: string; onBack: () => void }) {
  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" /> Back to Roster
      </Button>
      {error && <p className="text-red-700 mb-4">{error}</p>}
      {loading ? (
        <p className="text-[#a09cab]">Loading barber...</p>
      ) : barberDetail ? (
        <div className="space-y-6">
          <BarberProfileCard barberDetail={barberDetail} />
          <BarberServicesCard services={barberDetail.services} />
          <BarberScheduleCard schedule={barberDetail.schedule} />
          <BarberRecentBookingsCard recentBookings={barberDetail.recent_bookings} />
          <BarberReviewsCard reviews={barberDetail.reviews} />
        </div>
      ) : (
        <p className="text-[#a09cab]">Barber not found.</p>
      )}
    </div>
  );
}

// The whole bookings tab is one card with its own loading and error states.
function CompanyBookingsCard({
  bookings, loading, error,
}: { bookings: TenantBooking[]; loading: boolean; error: string }) {
  return (
    <Card className="bg-white border border-[#d4d2e3]">
      <h3 className="text-lg font-bold text-[#1c1b1f] mb-4 flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-[#C8A96A]" /> Recent Bookings (this company's own database)
      </h3>
      {error && <p className="text-red-700 mb-4">{error}</p>}
      {loading ? (
        <p className="text-[#a09cab]">Loading bookings...</p>
      ) : bookings.length === 0 ? (
        <p className="text-[#a09cab]">No bookings yet for this company.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#a09cab] border-b border-[#d4d2e3]">
                <th className="py-2 pr-4">Reference</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Barber</th>
                <th className="py-2 pr-4">Service</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Payment</th>
                <th className="py-2 pr-4">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-[#f2f1fa]">
                  <td className="py-3 pr-4 font-mono text-xs text-[#1c1b1f]">{b.booking_reference}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{b.booking_date} {b.start_time}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{b.barber?.display_name || '—'}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{b.service?.name || '—'}</td>
                  <td className="py-3 pr-4"><Badge variant="outline">{b.status}</Badge></td>
                  <td className="py-3 pr-4">
                    <Badge variant={b.payment_status === 'paid' ? 'success' : 'warning'}>{b.payment_status}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{money(b.total_amount, b.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// The payments tab shows two lists that come from two different sources, so each
// is its own component and the tab itself just stacks them.
function PaymentsListCard({
  payments, loading, error,
}: { payments: PaymentsResponse | null; loading: boolean; error: string }) {
  return (
    <Card className="bg-white border border-[#d4d2e3]">
      <h3 className="text-lg font-bold text-[#1c1b1f] mb-4 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-[#C8A96A]" /> Payments
      </h3>
      {error && <p className="text-red-700 mb-4">{error}</p>}
      {loading ? (
        <p className="text-[#a09cab]">Loading payments...</p>
      ) : payments && payments.payments.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#a09cab] border-b border-[#d4d2e3]">
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Booking</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.payments.map((p) => (
                <tr key={p.id} className="border-b border-[#f2f1fa]">
                  <td className="py-3 pr-4 text-[#1c1b1f]">{p.customer?.full_name}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-[#1c1b1f]">{p.booking?.booking_reference}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{money(p.amount, p.currency)}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{p.payment_method}</td>
                  <td className="py-3 pr-4"><Badge variant={p.status === 'completed' ? 'success' : 'warning'}>{p.status}</Badge></td>
                  <td className="py-3 pr-4 text-[#a09cab]">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-[#a09cab] space-y-2">
          <p>No rows in the payments table yet for this company.</p>
          <p className="text-sm">
            This app doesn't currently write a row into <code className="bg-[#f2f1fa] px-1 rounded">payments</code> per
            transaction — the booking flow (see <code className="bg-[#f2f1fa] px-1 rounded">PayFee.tsx</code>) sets{' '}
            <code className="bg-[#f2f1fa] px-1 rounded">payment_status</code> directly on the booking. Real payment
            records will appear here once/if a dedicated payments-table write path is added. In the meantime, the
            payment status breakdown below (sourced from the bookings table) is the accurate picture.
          </p>
        </div>
      )}
    </Card>
  );
}

function PaymentBreakdownCard({ payments }: { payments: PaymentsResponse | null }) {
  return (
    <Card className="bg-white border border-[#d4d2e3]">
      <h3 className="text-lg font-bold text-[#1c1b1f] mb-4">Payment Status Breakdown (from bookings table)</h3>
      {payments && payments.booking_payment_status_breakdown.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#a09cab] border-b border-[#d4d2e3]">
                <th className="py-2 pr-4">Payment Status</th>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4">Count</th>
                <th className="py-2 pr-4">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.booking_payment_status_breakdown.map((row, i) => (
                <tr key={i} className="border-b border-[#f2f1fa]">
                  <td className="py-3 pr-4">
                    <Badge variant={row.payment_status === 'paid' ? 'success' : 'warning'}>{row.payment_status}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{row.payment_method || '—'}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{row.count}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{money(row.total_amount, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[#a09cab]">No bookings yet, so no payment status data.</p>
      )}
    </Card>
  );
}

function PaymentsTab({
  payments, loading, error,
}: { payments: PaymentsResponse | null; loading: boolean; error: string }) {
  return (
    <div className="space-y-6">
      <PaymentsListCard payments={payments} loading={loading} error={error} />
      <PaymentBreakdownCard payments={payments} />
    </div>
  );
}

export function CompanyDetail({ companyId, onBack }: { companyId: number; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);

  const { detail, onboarding, loading, error, statusUpdating, toggleStatus } = useCompanyOverview(companyId);
  const tabData = useCompanyTabData(companyId, tab, selectedBarberId);

  if (loading) {
    return <p className="text-[#a09cab]">Loading company...</p>;
  }

  if (!detail) {
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-4" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back to Companies
        </Button>
        {error && <p className="text-red-700">{error}</p>}
        <p className="text-[#a09cab]">Company not found.</p>
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={onBack}>
        <ChevronLeft className="w-4 h-4" /> Back to Companies
      </Button>

      {error && <p className="text-red-700 mb-4">{error}</p>}

      <CompanyHeaderCard detail={detail} statusUpdating={statusUpdating} onToggleStatus={toggleStatus} />

      <CompanyTabBar tab={tab} onSelect={(key) => { setTab(key); setSelectedBarberId(null); }} />

      {tab === 'overview' && <OverviewTab onboarding={onboarding} />}

      {tab === 'barbers' && !selectedBarberId && (
        <BarberRosterCard
          barbers={tabData.barbers}
          loading={tabData.barbersLoading}
          error={tabData.barbersError}
          onSelectBarber={(id) => setSelectedBarberId(id)}
        />
      )}

      {tab === 'barbers' && selectedBarberId && (
        <BarberDetailPanel
          barberDetail={tabData.barberDetail}
          loading={tabData.barberDetailLoading}
          error={tabData.barberDetailError}
          onBack={() => { setSelectedBarberId(null); tabData.setBarberDetail(null); }}
        />
      )}

      {tab === 'bookings' && (
        <CompanyBookingsCard
          bookings={tabData.bookings}
          loading={tabData.bookingsLoading}
          error={tabData.bookingsError}
        />
      )}

      {tab === 'payments' && (
        <PaymentsTab
          payments={tabData.payments}
          loading={tabData.paymentsLoading}
          error={tabData.paymentsError}
        />
      )}
    </div>
  );
}
