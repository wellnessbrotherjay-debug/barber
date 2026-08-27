import React, { useEffect, useState } from 'react';
import { DotSeparator} from '../../components/ScreenPieces';
import ScreenHeader from '../../components/ScreenHeader';
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, Check, MessageSquare, Phone } from 'lucide-react';
import BarberNav from '@/components/BarberNav';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { authFetch } from '@/lib/api';

interface Props {
  tab: 'incoming' | 'upcoming' | 'past';
}

export interface Job {
  id: string;
  status: string;
  booking_date: string;
  start_time: string;
  payment_status: string;
  total_amount: number;
  notes: string | null;
  users: { full_name: string; email: string };
  services: { name: string; price: number; duration_minutes: number };
  barber_profiles: { shop_name: string | null; address_text: string | null };
  // Revealed by the API only once the job is accepted (chat/call v1 — §5).
  customer_phone?: string | null;
}

const TABS = [
  { key: 'incoming' as const, label: 'Incoming', path: '/barber/jobs/incoming' },
  { key: 'upcoming' as const, label: 'Upcoming', path: '/barber/jobs/upcoming' },
  { key: 'past' as const, label: 'Past', path: '/barber/jobs/past' },
];

const PAST_FILTERS = [
  { key: 'all' as const, label: 'All' },
  { key: 'completed' as const, label: 'Completed' },
  { key: 'cancelled' as const, label: 'Cancelled' },
  { key: 'no_show' as const, label: 'No-Show' },
];

const ONLINE_PREF_KEY = 'barberSync_onlinePref';

function jobTab(status: string): 'incoming' | 'upcoming' | 'past' {
  if (status === 'pending') return 'incoming';
  if (status === 'completed' || status === 'cancelled' || status === 'no_show') return 'past';
  return 'upcoming';
}

function statusChipLabel(tab: Props['tab'], status: string): string {
  if (tab === 'incoming') return 'Incoming';
  if (tab === 'upcoming') return 'Accepted';
  if (status === 'completed') return 'Completed';
  if (status === 'no_show') return 'No-show';
  return 'Cancelled';
}

export async function fetchBarberJobs(userId: string): Promise<Job[]> {
  const response = await authFetch(`/api/barber/bookings`, {
    headers: {
    },
  });
  if (!response.ok) throw new Error(`Failed to fetch jobs: ${response.status}`);
  return response.json() as Promise<Job[]>;
}

