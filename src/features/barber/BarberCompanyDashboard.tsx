import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Calendar, DollarSign, Star, AlertCircle } from 'lucide-react';

interface CompanyDashboard {
  company: {
    id: string;
    name: string;
    tier: string;
  };
  metrics: {
    total_bookings: number;
    completed_bookings: number;
    canceled_bookings: number;
    total_revenue: number;
    average_rating: number;
    metric_days: number;
  };
  today: {
    bookings: number;
  };
}

// The three read-only blocks of the dashboard — the loading state, the tile row
// and the thirty-day summary — are their own pieces so the fetch and refresh
// logic at the top of the screen is not buried in markup.

function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C8A96A] mx-auto mb-4"></div>
        <p className="text-[#a09cab]">Loading your dashboard...</p>
      </div>
    </div>
  );
}

function DashboardLoadError({ error }: { error: string }) {
  return (
    <div className="min-h-screen bg-[#f2f1fa] p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="border-l-4 border-red-500 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-1 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Error loading dashboard</p>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DashboardStats({
  today,
  metrics,
  conversionRate,
}: {
  today: CompanyDashboard['today'];
  metrics: CompanyDashboard['metrics'];
  conversionRate: number;
}) {
  return (
    /* Stats Grid */
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card className="bg-white border border-[#d4d2e3]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#a09cab] text-sm mb-1">Today's Bookings</p>
            <p className="text-3xl font-bold text-[#1c1b1f]">{today.bookings}</p>
          </div>
          <Calendar className="w-10 h-10 text-[#C8A96A]" />
        </div>
      </Card>

      <Card className="bg-white border border-[#d4d2e3]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#a09cab] text-sm mb-1">Total Revenue</p>
            <p className="text-3xl font-bold text-[#1c1b1f]">
              ${parseFloat(String(metrics.total_revenue ?? 0)).toFixed(0)}
            </p>
          </div>
          <DollarSign className="w-10 h-10 text-emerald-500" />
        </div>
      </Card>

      <Card className="bg-white border border-[#d4d2e3]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#a09cab] text-sm mb-1">Completion Rate</p>
            <p className="text-3xl font-bold text-[#1c1b1f]">{conversionRate}%</p>
          </div>
          <TrendingUp className="w-10 h-10 text-blue-500" />
        </div>
      </Card>

      <Card className="bg-white border border-[#d4d2e3]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#a09cab] text-sm mb-1">Average Rating</p>
            <div className="flex items-center gap-1">
              <p className="text-3xl font-bold text-[#1c1b1f]">
                {metrics.average_rating ? metrics.average_rating.toFixed(1) : '—'}
              </p>
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DashboardSummary({ metrics }: { metrics: CompanyDashboard['metrics'] }) {
  return (
    /* Booking Stats */
    <Card className="mb-8 bg-white border border-[#d4d2e3]">
      <h2 className="text-xl font-bold text-[#1c1b1f] mb-6">30-Day Summary</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 bg-[#f2f1fa] rounded-lg border border-[#d4d2e3]">
          <p className="text-[#a09cab] text-sm mb-2">Total Bookings</p>
          <p className="text-2xl font-bold text-[#1c1b1f]">{metrics.total_bookings}</p>
        </div>
        <div className="p-4 bg-[#f2f1fa] rounded-lg border border-[#d4d2e3]">
          <p className="text-[#a09cab] text-sm mb-2">Completed</p>
          <p className="text-2xl font-bold text-emerald-600">{metrics.completed_bookings}</p>
        </div>
        <div className="p-4 bg-[#f2f1fa] rounded-lg border border-[#d4d2e3]">
          <p className="text-[#a09cab] text-sm mb-2">Canceled</p>
          <p className="text-2xl font-bold text-red-600">{metrics.canceled_bookings}</p>
        </div>
      </div>
    </Card>
  );
}

export function BarberCompanyDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<CompanyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCompanyDashboard();
    const interval = setInterval(fetchCompanyDashboard, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  async function fetchCompanyDashboard() {
    try {
      const apiKey = localStorage.getItem('companyApiKey');
      if (!apiKey) {
        setError('No API key found. Please login.');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/company/dashboard`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();
      setDashboard(data);
    } catch (err) {
      setError(`${err}`);
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <DashboardLoading />;
  }

  if (!dashboard) {
    return <DashboardLoadError error={error} />;
  }

  const { company, metrics, today } = dashboard;
  const conversionRate = metrics.total_bookings > 0
    ? Math.round((metrics.completed_bookings / metrics.total_bookings) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#f2f1fa] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-bold text-[#1c1b1f]">{company.name}</h1>
            <Badge variant={company.tier === 'pro' ? 'primary' : 'default'}>
              {company.tier.toUpperCase()}
            </Badge>
          </div>
          <p className="text-[#a09cab]">Manage your bookings, income, and team</p>
        </div>

        {error && (
          <Card className="mb-6 border-l-4 border-orange-500 bg-orange-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-500 mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-900">Notice</p>
                <p className="text-orange-700">{error}</p>
              </div>
            </div>
          </Card>
        )}

        <DashboardStats today={today} metrics={metrics} conversionRate={conversionRate} />

        <DashboardSummary metrics={metrics} />

        {/* Actions */}
        {/* NOTE: bookings/income/barbers/settings sub-screens are not built yet
            (no matching frontend routes exist) — removed those dead links rather
            than navigating to a 404. The underlying data is already available via
            /api/v1/company/bookings, /income, and /barbers if a screen is built later. */}
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
