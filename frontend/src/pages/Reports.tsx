import { useState, useEffect } from 'react';
import { Loader2, Download, TrendingUp, Wrench, CalendarDays, Building2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { apiClient } from '@/lib/apiClient';
import { toast } from '@/components/ui/toast';
import { downloadCsv, titleCase, apiErrorMessage } from '@/lib/format';

// Donut order + colors validated for CVD separation (emerald→blue→amber→violet→red, gray terminal)
const STATUS_ORDER = ['AVAILABLE', 'ALLOCATED', 'UNDER_MAINTENANCE', 'RESERVED', 'LOST', 'RETIRED', 'DISPOSED'];
const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#059669',
  ALLOCATED: '#2563eb',
  UNDER_MAINTENANCE: '#d97706',
  RESERVED: '#7c3aed',
  LOST: '#dc2626',
  RETIRED: '#6b7280',
  DISPOSED: '#9ca3af',
};

const ORANGE = '#f97316';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEATMAP_HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00–20:00

interface Utilization {
  mostUsed: { assetTag: string; name: string; usageCount: number; category: string }[];
  idle: { assetTag: string; name: string; category: string; status: string }[];
  utilizationRate: number;
  statusBreakdown: { status: string; count: number }[];
  totalAllocationsEver: number;
}
interface MaintFreq {
  total: number;
  open: number;
  byCategory: { category: string; count: number }[];
  byAsset: { assetTag: string; name: string; count: number }[];
  byPriority: { priority: string; count: number }[];
}
interface Heatmap {
  grid: number[][];
  totalBookings: number;
}
interface DeptRow {
  name: string;
  status: string;
  employees: number;
  assetsOwned: number;
  activeAllocations: number;
}

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  fontSize: 12,
  color: 'var(--foreground)',
};

