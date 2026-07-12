import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, Loader2, CalendarClock } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/badge';
import { Field, Input, Select, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';
import { apiErrorMessage } from '@/lib/format';
import type { Asset, Category, Department } from '@/types';

const ASSET_STATUSES = [
  'AVAILABLE',
  'ALLOCATED',
  'RESERVED',
  'UNDER_MAINTENANCE',
  'LOST',
  'RETIRED',
  'DISPOSED',
];

const emptyForm = {
  name: '',
  categoryId: '',
  serialNumber: '',
  acquisitionDate: '',
  acquisitionCost: '',
  condition: 'Good',
  location: '',
  departmentId: '',
  isBookable: false,
};

export default function AssetsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canRegister = ['ADMIN', 'ASSET_MANAGER'].includes(user?.role ?? '');

  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchAssets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('categoryId', categoryFilter);
      const { data } = await apiClient.get(`/assets?${params.toString()}`);
      setAssets(data.data);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load assets'));
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, categoryFilter]);

  useEffect(() => {
    const t = setTimeout(fetchAssets, q ? 300 : 0); // debounce text search
    return () => clearTimeout(t);
  }, [fetchAssets, q]);

  useEffect(() => {
    apiClient.get('/categories').then(({ data }) => setCategories(data.data)).catch(() => {});
    apiClient.get('/departments').then(({ data }) => setDepartments(data.data)).catch(() => {});
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await apiClient.post('/assets', {
        name: form.name,
        categoryId: form.categoryId,
        serialNumber: form.serialNumber || undefined,
        acquisitionDate: form.acquisitionDate || undefined,
        acquisitionCost: form.acquisitionCost ? Number(form.acquisitionCost) : undefined,
        condition: form.condition || undefined,
        location: form.location || undefined,
        departmentId: form.departmentId || undefined,
        isBookable: form.isBookable,
      });
      toast.success(`Asset registered as ${data.data.assetTag}`);
      setModalOpen(false);
      setForm(emptyForm);
      fetchAssets();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to register asset'));
    } finally {
      setSubmitting(false);
    }
  };

  const statusCounts = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Asset Directory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register, search and track every asset through its lifecycle.
          </p>
        </div>
        {canRegister && (
          <PrimaryButton type="button" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Register Asset
          </PrimaryButton>
        )}
      </div>

      {/* Quick status chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('')}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            statusFilter === ''
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          }`}
        >
          All ({assets.length})
        </button>
        {ASSET_STATUSES.filter((s) => statusFilter === s || statusCounts[s]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {s.replace(/_/g, ' ')} {statusCounts[s] ? `(${statusCounts[s]})` : ''}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, tag AF-…, serial number or location"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-48"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Package className="h-8 w-8" />
            <p className="text-sm font-medium">No assets match your filters</p>
            {canRegister && (
              <button onClick={() => setModalOpen(true)} className="text-sm text-primary hover:underline">
                Register the first asset
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Tag</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Held by</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Bookable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                      {asset.assetTag}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{asset.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{asset.category?.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={asset.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {asset.allocations?.[0]?.holder?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{asset.location ?? '—'}</td>
                    <td className="px-4 py-3">
                      {asset.isBookable ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          <CalendarClock className="h-3.5 w-3.5" /> Yes
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Register New Asset">
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Asset Name" required>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder='e.g. MacBook Pro 14"'
              />
            </Field>
            <Field label="Category" required>
              <Select
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Serial Number">
              <Input
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                placeholder="e.g. SN-88231"
              />
            </Field>
            <Field label="Condition">
              <Select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
              >
                <option>New</option>
                <option>Good</option>
                <option>Fair</option>
                <option>Poor</option>
              </Select>
            </Field>
            <Field label="Acquisition Date">
              <Input
                type="date"
                value={form.acquisitionDate}
                onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })}
              />
            </Field>
            <Field label="Acquisition Cost" hint="For ranking/reports only — not accounting">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.acquisitionCost}
                onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Field label="Location">
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. HQ Floor 2"
              />
            </Field>
            <Field label="Owning Department">
              <Select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              >
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <input
              type="checkbox"
              checked={form.isBookable}
              onChange={(e) => setForm({ ...form, isBookable: e.target.checked })}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            <span className="text-sm text-foreground">
              Shared / bookable resource
              <span className="block text-xs text-muted-foreground">
                Rooms, vehicles, projectors — anything booked by time slot
              </span>
            </span>
          </label>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <SecondaryButton type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" loading={submitting}>
              Register Asset
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