/* Status chip — Figma 1:3209: bg #f8f8f8 pill, 3px dot, 10px #514e59 */
function StatusChip({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1 bg-[#f8f8f8] rounded-full px-3 py-1.5 shrink-0">
      <DotSeparator />
      <span className="text-[10px] leading-3 font-medium text-[#514e59]">{label}</span>
    </div>
  );
}

/* Dashed hairline — Figma dashed vector divider */
function DashedDivider() {
  return <div className="w-full border-t-[1.5px] border-dashed border-[#e3e1ec]" />;
}

/* The online switch, the tab bar and the past-work filters are each their own
   control with its own state to show. They are separated out so the screen
   below reads as the four things it is, rather than one long wall of markup. */
function OnlineStatusCard({ online, onToggle }: { online: boolean; onToggle: () => void }) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between bg-[#fafafa] rounded-[12px] p-3">
        <div>
          <p className={cn('text-[14px] leading-5 font-semibold', online ? 'text-[#4ca054]' : 'text-[#a09cab]')}>
            {online ? 'Online' : 'Offline'}
          </p>
          <p className="text-[12px] leading-4 font-semibold text-[#686471] mt-3">
            {online ? 'You can receive requests' : 'You will not receive new requests'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={online}
          onClick={onToggle}
          className="relative w-[22px] h-[14px] shrink-0"
        >
          <span className={cn('absolute left-0 top-[1.3px] w-[21.6px] h-[11.5px] rounded-[6.4px] transition-colors', online ? 'bg-[#5c59e8]' : 'bg-[#d4d2e3]')} />
          <span
            className={cn(
              'absolute top-0 w-[14px] h-[14px] rounded-full bg-white border-[0.64px] transition-all',
              online ? 'left-[8.3px] border-[#5c59e8]' : 'left-0 border-[#d4d2e3]'
            )}
          />
        </button>
      </div>
    </div>
  );
}

function JobsTabBar({
  tab,
  incomingCount,
  onSelect,
}: {
  tab: Props['tab'];
  incomingCount: number;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center bg-[#eff1f5] rounded-full p-[3px]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(t.path)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 p-3 rounded-full text-[14px] leading-5 text-center transition-colors',
              tab === t.key ? 'bg-white font-semibold text-[#1c1b1f]' : 'font-medium text-[#676372]'
            )}
          >
            {t.label}
            {t.key === 'incoming' && incomingCount > 0 && (
              <span className="inline-flex items-center justify-center w-6 h-6 bg-[#f8f8f8] rounded-full text-[10px] leading-3 font-medium text-[#514e59]">
                {incomingCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function PastFilterRow({
  pastFilter,
  onSelect,
}: {
  pastFilter: 'all' | 'completed' | 'cancelled' | 'no_show';
  onSelect: (key: 'all' | 'completed' | 'cancelled' | 'no_show') => void;
}) {
  return (
    <div className="px-5 py-4 flex gap-[9px]">
      {PAST_FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onSelect(f.key)}
          className={cn(
            'px-3 py-2.5 rounded-[8px] text-[12px] leading-4 font-semibold transition-colors',
            pastFilter === f.key
              ? 'bg-[#1c1b1f] text-white'
              : 'border-[0.75px] border-[#d2dbe9] text-[#514e59]'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

/* A job card shows completely different things in each of the three tabs. Each
   tab's body is its own component so that changing what an incoming request
   looks like cannot disturb the look of a finished job. */
function IncomingJobBody({ job, onView }: { job: Job; onView: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-3 w-full">
        <DashedDivider />
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-[#1c1b1f]" strokeWidth={2} />
          <p className="text-[10px] leading-[14px] font-semibold text-black">
            {job.booking_date} <span className="text-[#1c1b1f]">•</span> {job.start_time}
          </p>
        </div>
        <DashedDivider />
      </div>
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-start gap-1">
          <MapPin className="w-3.5 h-3.5 text-[#1c1b1f] mt-px" strokeWidth={2} />
          <div className="flex flex-col gap-1">
            <p className="text-[12px] leading-4 font-semibold text-[#1c1b1f]">
              {job.barber_profiles?.shop_name || 'In-shop'}
            </p>
            {job.barber_profiles?.address_text && (
              <p className="text-[10px] leading-[14px] font-semibold text-[#a09cab]">{job.barber_profiles.address_text}</p>
            )}
          </div>
        </div>
        <DashedDivider />
      </div>
      {job.payment_status === 'paid' && (
        <div className="flex items-center gap-2 bg-[#f4f5f8] rounded-full p-3 self-start">
          <Check className="w-4 h-4 text-[#1c1b1f]" strokeWidth={2} />
          <p className="text-[12px] leading-4 font-medium text-[#1c1b1f]">Booking fee paid</p>
        </div>
      )}
      <div className="bg-[#f4f5f8] rounded-[8px] p-3 w-full">
        <p className="text-[12px] leading-4 font-medium text-[#1c1b1f]">
          "Haircut payment is handled directly with the customer."
        </p>
      </div>
      <button
        type="button"
        onClick={onView}
        className="w-full bg-[#1c1b1f] rounded-full px-9 py-[18px] text-[14px] leading-5 font-semibold text-white text-center"
      >
        View
      </button>
    </>
  );
}

/* Chat / Call v1 — native SMS composer / dialler with the
   customer's number, revealed by the API only after this job
   was accepted (docs/SCOPE_RECONCILIATION.md §5). */
function CustomerContactButtons({ phone }: { phone: string | null | undefined }) {
  return (
    <div className="flex gap-2 w-full">
      {phone ? (
        <a
          href={`sms:${phone}`}
          className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full px-7 py-3.5 text-[14px] leading-5 font-semibold text-[#1c1b1f]"
        >
          <MessageSquare className="w-5 h-5" strokeWidth={1.8} />
          Chat
        </a>
      ) : (
        <button
          type="button"
          disabled
          title="Chat unlocks once the customer's number is available"
          className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full px-7 py-3.5 text-[14px] leading-5 font-semibold text-[#1c1b1f] disabled:opacity-60"
        >
          <MessageSquare className="w-5 h-5" strokeWidth={1.8} />
          Chat
        </button>
      )}
      {phone ? (
        <a
          href={`tel:${phone}`}
          className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full px-7 py-3.5 text-[14px] leading-5 font-semibold text-[#1c1b1f]"
        >
          <Phone className="w-5 h-5" strokeWidth={1.8} />
          Call
        </a>
      ) : (
        <button
          type="button"
          disabled
          title="Call unlocks once the customer's number is available"
          className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full px-7 py-3.5 text-[14px] leading-5 font-semibold text-[#1c1b1f] disabled:opacity-60"
        >
          <Phone className="w-5 h-5" strokeWidth={1.8} />
          Call
        </button>
      )}
    </div>
  );
}

function UpcomingJobBody({ job, onView }: { job: Job; onView: () => void }) {
  return (
    <>
      <div className="flex items-center gap-1 w-full">
        <Clock className="w-3.5 h-3.5 text-[#1c1b1f]" strokeWidth={2} />
        <p className="text-[10px] leading-[14px] font-semibold text-black">
          {job.booking_date} • {job.start_time}
        </p>
      </div>
      <div className="flex items-start gap-1 w-full">
        <MapPin className="w-3.5 h-3.5 text-[#1c1b1f] mt-px" strokeWidth={2} />
        <div className="flex flex-col gap-1">
          <p className="text-[12px] leading-4 font-semibold text-[#1c1b1f]">
            {job.barber_profiles?.shop_name || 'In-shop'}
          </p>
          {job.barber_profiles?.address_text && (
            <p className="text-[10px] leading-[14px] font-semibold text-[#a09cab]">{job.barber_profiles.address_text}</p>
          )}
        </div>
      </div>
      <CustomerContactButtons phone={job.customer_phone} />
      <button
        type="button"
        onClick={onView}
        className="w-full bg-[#1c1b1f] rounded-full px-9 py-[18px] text-[14px] leading-5 font-semibold text-white text-center"
      >
        View Job
      </button>
    </>
  );
}

function PastJobBody({ job, onView }: { job: Job; onView: () => void }) {
  return (
    <>
      <div className="flex items-center gap-1 w-full">
        <Clock className="w-3.5 h-3.5 text-[#1c1b1f]" strokeWidth={2} />
        <p className="text-[10px] leading-[14px] font-semibold text-black">
          {job.booking_date} • {job.start_time}
        </p>
      </div>
      <div className="flex items-center gap-1 w-full">
        <MapPin className="w-3.5 h-3.5 text-[#1c1b1f]" strokeWidth={2} />
        <p className="text-[12px] leading-4 font-semibold text-[#1c1b1f]">
          {job.barber_profiles?.shop_name || 'In-shop'}
        </p>
      </div>
      <DashedDivider />
      <div className="flex items-center justify-between w-full">
        <p className="text-[12px] leading-4 font-semibold text-[#848992]">
          {job.status === 'completed' && job.payment_status === 'paid'
            ? `Booking fee: $${Number(job.total_amount).toFixed(0)}`
            : 'No fee earned'}
        </p>
        <button
          type="button"
          onClick={onView}
          className="text-[12px] leading-4 font-bold text-[#1c1b1f]"
        >
          View details
        </button>
      </div>
    </>
  );
}

function JobCard({ job, tab, onView }: { job: Job; tab: Props['tab']; onView: () => void }) {
  return (
    <div className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 flex flex-col gap-3">
      {/* Card header — name / service + status chip */}
      <div className="flex items-start justify-between w-full">
        <div className="flex flex-col gap-1">
          <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">{job.users?.full_name}</p>
          <p className="text-[12px] leading-4 font-medium text-[#a09cab] truncate max-w-[235px]">{job.services?.name}</p>
        </div>
        <StatusChip label={statusChipLabel(tab, job.status)} />
      </div>

      {tab === 'incoming' && <IncomingJobBody job={job} onView={onView} />}

      {tab === 'upcoming' && <UpcomingJobBody job={job} onView={onView} />}

      {tab === 'past' && <PastJobBody job={job} onView={onView} />}
    </div>
  );
}

export default function BarberJobs({ tab }: Props) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(() => localStorage.getItem(ONLINE_PREF_KEY) !== 'false');
  const [pastFilter, setPastFilter] = useState<'all' | 'completed' | 'cancelled' | 'no_show'>('all');

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchBarberJobs(user.id);
        if (!cancelled) setJobs(data);
      } catch (err) {
        if (!cancelled) setError(`${err}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  function toggleOnline() {
    const next = !online;
    setOnline(next);
    localStorage.setItem(ONLINE_PREF_KEY, String(next));
  }

  const incomingCount = jobs.filter((j) => jobTab(j.status) === 'incoming').length;
  let filtered = jobs.filter((j) => jobTab(j.status) === tab);
  if (tab === 'past' && pastFilter !== 'all') {
    filtered = filtered.filter((j) => j.status === pastFilter);
  }

  const headline = tab === 'incoming'
    ? { title: 'New booking requests', sub: 'Respond quickly to improve your visibility' }
    : tab === 'upcoming'
    ? { title: 'Upcoming jobs', sub: 'Accepted bookings appear here' }
    : { title: 'Past jobs', sub: 'Review your completed and cancelled work' };

  return (
    <div className="min-h-screen bg-white pb-[88px]">
      {/* Top Navigation Bar — Figma 1:3170 */}
      <ScreenHeader title="Jobs" />

      {/* Online status card — Figma 1:3177 */}
      <OnlineStatusCard online={online} onToggle={toggleOnline} />

      {/* Segmented Tabs Bar — Figma 1:3187 */}
      <JobsTabBar tab={tab} incomingCount={incomingCount} onSelect={(path) => navigate(path)} />

      {/* Section headline — Figma 1:3200 */}
      <div className="px-5 py-4">
        <h2 className="text-[18px] leading-6 font-bold text-[#1c1b1f]">{headline.title}</h2>
        <p className="text-[12px] leading-4 font-medium text-[#a09cab] mt-1">{headline.sub}</p>
      </div>

      {/* Past filters — Figma 1:3367 */}
      {tab === 'past' && <PastFilterRow pastFilter={pastFilter} onSelect={setPastFilter} />}

      {/* Job cards */}
      <div className="px-5 py-4 space-y-4">
        {loading && <p className="text-center text-sm text-[#a09cab] py-8">Loading jobs…</p>}
        {error && <p className="text-center text-sm text-red-600 py-8">{error}</p>}
        {!loading && !error && filtered.map((j) => (
          <JobCard key={j.id} job={j} tab={tab} onView={() => navigate(`/barber/job/${j.id}`)} />
        ))}
        {!loading && !error && filtered.length === 0 && (
          <p className="text-center text-sm text-[#a09cab] py-8">No jobs here</p>
        )}
      </div>

      <BarberNav active="jobs" />
    </div>
  );
}
