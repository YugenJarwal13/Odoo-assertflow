import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import { OverdueBadge } from '@/components/ui/badge';
import { fmtDate, titleCase } from '@/lib/format';
import {
  Package,
  PackageCheck,
  Wrench,
  CalendarDays,
  ArrowRightLeft,
  Undo2,
  AlertTriangle,
  Loader2,
  Plus,
  Activity,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#059669',
  ALLOCATED: '#2563eb',
  UNDER_MAINTENANCE: '#d97706',
  RESERVED: '#7c3aed',
  LOST: '#dc2626',
  RETIRED: '#6b7280',
  DISPOSED: '#9ca3af',
};

interface KpiData {
  totalAssets: number;
  availableAssets: number;
  totalEmployees: number;
  allocatedAssets: number;
  overdueAllocations: number;
  overdueList: {
    id: string;
    expectedReturnAt: string;
    asset: { id: string; assetTag: string; name: string };
    holder: { id: string; name: string } | null;
  }[];
  upcomingReturns: number;
  pendingMaintenance: number;
  maintenanceToday: number;
  activeBookings: number;
  pendingTransfers: number;
  assetsByStatus: { status: string; count: number }[];
  departmentSummary: { id: string; name: string; employeeCount: number; assetCount: number }[];
  recentActivity: {
    id: string;
    action: string;
    createdAt: string;
    user: { name: string; role: string };
  }[];
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const isManager = ['ADMIN', 'ASSET_MANAGER'].includes(user?.role ?? '');

  useEffect(() => {
    apiClient
      .get('/dashboard/kpis')
      .then((res) => setData(res.data.data))
      .catch((err) => console.error('Failed to load KPIs', err))
      .finally(() => setLoading(false));
  }, []);

  const kpiCards = [
    { label: 'Assets Available', value: data?.availableAssets, icon: Package, to: '/assets?status=AVAILABLE' },
    { label: 'Assets Allocated', value: data?.allocatedAssets, icon: PackageCheck, to: '/allocations' },
    { label: 'Maintenance Today', value: data?.maintenanceToday, icon: Wrench, to: '/maintenance' },
    { label: 'Active Bookings', value: data?.activeBookings, icon: CalendarDays, to: '/bookings' },
    { label: 'Pending Transfers', value: data?.pendingTransfers, icon: ArrowRightLeft, to: '/allocations', highlight: (data?.pendingTransfers ?? 0) > 0 },
    { label: 'Upcoming Returns', value: data?.upcomingReturns, icon: Undo2, to: '/allocations', note: 'next 7 days' },
  ];

  const quickActions = [
    ...(isManager ? [{ label: 'Register Asset', icon: Package, to: '/assets' }] : []),
    { label: 'Book Resource', icon: CalendarDays, to: '/bookings' },
    { label: 'Raise Maintenance', icon: Wrench, to: '/maintenance' },
  ];

