import { useEffect, useState, useCallback } from 'react';
import AdminTableHead from './AdminTableHead';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Users, TrendingUp, AlertCircle, Building2, CalendarClock } from 'lucide-react';
import { CompanyDetail } from './CompanyDetail';

const API_URL = import.meta.env.VITE_API_URL || '';

function adminHeaders() {
  return {
    'Authorization': `Bearer ${localStorage.getItem('adminApiKey')}`,
    'X-Admin-Role': 'true',
  };
}

interface DashboardStats {
  active_companies: number;
  suspended_companies: number;
  total_companies: number;
  total_max_barbers: number;
  total_bookings: number;
  total_revenue: number;
}

interface RevenueData {
  date: string;
  revenue: number;
  bookings: number;
}

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

interface CrossPlatformBooking extends TenantBooking {
  barber_name: string;
  service_name: string;
  company_id: number;
  company_name: string;
}

type View = 'dashboard' | 'companies' | 'company-detail' | 'bookings';

function money(n: string | number) {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return `$${(v || 0).toFixed(2)}`;
}

function statusBadge(status: string) {
  return (
    <Badge variant={status === 'active' ? 'success' : status === 'suspended' ? 'error' : 'warning'}>
      {status}
    </Badge>
  );
}

// The overview figures load once on mount, whereas the two list views load lazily
// when you switch to them. Keeping those two jobs apart is what lets the screen
// component below stay short enough to read in one go.
function useDashboardOverviewData() {
  // Dashboard
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenue, setRevenue] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_URL}/admin/dashboard`, {
        headers: adminHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      const data = await response.json();
      setStats(data.stats);
      setRevenue(data.revenue);
    } catch (err) {
      setError(`${err}`);
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return { stats, revenue, loading, error };
}

function useAdminListData(view: View) {
  // Companies
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState('');

  // Cross-platform bookings
  const [allBookings, setAllBookings] = useState<CrossPlatformBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState('');

  const fetchCompanies = useCallback(async () => {
    try {
      setCompaniesLoading(true);
      setCompaniesError('');
      const response = await fetch(`${API_URL}/admin/companies`, {
        headers: adminHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      const data = await response.json();
      setCompanies(data);
    } catch (err) {
      setCompaniesError(`${err}`);
      console.error('Companies error:', err);
    } finally {
      setCompaniesLoading(false);
    }
  }, []);

  const fetchAllBookings = useCallback(async () => {
    try {
      setBookingsLoading(true);
      setBookingsError('');
      const response = await fetch(`${API_URL}/admin/bookings`, {
        headers: adminHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      setAllBookings(await response.json());
    } catch (err) {
      setBookingsError(`${err}`);
      console.error('Bookings error:', err);
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'companies') fetchCompanies();
    if (view === 'bookings') fetchAllBookings();
  }, [view, fetchCompanies, fetchAllBookings]);

  return {
    companies, companiesLoading, companiesError,
    allBookings, bookingsLoading, bookingsError,
  };
}

// The top navigation is a self-contained control: it only needs the current view
// and the two things a click can do.
function AdminNavBar({
  view, onSelectView, onGoHome,
}: { view: View; onSelectView: (next: View) => void; onGoHome: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-8 flex-wrap">
      <Button
        variant={view === 'dashboard' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => onSelectView('dashboard')}
      >
        <TrendingUp className="w-4 h-4" /> Overview
      </Button>
      <Button
        variant={view === 'companies' || view === 'company-detail' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => onSelectView('companies')}
      >
        <Building2 className="w-4 h-4" /> Companies
      </Button>
      <Button
        variant={view === 'bookings' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => onSelectView('bookings')}
      >
        <CalendarClock className="w-4 h-4" /> All Bookings
      </Button>
      <div className="flex-1" />
      <Button variant="secondary" size="sm" onClick={onGoHome}>
        ← Back to Home
      </Button>
    </div>
  );
}

// The dashboard failure banner is a distinct thing from the dashboard content, so
// it is kept separate from the cards it appears above.
function DashboardErrorCard({ error }: { error: string }) {
  return (
    <Card className="mb-6 border-l-4 border-red-500 bg-red-50">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 mt-1 flex-shrink-0" />
        <div>
          <p className="font-semibold text-red-900">Error loading dashboard</p>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    </Card>
  );
}

// The two stat rows are separate components because they are separate grids with
// different column counts, shown as two distinct bands on the page.
function PlatformStatCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <Card className="bg-white border border-[#d4d2e3]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#a09cab] text-sm mb-1">Active Companies</p>
            <p className="text-3xl font-bold text-[#1c1b1f]">{stats.active_companies}</p>
          </div>
          <Users className="w-10 h-10 text-[#C8A96A]" />
        </div>
      </Card>

      <Card className="bg-white border border-[#d4d2e3]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#a09cab] text-sm mb-1">Suspended</p>
            <p className="text-3xl font-bold text-[#1c1b1f]">{stats.suspended_companies}</p>
          </div>
          <AlertCircle className="w-10 h-10 text-orange-500" />
        </div>
      </Card>

      <Card className="bg-white border border-[#d4d2e3]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#a09cab] text-sm mb-1">Total Companies</p>
            <p className="text-3xl font-bold text-[#1c1b1f]">{stats.total_companies}</p>
          </div>
          <Building2 className="w-10 h-10 text-blue-500" />
        </div>
      </Card>

      <Card className="bg-white border border-[#d4d2e3]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#a09cab] text-sm mb-1">Total Barber Slots</p>
            <p className="text-3xl font-bold text-[#1c1b1f]">{stats.total_max_barbers || 0}</p>
          </div>
          <Users className="w-10 h-10 text-emerald-500" />
        </div>
      </Card>
    </div>
  );
}

function RealTotalsCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <Card className="bg-white border border-[#d4d2e3]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#a09cab] text-sm mb-1">Total Real Bookings (all tenants)</p>
            <p className="text-3xl font-bold text-[#1c1b1f]">{stats.total_bookings}</p>
          </div>
          <CalendarClock className="w-10 h-10 text-[#C8A96A]" />
        </div>
      </Card>
      <Card className="bg-white border border-[#d4d2e3]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#a09cab] text-sm mb-1">Total Real Revenue (paid, all tenants)</p>
            <p className="text-3xl font-bold text-[#1c1b1f]">{money(stats.total_revenue)}</p>
          </div>
          <DollarSign className="w-10 h-10 text-emerald-500" />
        </div>
      </Card>
    </div>
  );
}

// The chart carries a lot of configuration that has nothing to do with the rest of
// the page, so it lives on its own.
function RevenueTrendCard({ revenue }: { revenue: RevenueData[] }) {
  return (
    <Card className="mb-8 bg-white border border-[#d4d2e3]">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1c1b1f] flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#C8A96A]" />
          30-Day Revenue Trend (real, computed from tenant bookings)
        </h2>
      </div>

      {revenue.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenue}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d4d2e3" />
            <XAxis dataKey="date" stroke="#a09cab" />
            <YAxis stroke="#a09cab" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#f2f1fa',
                border: '1px solid #d4d2e3',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#C8A96A"
              strokeWidth={2}
              dot={{ fill: '#C8A96A' }}
              name="Revenue ($)"
            />
            <Line
              type="monotone"
              dataKey="bookings"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981' }}
              name="Bookings"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-80 flex flex-col items-center justify-center text-[#a09cab] gap-2">
          <CalendarClock className="w-10 h-10" />
          <p>No revenue data yet — no paid bookings in the last 30 days across any tenant.</p>
        </div>
      )}
    </Card>
  );
}

// The overview view is the error banner, two stat bands and the chart, in order.
function DashboardOverview({
  stats, revenue, error,
}: { stats: DashboardStats | null; revenue: RevenueData[]; error: string }) {
  return (
    <>
      {error && <DashboardErrorCard error={error} />}

      {stats && <PlatformStatCards stats={stats} />}

      {stats && <RealTotalsCards stats={stats} />}

      <RevenueTrendCard revenue={revenue} />
    </>
  );
}

// The companies view is a single card with its own loading and error states.
function CompaniesCard({
  companies, loading, error, onOpenCompany,
}: { companies: Company[]; loading: boolean; error: string; onOpenCompany: (id: number) => void }) {
  return (
    <Card className="bg-white border border-[#d4d2e3]">
      <h2 className="text-xl font-bold text-[#1c1b1f] mb-4 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-[#C8A96A]" /> Companies
      </h2>
      {error && <p className="text-red-700 mb-4">{error}</p>}
      {loading ? (
        <p className="text-[#a09cab]">Loading companies...</p>
      ) : companies.length === 0 ? (
        <p className="text-[#a09cab]">No companies yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <AdminTableHead columns={['Name', 'Owner Email', 'Tier', 'Status', 'Max Barbers', 'Created']} />
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[#f2f1fa] hover:bg-[#f2f1fa] cursor-pointer"
                  onClick={() => onOpenCompany(c.id)}
                >
                  <td className="py-3 pr-4 font-semibold text-[#1c1b1f]">{c.name}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{c.owner_email}</td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline">{c.subscription_tier}</Badge>
                  </td>
                  <td className="py-3 pr-4">{statusBadge(c.status)}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{c.max_barbers}</td>
                  <td className="py-3 pr-4 text-[#a09cab]">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// The cross-tenant bookings view is a separate card from the companies one: a
// different payload, different columns, and it is reached from a different tab.
function AllBookingsCard({
  bookings, loading, error, onOpenCompany,
}: { bookings: CrossPlatformBooking[]; loading: boolean; error: string; onOpenCompany: (id: number) => void }) {
  return (
    <Card className="bg-white border border-[#d4d2e3]">
      <h2 className="text-xl font-bold text-[#1c1b1f] mb-4 flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-[#C8A96A]" /> All Bookings (across every tenant)
      </h2>
      {error && <p className="text-red-700 mb-4">{error}</p>}
      {loading ? (
        <p className="text-[#a09cab]">Loading bookings...</p>
      ) : bookings.length === 0 ? (
        <p className="text-[#a09cab]">No bookings yet across any tenant.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <AdminTableHead columns={['Company', 'Reference', 'Date', 'Barber', 'Service', 'Status', 'Payment', 'Amount']} />
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr
                  key={`${b.company_id}-${b.id}`}
                  className="border-b border-[#f2f1fa] hover:bg-[#f2f1fa] cursor-pointer"
                  onClick={() => onOpenCompany(b.company_id)}
                >
                  <td className="py-3 pr-4 font-semibold text-[#1c1b1f]">{b.company_name}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-[#1c1b1f]">{b.booking_reference}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">
                    {b.booking_date} {b.start_time}
                  </td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{b.barber_name}</td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{b.service_name}</td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline">{b.status}</Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={b.payment_status === 'paid' ? 'success' : 'warning'}>
                      {b.payment_status}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-[#1c1b1f]">{money(b.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('dashboard');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const { stats, revenue, loading, error } = useDashboardOverviewData();
  const lists = useAdminListData(view);

  function openCompany(id: number) {
    setSelectedCompanyId(id);
    setView('company-detail');
  }

  if (loading && view === 'dashboard') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C8A96A] mx-auto mb-4"></div>
          <p className="text-[#a09cab]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f1fa] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#1c1b1f] mb-2">Owner Dashboard</h1>
          <p className="text-[#a09cab]">Manage all barber companies and monitor platform performance</p>
        </div>

        <AdminNavBar view={view} onSelectView={(next) => setView(next)} onGoHome={() => navigate('/')} />

        {view === 'dashboard' && (
          <DashboardOverview stats={stats} revenue={revenue} error={error} />
        )}

        {view === 'companies' && (
          <CompaniesCard
            companies={lists.companies}
            loading={lists.companiesLoading}
            error={lists.companiesError}
            onOpenCompany={openCompany}
          />
        )}

        {view === 'company-detail' && selectedCompanyId && (
          <CompanyDetail companyId={selectedCompanyId} onBack={() => setView('companies')} />
        )}

        {view === 'bookings' && (
          <AllBookingsCard
            bookings={lists.allBookings}
            loading={lists.bookingsLoading}
            error={lists.bookingsError}
            onOpenCompany={openCompany}
          />
        )}
      </div>
    </div>
  );
}
