import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import {
  Package,
  Users,
  AlertTriangle,
  TrendingUp,
  Loader2,
  Activity,
  FileText
} from 'lucide-react';

interface KpiData {
  totalAssets: number;
  totalEmployees: number;
  allocatedAssets: number;
  overdueAllocations: number;
  pendingMaintenance: number;
  activeBookings: number;
  recentActivity: Array<{
    id: string;
    action: string;
    createdAt: string;
    user: { name: string; role: string };
  }>;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKpis() {
      try {
        const response = await apiClient.get('/dashboard/kpis');
        setData(response.data.data);
      } catch (err) {
        console.error('Failed to load KPIs', err);
      } finally {
        setLoading(false);
      }
    }
    fetchKpis();
  }, []);

  const utilizationRate =
    data?.totalAssets && data.totalAssets > 0
      ? Math.round((data.allocatedAssets / data.totalAssets) * 100)
      : 0;

  const kpiCards = [
    { label: 'Total Assets', value: data?.totalAssets ?? '—', icon: Package },
    { label: 'Active Employees', value: data?.totalEmployees ?? '—', icon: Users },
    {
      label: 'Overdue Returns',
      value: data?.overdueAllocations ?? '—',
      icon: AlertTriangle,
      alert: (data?.overdueAllocations ?? 0) > 0,
    },
    { label: 'Utilization Rate', value: `${utilizationRate}%`, icon: TrendingUp },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back, {user?.name?.split(' ')[0] || 'there'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what's happening with your assets today.
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md ${
                  card.alert ? 'border-destructive/40 bg-destructive/5' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {card.label}
                  </span>
                  <card.icon
                    className={`h-4.5 w-4.5 ${
                      card.alert ? 'text-destructive' : 'text-muted-foreground/60'
                    }`}
                  />
                </div>
                <p className={`mt-2 text-2xl font-bold ${card.alert ? 'text-destructive' : 'text-foreground'}`}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Activity */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
              </div>
              <div className="p-6">
                {!data?.recentActivity?.length ? (
                  <p className="text-sm text-muted-foreground">No recent activity found.</p>
                ) : (
                  <ul className="space-y-4">
                    {data.recentActivity.map((activity) => (
                      <li key={activity.id} className="flex gap-4 text-sm">
                        <div className="mt-0.5 flex h-2 w-2 shrink-0 rounded-full bg-primary" />
                        <div>
                          <p className="text-foreground">
                            <span className="font-medium">{activity.user.name}</span>{' '}
                            <span className="text-muted-foreground">did</span>{' '}
                            <span className="font-medium text-foreground">{activity.action}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {new Date(activity.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-foreground">Quick Actions</h2>
              </div>
              <div className="grid gap-3 p-6 sm:grid-cols-2">
                <Link to="/assets" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-6 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                  <Package className="h-5 w-5 text-primary" />
                  Add New Asset
                </Link>
                {user?.role === 'ADMIN' && (
                  <Link to="/org" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-6 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                    <Users className="h-5 w-5 text-emerald-600" />
                    Add Employee
                  </Link>
                )}
                {user?.role === 'ADMIN' && (
                  <Link to="/activity-log" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-6 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                    <Activity className="h-5 w-5 text-blue-600" />
                    View Activity Log
                  </Link>
                )}
                {user?.role === 'ADMIN' && (
                  <Link to="/reports" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-6 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                    <FileText className="h-5 w-5 text-purple-600" />
                    Generate Reports
                  </Link>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