  const totalByStatus = data?.assetsByStatus.reduce((s, x) => s + x.count, 0) ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {user?.name?.split(' ')[0] || 'there'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's your operational snapshot for today.
          </p>
        </div>
        <div className="flex gap-2">
          {quickActions.map((qa) => (
            <Link
              key={qa.label}
              to={qa.to}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              {qa.label}
            </Link>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* KPI Grid — the six cards from the spec */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {kpiCards.map((card) => (
              <Link
                key={card.label}
                to={card.to}
                className={`group rounded-xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  card.highlight ? 'border-amber-300 bg-amber-50' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center justify-between">
                  <card.icon
                    className={`h-4.5 w-4.5 ${card.highlight ? 'text-amber-600' : 'text-muted-foreground/60 group-hover:text-primary'}`}
                  />
                  {card.note && <span className="text-[10px] text-muted-foreground">{card.note}</span>}
                </div>
                <p className={`mt-3 text-2xl font-bold ${card.highlight ? 'text-amber-700' : 'text-foreground'}`}>
                  {card.value ?? '—'}
                </p>
                <p className={`mt-0.5 text-xs font-medium ${card.highlight ? 'text-amber-700' : 'text-muted-foreground'}`}>
                  {card.label}
                </p>
              </Link>
            ))}
          </div>

          {/* Overdue returns — highlighted separately from upcoming ones */}
          {(data?.overdueAllocations ?? 0) > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/70 shadow-sm">
              <div className="flex items-center gap-2 border-b border-red-200 px-6 py-4">
                <AlertTriangle className="h-4.5 w-4.5 text-red-600" />
                <h2 className="text-base font-semibold text-red-900">
                  {data!.overdueAllocations} Overdue Return{data!.overdueAllocations > 1 ? 's' : ''}
                </h2>
                <Link to="/allocations" className="ml-auto text-xs font-medium text-red-700 hover:underline">
                  View all →
                </Link>
              </div>
              <ul className="divide-y divide-red-100">
                {data!.overdueList.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3">
                    <div>
                      <Link to={`/assets/${o.asset.id}`} className="text-sm font-medium text-red-900 hover:underline">
                        {o.asset.assetTag} — {o.asset.name}
                      </Link>
                      <p className="text-xs text-red-700">
                        Held by {o.holder?.name ?? 'department'} · due {fmtDate(o.expectedReturnAt)}
                      </p>
                    </div>
                    <OverdueBadge />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Fleet by status */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-foreground">Fleet by Status</h2>
              </div>
              <div className="space-y-3 p-6">
                {!data?.assetsByStatus.length ? (
                  <p className="text-sm text-muted-foreground">No assets registered yet.</p>
                ) : (
                  data.assetsByStatus
                    .slice()
                    .sort((a, b) => b.count - a.count)
                    .map((s) => (
                      <div key={s.status}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-foreground">
                            <span
                              className="h-2.5 w-2.5 rounded-sm"
                              style={{ background: STATUS_COLORS[s.status] ?? '#9ca3af' }}
                            />
                            {titleCase(s.status)}
                          </span>
                          <span className="font-semibold text-foreground">{s.count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${totalByStatus ? (s.count / totalByStatus) * 100 : 0}%`,
                              background: STATUS_COLORS[s.status] ?? '#9ca3af',
                            }}
                          />
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
                {user?.role === 'ADMIN' && (
                  <Link to="/activity-log" className="text-xs font-medium text-primary hover:underline">
                    Full log →
                  </Link>
                )}
              </div>
              <div className="p-6">
                {!data?.recentActivity?.length ? (
                  <p className="text-sm text-muted-foreground">No recent activity found.</p>
                ) : (
                  <ul className="space-y-4">
                    {data.recentActivity.slice(0, 7).map((activity) => (
                      <li key={activity.id} className="flex gap-3 text-sm">
                        <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="truncate text-foreground">
                            <span className="font-medium">{activity.user.name}</span>{' '}
                            <span className="text-muted-foreground">·</span>{' '}
                            <span className="font-medium">{titleCase(activity.action)}</span>
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

            {/* Department summary */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-foreground">Departments</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-4 py-2.5 text-right font-medium">People</th>
                      <th className="px-4 py-2.5 text-right font-medium">Assets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {!data?.departmentSummary.length ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                          No departments yet.
                        </td>
                      </tr>
                    ) : (
                      data.departmentSummary.map((d) => (
                        <tr key={d.id}>
                          <td className="px-4 py-2.5 font-medium text-foreground">{d.name}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{d.employeeCount}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{d.assetCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Pending approvals strip for managers */}
          {isManager && ((data?.pendingMaintenance ?? 0) > 0 || (data?.pendingTransfers ?? 0) > 0) && (
            <div className="flex flex-wrap gap-3">
              {(data?.pendingMaintenance ?? 0) > 0 && (
                <Link
                  to="/maintenance?status=PENDING"
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
                >
                  <Wrench className="h-4 w-4" />
                  {data!.pendingMaintenance} maintenance request{data!.pendingMaintenance > 1 ? 's' : ''} awaiting approval
                </Link>
              )}
              {(data?.pendingTransfers ?? 0) > 0 && (
                <Link
                  to="/allocations"
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  {data!.pendingTransfers} transfer{data!.pendingTransfers > 1 ? 's' : ''} awaiting decision
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
