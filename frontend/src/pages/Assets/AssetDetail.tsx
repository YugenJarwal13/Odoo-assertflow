import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Loader2,
  UserPlus,
  Undo2,
  ArrowRightLeft,
  Wrench,
  AlertTriangle,
  MapPin,
  Tag,
  CircleDollarSign,
  CalendarDays,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { Modal } from '@/components/ui/modal';
import { StatusBadge, OverdueBadge } from '@/components/ui/badge';
import { Field, Input, Select, Textarea, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';
import { fmtDate, fmtDateTime, apiErrorMessage, isOverdue, titleCase } from '@/lib/format';
import type { Asset, Allocation, Transfer, MaintenanceRequest, Employee } from '@/types';

const LIFECYCLE_STEPS = ['AVAILABLE', 'RESERVED', 'ALLOCATED', 'UNDER_MAINTENANCE'];
const TERMINAL_STEPS = ['LOST', 'RETIRED', 'DISPOSED'];

interface History {
  allocations: Allocation[];
  transfers: Transfer[];
  maintenance: MaintenanceRequest[];
}

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isManager = ['ADMIN', 'ASSET_MANAGER'].includes(user?.role ?? '');
  const canAllocate = ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'].includes(user?.role ?? '');

  const [asset, setAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyTab, setHistoryTab] = useState<'allocations' | 'transfers' | 'maintenance'>('allocations');

  // Allocate modal + conflict state
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [allocForm, setAllocForm] = useState({ holderUserId: '', expectedReturnAt: '' });
  const [conflict, setConflict] = useState<{ holderName: string } | null>(null);
  const [transferTarget, setTransferTarget] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNote, setReturnNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeAllocation = asset?.allocations?.[0] ?? null;

  const fetchAll = useCallback(async () => {
    if (!id) return;
    try {
      const [assetRes, histRes] = await Promise.all([
        apiClient.get(`/assets/${id}`),
        apiClient.get(`/assets/${id}/history`),
      ]);
      setAsset(assetRes.data.data);
      setHistory(histRes.data.data);
      const url = await QRCode.toDataURL(
        `${window.location.origin}/assets/${id}?tag=${assetRes.data.data.assetTag}`,
        { width: 160, margin: 1, color: { dark: '#18181B', light: '#FFFFFF' } }
      );
      setQrDataUrl(url);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load asset'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (canAllocate || !isManager) {
      apiClient.get('/employees').then(({ data }) => setEmployees(data.data)).catch(() => {});
    }
  }, [canAllocate, isManager]);

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setConflict(null);
    try {
      await apiClient.post(`/assets/${id}/allocate`, {
        holderUserId: allocForm.holderUserId,
        expectedReturnAt: allocForm.expectedReturnAt || undefined,
      });
      toast.success('Asset allocated');
      setAllocateOpen(false);
      setAllocForm({ holderUserId: '', expectedReturnAt: '' });
      fetchAll();
    } catch (err: unknown) {
      const e409 = err as { response?: { status?: number; data?: { details?: { holderName?: string } } } };
      if (e409?.response?.status === 409) {
        // The conflict rule — show who holds it and offer a transfer request instead
        setConflict({ holderName: e409.response?.data?.details?.holderName ?? 'another holder' });
      } else {
        toast.error(apiErrorMessage(err, 'Failed to allocate'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferRequest = async () => {
    const target = transferTarget || allocForm.holderUserId;
    if (!target) {
      toast.error('Pick who the asset should be transferred to');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post(`/assets/${id}/transfer-request`, { toUserId: target });
      toast.success('Transfer request submitted for approval');
      setAllocateOpen(false);
      setConflict(null);
      fetchAll();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to request transfer'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAllocation) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/allocations/${activeAllocation.id}/return`, {
        conditionNoteIn: returnNote || undefined,
      });
      toast.success('Asset returned — status is back to Available');
      setReturnOpen(false);
      setReturnNote('');
      fetchAll();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to return asset'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!asset) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Asset not found.{' '}
        <Link to="/assets" className="text-primary hover:underline">
          Back to directory
        </Link>
      </div>
    );
  }

  const isTerminal = TERMINAL_STEPS.includes(asset.status);
  const currentStepIdx = LIFECYCLE_STEPS.indexOf(asset.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/assets')}
            className="mt-1 rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{asset.name}</h1>
              <StatusBadge status={asset.status} />
            </div>
            <p className="mt-1 font-mono text-sm font-semibold text-primary">{asset.assetTag}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canAllocate && asset.status === 'AVAILABLE' && (
            <PrimaryButton type="button" onClick={() => { setConflict(null); setAllocateOpen(true); }}>
              <UserPlus className="h-4 w-4" /> Allocate
            </PrimaryButton>
          )}
          {canAllocate && asset.status === 'ALLOCATED' && (
            <SecondaryButton type="button" onClick={() => { setConflict({ holderName: activeAllocation?.holder?.name ?? 'current holder' }); setAllocateOpen(true); }}>
              <ArrowRightLeft className="h-4 w-4" /> Request Transfer
            </SecondaryButton>
          )}
          {activeAllocation && (isManager || activeAllocation.holderUserId === user?.id) && (
            <SecondaryButton type="button" onClick={() => setReturnOpen(true)}>
              <Undo2 className="h-4 w-4" /> Mark Returned
            </SecondaryButton>
          )}
          {!isTerminal && asset.status !== 'UNDER_MAINTENANCE' && (
            <SecondaryButton type="button" onClick={() => navigate(`/maintenance?assetId=${asset.id}`)}>
              <Wrench className="h-4 w-4" /> Raise Maintenance
            </SecondaryButton>
          )}
        </div>
      </div>

      {/* Lifecycle stepper */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lifecycle
        </p>
        {isTerminal ? (
          <div className="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertTriangle className="h-4.5 w-4.5" />
            This asset is {titleCase(asset.status)} — no further transitions except disposal.
          </div>
        ) : (
          <div className="flex items-center">
            {LIFECYCLE_STEPS.map((step, i) => (
              <div key={step} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                      step === asset.status
                        ? 'border-primary bg-primary text-primary-foreground'
                        : i < currentStepIdx
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-muted text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span
                    className={`whitespace-nowrap text-[11px] font-medium ${
                      step === asset.status ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {titleCase(step)}
                  </span>
                </div>
                {i < LIFECYCLE_STEPS.length - 1 && (
                  <div className={`mx-2 mb-5 h-0.5 flex-1 rounded ${i < currentStepIdx ? 'bg-primary/40' : 'bg-border'}`} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Details card */}
        <div className="rounded-xl border border-border bg-card shadow-sm lg:col-span-2">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">Details</h2>
          </div>
          <dl className="grid gap-x-6 gap-y-4 p-6 sm:grid-cols-2">
            {[
              { icon: Tag, label: 'Category', value: asset.category?.name },
              { icon: Tag, label: 'Serial Number', value: asset.serialNumber },
              { icon: CalendarDays, label: 'Acquired', value: fmtDate(asset.acquisitionDate) },
              {
                icon: CircleDollarSign,
                label: 'Acquisition Cost',
                value: asset.acquisitionCost != null ? `₹${asset.acquisitionCost.toLocaleString()}` : '—',
              },
              { icon: Tag, label: 'Condition', value: asset.condition },
              { icon: MapPin, label: 'Location', value: asset.location },
              { icon: Tag, label: 'Department', value: asset.department?.name },
              { icon: CalendarDays, label: 'Bookable resource', value: asset.isBookable ? 'Yes' : 'No' },
            ].map((row) => (
              <div key={row.label} className="flex items-start gap-3">
                <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">{row.value || '—'}</dd>
                </div>
              </div>
            ))}
          </dl>

          {/* Current holder strip */}
          {activeAllocation && (
            <div className="mx-6 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {activeAllocation.holder?.name?.charAt(0) ?? 'D'}
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Currently held by {activeAllocation.holder?.name ?? 'department'}
                  </p>
                  <p className="text-xs text-blue-700">
                    Since {fmtDate(activeAllocation.allocatedAt)}
                    {activeAllocation.expectedReturnAt &&
                      ` · expected back ${fmtDate(activeAllocation.expectedReturnAt)}`}
                  </p>
                </div>
              </div>
              {isOverdue(activeAllocation.expectedReturnAt) && <OverdueBadge />}
            </div>
          )}
        </div>

        {/* QR card */}
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Asset QR
          </p>
          {qrDataUrl && (
            <img src={qrDataUrl} alt={`QR code for ${asset.assetTag}`} className="rounded-lg border border-border" />
          )}
          <p className="font-mono text-sm font-bold text-foreground">{asset.assetTag}</p>
          <p className="text-center text-xs text-muted-foreground">
            Scan to open this asset from any device
          </p>
        </div>
      </div>

      {/* History */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-1 border-b border-border px-4 pt-3">
          {(['allocations', 'transfers', 'maintenance'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setHistoryTab(tab)}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                historyTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {titleCase(tab)} (
              {tab === 'allocations'
                ? history?.allocations.length ?? 0
                : tab === 'transfers'
                  ? history?.transfers.length ?? 0
                  : history?.maintenance.length ?? 0}
              )
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          {historyTab === 'allocations' && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Holder</th>
                  <th className="px-4 py-3 font-medium">Allocated</th>
                  <th className="px-4 py-3 font-medium">Expected Return</th>
                  <th className="px-4 py-3 font-medium">Returned</th>
                  <th className="px-4 py-3 font-medium">Check-in Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!history?.allocations.length ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Never allocated.</td></tr>
                ) : (
                  history.allocations.map((a) => (
                    <tr key={a.id} className={a.isActive ? 'bg-blue-50/40' : ''}>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {a.holder?.name ?? 'Department'}
                        {a.isActive && <span className="ml-2 text-xs font-semibold text-blue-600">current</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(a.allocatedAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {fmtDate(a.expectedReturnAt)}{' '}
                        {a.isActive && isOverdue(a.expectedReturnAt) && <OverdueBadge />}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(a.returnedAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.conditionNoteIn ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
          {historyTab === 'transfers' && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">From</th>
                  <th className="px-4 py-3 font-medium">To</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Requested</th>
                  <th className="px-4 py-3 font-medium">Decided By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!history?.transfers.length ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No transfers.</td></tr>
                ) : (
                  history.transfers.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3 text-foreground">{t.fromUserName ?? '—'}</td>
                      <td className="px-4 py-3 text-foreground">{t.toUserName ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(t.requestedAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.decidedByName ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
          {historyTab === 'maintenance' && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Issue</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Raised By</th>
                  <th className="px-4 py-3 font-medium">Raised</th>
                  <th className="px-4 py-3 font-medium">Resolved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!history?.maintenance.length ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No maintenance history.</td></tr>
                ) : (
                  history.maintenance.map((m) => (
                    <tr key={m.id}>
                      <td className="max-w-64 truncate px-4 py-3 text-foreground">{m.issue}</td>
                      <td className="px-4 py-3"><StatusBadge status={m.priority} /></td>
                      <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{m.raisedBy?.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(m.createdAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(m.resolvedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Allocate / Transfer modal */}
      <Modal
        isOpen={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        title={conflict ? 'Asset Already Held' : 'Allocate Asset'}
      >
        {conflict ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {asset.assetTag} is currently held by {conflict.holderName}
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  It can't be allocated twice. Submit a transfer request instead — an Asset Manager
                  or Department Head will approve it and the history updates automatically.
                </p>
              </div>
            </div>
            <Field label="Transfer to" required>
              <Select value={transferTarget || allocForm.holderUserId} onChange={(e) => setTransferTarget(e.target.value)}>
                <option value="">Select employee…</option>
                {employees
                  .filter((emp) => emp.status === 'ACTIVE' && emp.id !== activeAllocation?.holderUserId)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.department?.name ?? 'No dept'}
                    </option>
                  ))}
              </Select>
            </Field>
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <SecondaryButton type="button" onClick={() => setAllocateOpen(false)}>Cancel</SecondaryButton>
              <PrimaryButton type="button" loading={submitting} onClick={handleTransferRequest}>
                <ArrowRightLeft className="h-4 w-4" /> Request Transfer
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAllocate} className="space-y-4">
            <Field label="Allocate to" required>
              <Select
                required
                value={allocForm.holderUserId}
                onChange={(e) => setAllocForm({ ...allocForm, holderUserId: e.target.value })}
              >
                <option value="">Select employee…</option>
                {employees
                  .filter((emp) => emp.status === 'ACTIVE')
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.department?.name ?? 'No dept'}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Expected Return Date" hint="Leave empty for open-ended allocations">
              <Input
                type="date"
                value={allocForm.expectedReturnAt}
                onChange={(e) => setAllocForm({ ...allocForm, expectedReturnAt: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <SecondaryButton type="button" onClick={() => setAllocateOpen(false)}>Cancel</SecondaryButton>
              <PrimaryButton type="submit" loading={submitting}>
                <UserPlus className="h-4 w-4" /> Allocate
              </PrimaryButton>
            </div>
          </form>
        )}
      </Modal>

      {/* Return modal */}
      <Modal isOpen={returnOpen} onClose={() => setReturnOpen(false)} title="Return Asset">
        <form onSubmit={handleReturn} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Confirm the return of <span className="font-medium text-foreground">{asset.name}</span>{' '}
            ({asset.assetTag}) from{' '}
            <span className="font-medium text-foreground">{activeAllocation?.holder?.name}</span>.
            The asset will revert to <StatusBadge status="AVAILABLE" />.
          </p>
          <Field label="Condition check-in notes">
            <Textarea
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="e.g. Minor scratches on the lid, charger included"
            />
          </Field>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <SecondaryButton type="button" onClick={() => setReturnOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={submitting}>
              <Undo2 className="h-4 w-4" /> Confirm Return
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
