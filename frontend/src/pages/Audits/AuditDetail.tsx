import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Lock,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  UserPlus,
  FileWarning,
  Download,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/badge';
import { Field, Select, Textarea, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';
import { fmtDate, apiErrorMessage, downloadCsv } from '@/lib/format';
import type { AuditCycle, AuditItem, Employee } from '@/types';

export default function AuditDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canManage = ['ADMIN', 'ASSET_MANAGER'].includes(user?.role ?? '');

  const [cycle, setCycle] = useState<AuditCycle | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [newAuditorId, setNewAuditorId] = useState('');
  const [noting, setNoting] = useState<{ item: AuditItem; result: 'MISSING' | 'DAMAGED' } | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAuditor = cycle?.assignments.some((a) => a.auditorId === user?.id) ?? false;
  const canMark = (isAuditor || user?.role === 'ADMIN') && cycle?.status === 'OPEN';

  const fetchCycle = useCallback(async () => {
    try {
      const { data } = await apiClient.get(`/audits/${id}`);
      setCycle(data.data);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load audit cycle'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCycle();
  }, [fetchCycle]);

  useEffect(() => {
    if (canManage) {
      apiClient.get('/employees').then(({ data }) => setEmployees(data.data)).catch(() => {});
    }
  }, [canManage]);

  const markItem = async (item: AuditItem, result: 'VERIFIED' | 'MISSING' | 'DAMAGED', noteText?: string) => {
    try {
      await apiClient.patch(`/audits/${id}/items/${item.id}`, { result, note: noteText });
      fetchCycle();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to mark item'));
    }
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noting) return;
    setSubmitting(true);
    await markItem(noting.item, noting.result, note || undefined);
    setNoting(null);
    setNote('');
    setSubmitting(false);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post(`/audits/${id}/assign-auditor`, { auditorId: newAuditorId });
      toast.success('Auditor assigned');
      setAssignOpen(false);
      setNewAuditorId('');
      fetchCycle();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to assign auditor'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    setSubmitting(true);
    try {
      const { data } = await apiClient.post(`/audits/${id}/close`);
      const missing = data.data.items.filter((i: AuditItem) => i.result === 'MISSING').length;
      toast.success(
        missing
          ? `Cycle closed — ${missing} missing asset${missing > 1 ? 's' : ''} marked as Lost`
          : 'Cycle closed — no discrepancies'
      );
      fetchCycle();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to close cycle'));
    } finally {
      setSubmitting(false);
    }
  };

  const exportDiscrepancies = () => {
    if (!cycle?.discrepancies?.length) return;
    downloadCsv(
      `audit-discrepancies-${cycle.id.slice(-6)}.csv`,
      cycle.discrepancies.map((d) => ({
        assetTag: d.asset?.assetTag,
        assetName: d.asset?.name,
        result: d.result,
        note: d.note ?? '',
        location: d.asset?.location ?? '',
        currentStatus: d.asset?.status,
      }))
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!cycle) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Audit cycle not found.{' '}
        <Link to="/audits" className="text-primary hover:underline">Back to audits</Link>
      </div>
    );
  }

  const items = cycle.items ?? [];
  const counts = {
    total: items.length,
    verified: items.filter((i) => i.result === 'VERIFIED').length,
    missing: items.filter((i) => i.result === 'MISSING').length,
    damaged: items.filter((i) => i.result === 'DAMAGED').length,
    pending: items.filter((i) => i.result === 'PENDING').length,
  };
  const progress = counts.total ? Math.round(((counts.total - counts.pending) / counts.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/audits')}
            className="mt-1 rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit Cycle</h1>
              <StatusBadge status={cycle.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {fmtDate(cycle.startDate)} → {fmtDate(cycle.endDate)}
              {cycle.scopeLoc && ` · Location: ${cycle.scopeLoc}`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Auditors: {cycle.assignments.map((a) => a.auditor?.name).filter(Boolean).join(', ') || 'none assigned'}
            </p>
          </div>
        </div>
        {canManage && cycle.status === 'OPEN' && (
          <div className="flex flex-wrap gap-2">
            <SecondaryButton type="button" onClick={() => setAssignOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add Auditor
            </SecondaryButton>
            <PrimaryButton
              type="button"
              loading={submitting}
              disabled={counts.pending > 0}
              onClick={handleClose}
            >
              <Lock className="h-4 w-4" /> Close Cycle
            </PrimaryButton>
          </div>
        )}
      </div>

      {counts.pending > 0 && cycle.status === 'OPEN' && canManage && (
        <p className="text-xs text-muted-foreground">
          Every asset must be marked before the cycle can be closed ({counts.pending} remaining).
        </p>
      )}

      {/* Progress + counters */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:col-span-1">
          <p className="text-sm text-muted-foreground">Progress</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{progress}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {[
          { label: 'Verified', value: counts.verified, cls: 'text-emerald-600' },
          { label: 'Missing', value: counts.missing, cls: 'text-red-600' },
          { label: 'Damaged', value: counts.damaged, cls: 'text-amber-600' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.cls}`}>{c.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">of {counts.total} assets</p>
          </div>
        ))}
      </div>

      {/* Discrepancy report */}
      {(cycle.discrepancies?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 shadow-sm">
          <div className="flex items-center justify-between border-b border-red-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <FileWarning className="h-4.5 w-4.5 text-red-600" />
              <h2 className="text-base font-semibold text-red-900">
                Discrepancy Report ({cycle.discrepancies!.length})
              </h2>
            </div>
            <button
              onClick={exportDiscrepancies}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
          <ul className="divide-y divide-red-100">
            {cycle.discrepancies!.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3">
                <div>
                  <Link to={`/assets/${d.assetId}`} className="text-sm font-medium text-red-900 hover:underline">
                    {d.asset?.assetTag} — {d.asset?.name}
                  </Link>
                  {d.note && <p className="text-xs text-red-700">“{d.note}”</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.result} />
                  {cycle.status === 'CLOSED' && d.result === 'MISSING' && (
                    <span className="text-xs text-red-700">→ asset marked</span>
                  )}
                  {cycle.status === 'CLOSED' && d.result === 'MISSING' && <StatusBadge status="LOST" />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Items table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Assets in Scope</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium">Note</th>
                {canMark && <th className="px-4 py-3 font-medium text-right">Mark as</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link to={`/assets/${item.assetId}`} className="font-medium text-foreground hover:text-primary">
                      {item.asset?.name}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-primary">{item.asset?.assetTag}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.asset?.location ?? '—'}</td>
                  <td className="px-4 py-3">
                    {item.result === 'PENDING' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <HelpCircle className="h-3.5 w-3.5" /> Not verified yet
                      </span>
                    ) : (
                      <StatusBadge status={item.result} />
                    )}
                  </td>
                  <td className="max-w-48 truncate px-4 py-3 text-muted-foreground" title={item.note ?? ''}>
                    {item.note ?? '—'}
                  </td>
                  {canMark && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => markItem(item, 'VERIFIED')}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                            item.result === 'VERIFIED'
                              ? 'bg-emerald-600 text-white'
                              : 'border border-border text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                        </button>
                        <button
                          onClick={() => { setNoting({ item, result: 'MISSING' }); setNote(item.note ?? ''); }}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                            item.result === 'MISSING'
                              ? 'bg-red-600 text-white'
                              : 'border border-border text-muted-foreground hover:bg-red-50 hover:text-red-700'
                          }`}
                        >
                          <ShieldAlert className="h-3.5 w-3.5" /> Missing
                        </button>
                        <button
                          onClick={() => { setNoting({ item, result: 'DAMAGED' }); setNote(item.note ?? ''); }}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                            item.result === 'DAMAGED'
                              ? 'bg-amber-500 text-white'
                              : 'border border-border text-muted-foreground hover:bg-amber-50 hover:text-amber-700'
                          }`}
                        >
                          <FileWarning className="h-3.5 w-3.5" /> Damaged
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Discrepancy note modal */}
      <Modal
        isOpen={!!noting}
        onClose={() => setNoting(null)}
        title={`Mark ${noting?.item.asset?.assetTag} as ${noting?.result}`}
      >
        <form onSubmit={handleNoteSubmit} className="space-y-4">
          <Field label="Note" hint="What did you find? This appears on the discrepancy report.">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                noting?.result === 'MISSING'
                  ? 'e.g. Not found at registered location, checked storage too'
                  : 'e.g. Cracked screen, hinge broken'
              }
            />
          </Field>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <SecondaryButton type="button" onClick={() => setNoting(null)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={submitting}>Confirm {noting?.result}</PrimaryButton>
          </div>
        </form>
      </Modal>

      {/* Assign auditor modal */}
      <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)} title="Add Auditor">
        <form onSubmit={handleAssign} className="space-y-4">
          <Field label="Auditor" required>
            <Select required value={newAuditorId} onChange={(e) => setNewAuditorId(e.target.value)}>
              <option value="">Select employee…</option>
              {employees
                .filter((emp) => emp.status === 'ACTIVE' && !cycle.assignments.some((a) => a.auditorId === emp.id))
                .map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} — {emp.department?.name ?? 'No dept'}
                  </option>
                ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <SecondaryButton type="button" onClick={() => setAssignOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={submitting}>
              <UserPlus className="h-4 w-4" /> Assign
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
