import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Wrench, Plus, Loader2, Check, X, UserCog, Play, CheckCheck } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/badge';
import { Field, Input, Select, Textarea, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';
import { fmtDateTime, apiErrorMessage, titleCase } from '@/lib/format';
import type { Asset, MaintenanceRequest } from '@/types';

const WORKFLOW: Record<string, string> = {
  PENDING: 'Awaiting Asset Manager approval',
  APPROVED: 'Approved — asset moved to Under Maintenance',
  TECHNICIAN_ASSIGNED: 'Technician assigned, work not started',
  IN_PROGRESS: 'Repair in progress',
  RESOLVED: 'Resolved — asset restored',
  REJECTED: 'Rejected by Asset Manager',
};

const STATUS_FILTERS = ['', 'PENDING', 'APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

export default function MaintenancePage() {
  const { user } = useAuthStore();
  const isManager = ['ADMIN', 'ASSET_MANAGER'].includes(user?.role ?? '');
  const [searchParams] = useSearchParams();

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [form, setForm] = useState({ assetId: searchParams.get('assetId') ?? '', issue: '', priority: 'MEDIUM' });
  const [assigning, setAssigning] = useState<MaintenanceRequest | null>(null);
  const [technicianName, setTechnicianName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (!isManager) params.set('mine', 'true');
      const { data } = await apiClient.get(`/maintenance?${params.toString()}`);
      setRequests(data.data);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load maintenance requests'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, isManager]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    apiClient.get('/assets').then(({ data }) => setAssets(data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    // Deep link from asset detail: /maintenance?assetId=…
    if (searchParams.get('assetId')) setRaiseOpen(true);
  }, [searchParams]);

  const handleRaise = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post('/maintenance', form);
      toast.success('Maintenance request submitted for approval');
      setRaiseOpen(false);
      setForm({ assetId: '', issue: '', priority: 'MEDIUM' });
      fetchRequests();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to raise request'));
    } finally {
      setSubmitting(false);
    }
  };

  const act = async (url: string, body: Record<string, unknown>, successMsg: string) => {
    try {
      await apiClient.patch(url, body);
      toast.success(successMsg);
      fetchRequests();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Action failed'));
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigning) return;
    setSubmitting(true);
    try {
      await apiClient.patch(`/maintenance/${assigning.id}/assign-technician`, { technicianName });
      toast.success(`Technician ${technicianName} assigned`);
      setAssigning(null);
      setTechnicianName('');
      fetchRequests();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to assign technician'));
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Maintenance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Repairs are routed through approval before work starts — assets flip to Under
            Maintenance automatically.
          </p>
        </div>
        <PrimaryButton type="button" onClick={() => setRaiseOpen(true)}>
          <Plus className="h-4 w-4" /> Raise Request
        </PrimaryButton>
      </div>

      {isManager && pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Wrench className="h-4.5 w-4.5 text-amber-600" />
          <p className="text-sm font-medium text-amber-900">
            {pendingCount} request{pendingCount > 1 ? 's' : ''} awaiting your approval
          </p>
        </div>
      )}

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {s ? titleCase(s) : 'All'}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Wrench className="h-8 w-8" />
            <p className="text-sm font-medium">No maintenance requests</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 font-medium">Issue</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Raised By</th>
                  <th className="px-4 py-3 font-medium">Technician</th>
                  <th className="px-4 py-3 font-medium">Raised</th>
                  {isManager && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link to={`/assets/${r.assetId}`} className="font-medium text-foreground hover:text-primary">
                        {r.asset?.name}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-primary">{r.asset?.assetTag}</span>
                    </td>
                    <td className="max-w-56 px-4 py-3">
                      <p className="truncate text-foreground" title={r.issue}>{r.issue}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.priority} /></td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                      <p className="mt-1 text-[11px] text-muted-foreground">{WORKFLOW[r.status]}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.raisedBy?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.technicianName ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(r.createdAt)}</td>
                    {isManager && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {r.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => act(`/maintenance/${r.id}/decision`, { decision: 'APPROVED' }, 'Request approved — asset is Under Maintenance')}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                              >
                                <Check className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => act(`/maintenance/${r.id}/decision`, { decision: 'REJECTED' }, 'Request rejected')}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 transition-colors hover:bg-red-100"
                              >
                                <X className="h-3.5 w-3.5" /> Reject
                              </button>
                            </>
                          )}
                          {r.status === 'APPROVED' && (
                            <button
                              onClick={() => { setAssigning(r); setTechnicianName(''); }}
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                            >
                              <UserCog className="h-3.5 w-3.5" /> Assign Technician
                            </button>
                          )}
                          {r.status === 'TECHNICIAN_ASSIGNED' && (
                            <button
                              onClick={() => act(`/maintenance/${r.id}/start`, {}, 'Work started')}
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                            >
                              <Play className="h-3.5 w-3.5" /> Start Work
                            </button>
                          )}
                          {['TECHNICIAN_ASSIGNED', 'IN_PROGRESS'].includes(r.status) && (
                            <button
                              onClick={() => act(`/maintenance/${r.id}/resolve`, {}, 'Resolved — asset restored')}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                            >
                              <CheckCheck className="h-3.5 w-3.5" /> Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Raise request modal */}
      <Modal isOpen={raiseOpen} onClose={() => setRaiseOpen(false)} title="Raise Maintenance Request">
        <form onSubmit={handleRaise} className="space-y-4">
          <Field label="Asset" required>
            <Select
              required
              value={form.assetId}
              onChange={(e) => setForm({ ...form, assetId: e.target.value })}
            >
              <option value="">Select asset…</option>
              {assets
                .filter((a) => !['LOST', 'RETIRED', 'DISPOSED', 'UNDER_MAINTENANCE'].includes(a.status))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.assetTag} — {a.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Issue description" required>
            <Textarea
              required
              value={form.issue}
              onChange={(e) => setForm({ ...form, issue: e.target.value })}
              placeholder="Describe the problem — what's broken, when it started…"
            />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <SecondaryButton type="button" onClick={() => setRaiseOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={submitting}>
              <Wrench className="h-4 w-4" /> Submit Request
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      {/* Assign technician modal */}
      <Modal isOpen={!!assigning} onClose={() => setAssigning(null)} title="Assign Technician">
        <form onSubmit={handleAssign} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Assign a technician for <span className="font-medium text-foreground">{assigning?.asset?.name}</span>{' '}
            ({assigning?.asset?.assetTag}).
          </p>
          <Field label="Technician name" required>
            <Input
              required
              value={technicianName}
              onChange={(e) => setTechnicianName(e.target.value)}
              placeholder="e.g. Ravi from TechCare Services"
            />
          </Field>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <SecondaryButton type="button" onClick={() => setAssigning(null)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={submitting}>
              <UserCog className="h-4 w-4" /> Assign
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