export default function ReportsPage() {
  const [util, setUtil] = useState<Utilization | null>(null);
  const [maint, setMaint] = useState<MaintFreq | null>(null);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get('/reports/utilization'),
      apiClient.get('/reports/maintenance-frequency'),
      apiClient.get('/reports/booking-heatmap'),
      apiClient.get('/reports/department-summary'),
    ])
      .then(([u, m, h, d]) => {
        setUtil(u.data.data);
        setMaint(m.data.data);
        setHeatmap(h.data.data);
        setDepts(d.data.data);
      })
      .catch((err) => toast.error(apiErrorMessage(err, 'Failed to load reports')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusData = STATUS_ORDER
    .map((s) => ({
      status: s,
      label: titleCase(s),
      count: util?.statusBreakdown.find((b) => b.status === s)?.count ?? 0,
    }))
    .filter((d) => d.count > 0);
  const totalAssets = statusData.reduce((sum, d) => sum + d.count, 0);

  const maxHeat = Math.max(1, ...(heatmap?.grid.flat() ?? [1]));
  // grid rows are Sun..Sat by day index; display Mon..Sun
  const dayRow = (dayIdx: number) => heatmap?.grid[(dayIdx + 1) % 7] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Utilization, maintenance load and booking patterns across the organization.
          </p>
        </div>
        <button
          onClick={() =>
            downloadCsv(
              'department-summary.csv',
              depts.map((d) => ({
                department: d.name,
                status: d.status,
                employees: d.employees,
                assetsOwned: d.assetsOwned,
                activeAllocations: d.activeAllocations,
              }))
            )
          }
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Download className="h-4 w-4" /> Export Department CSV
        </button>
      </div>

      {/* Headline stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Utilization rate', value: `${util?.utilizationRate ?? 0}%`, icon: TrendingUp, note: 'allocated ÷ active fleet' },
          { label: 'Allocations to date', value: util?.totalAllocationsEver ?? 0, icon: TrendingUp, note: 'lifetime, incl. transfers' },
          { label: 'Open maintenance', value: maint?.open ?? 0, icon: Wrench, note: `${maint?.total ?? 0} requests total` },
          { label: 'Bookings recorded', value: heatmap?.totalBookings ?? 0, icon: CalendarDays, note: 'excluding cancelled' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{c.label}</span>
              <c.icon className="h-4.5 w-4.5 text-muted-foreground/60" />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{c.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Fleet by status — donut */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">Fleet by Lifecycle Status</h2>
          </div>
          <div className="flex flex-wrap items-center gap-6 p-6">
            <div className="relative h-52 w-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={62}
                    outerRadius={95}
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    {statusData.map((d) => (
                      <Cell key={d.status} fill={STATUS_COLORS[d.status]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold text-foreground">{totalAssets}</p>
                <p className="text-xs text-muted-foreground">assets</p>
              </div>
            </div>
            <ul className="flex-1 space-y-2">
              {statusData.map((d) => (
                <li key={d.status} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS[d.status] }} />
                    {d.label}
                  </span>
                  <span className="font-semibold text-foreground">
                    {d.count}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {totalAssets ? Math.round((d.count / totalAssets) * 100) : 0}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Most used assets */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">Most-Used Assets</h2>
            <p className="text-xs text-muted-foreground">Allocations + bookings, lifetime</p>
          </div>
          <div className="p-4">
            {util?.mostUsed.length ? (
              <ResponsiveContainer width="100%" height={Math.max(200, util.mostUsed.slice(0, 8).length * 36)}>
                <BarChart
                  data={util.mostUsed.slice(0, 8)}
                  layout="vertical"
                  margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="2 4" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="assetTag"
                    width={70}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [v ?? 0, 'uses']}
                    labelFormatter={(tag) => {
                      const row = util.mostUsed.find((m) => m.assetTag === tag);
                      return row ? `${tag} — ${row.name}` : String(tag ?? '');
                    }}
                    cursor={{ fill: 'var(--muted)' }}
                  />
                  <Bar dataKey="usageCount" fill={ORANGE} radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No usage yet.</p>
            )}
            {(util?.idle.length ?? 0) > 0 && (
              <p className="mt-2 border-t border-border px-2 pt-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{util!.idle.length} idle asset{util!.idle.length > 1 ? 's' : ''}</span>{' '}
                never allocated or booked:{' '}
                {util!.idle.slice(0, 5).map((i) => i.assetTag).join(', ')}
                {util!.idle.length > 5 && ` +${util!.idle.length - 5} more`}
              </p>
            )}
          </div>
        </div>

        {/* Maintenance frequency by category */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">Maintenance by Category</h2>
          </div>
          <div className="p-4">
            {maint?.byCategory.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={maint.byCategory} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
                  <XAxis dataKey="category" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v ?? 0, 'requests']} cursor={{ fill: 'var(--muted)' }} />
                  <Bar dataKey="count" fill={ORANGE} radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No maintenance requests yet.</p>
            )}
          </div>
        </div>

        {/* Booking heatmap */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">Booking Heatmap</h2>
            <p className="text-xs text-muted-foreground">Peak usage windows, hour × weekday</p>
          </div>
          <div className="overflow-x-auto p-4">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[40px_repeat(14,1fr)] gap-0.5">
                <div />
                {HEATMAP_HOURS.map((h) => (
                  <div key={h} className="pb-1 text-center text-[10px] text-muted-foreground">
                    {h}
                  </div>
                ))}
                {DAYS.map((day, di) => (
                  <div key={day} className="contents">
                    <div className="flex items-center pr-1.5 text-[11px] font-medium text-muted-foreground">
                      {day}
                    </div>
                    {HEATMAP_HOURS.map((h) => {
                      const v = dayRow(di)[h] ?? 0;
                      const alpha = v === 0 ? 0 : 0.15 + 0.85 * (v / maxHeat);
                      return (
                        <div
                          key={h}
                          title={`${day} ${String(h).padStart(2, '0')}:00 — ${v} booking${v === 1 ? '' : 's'}`}
                          className="flex h-7 items-center justify-center rounded-[4px] border border-border/50 text-[10px] font-medium"
                          style={{
                            background: v === 0 ? 'var(--muted)' : `rgba(249, 115, 22, ${alpha})`,
                            color: alpha > 0.55 ? '#fff' : 'var(--muted-foreground)',
                          }}
                        >
                          {v > 0 ? v : ''}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
                Less
                {[0, 0.25, 0.5, 0.75, 1].map((a) => (
                  <span
                    key={a}
                    className="h-3 w-5 rounded-[3px] border border-border/50"
                    style={{ background: a === 0 ? 'var(--muted)' : `rgba(249, 115, 22, ${0.15 + 0.85 * a})` }}
                  />
                ))}
                More
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Department summary */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-6 py-4">
          <Building2 className="h-4.5 w-4.5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Department-wise Allocation Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium text-right">Employees</th>
                <th className="px-4 py-3 font-medium text-right">Assets Owned</th>
                <th className="px-4 py-3 font-medium text-right">Active Allocations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {depts.map((d) => (
                <tr key={d.name} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{d.name}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{d.employees}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{d.assetsOwned}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{d.activeAllocations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
