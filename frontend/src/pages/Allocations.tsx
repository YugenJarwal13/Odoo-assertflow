import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Undo2, Check, X, PackageOpen, ArrowRightLeft } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { Modal } from '@/components/ui/modal';
import { StatusBadge, OverdueBadge } from '@/components/ui/badge';
import { Field, Textarea, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';
import { fmtDate, fmtDateTime, apiErrorMessage, isOverdue } from '@/lib/format';
import type { Allocation, Transfer } from '@/types';

export default function AllocationsPage() {
  const { user } = useAuthStore();
  const isEmployee = user?.role === 'EMPLOYEE';
  const canDecide = ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'].includes(user?.role ?? '');
  const isManager = ['ADMIN', 'ASSET_MANAGER'].includes(user?.role ?? '');

  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'allocations' | 'transfers'>('allocations');

  const [returning, setReturning] = useState<Allocation | null>(null);
  const [returnNote, setReturnNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [allocRes, transferRes] = await Promise.all([
        apiClient.get('/allocations?active=true'),
        apiClient.get('/transfers'),
      ]);
      let allocs: Allocation[] = allocRes.data.data;
      let trans: Transfer[] = transferRes.data.data;
      if (isEmployee) {
        // Employees see their own holdings and transfers involving them
        allocs = allocs.filter((a) => a.holderUserId === user?.id);
        trans = trans.filter((t) => t.fromUserId === user?.id || t.toUserId === user?.id);
      }
      setAllocations(allocs);
      setTransfers(trans);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load allocations'));
    } finally {
      setLoading(false);
    }
  }, [isEmployee, user?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returning) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/allocations/${returning.id}/return`, {
        conditionNoteIn: returnNote || undefined,
      });
      toast.success('Asset returned');
      setReturning(null);
      setReturnNote('');
      fetchAll();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to return asset'));
    } finally {
      setSubmitting(false);
    }
  };

  const decideTransfer = async (transferId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      await apiClient.patch(`/transfers/${transferId}/decision`, { decision });
      toast.success(`Transfer ${decision.toLowerCase()}`);
      fetchAll();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to decide transfer'));
    }
  };

  const overdueCount = allocations.filter((a) => isOverdue(a.expectedReturnAt)).length;
  const pendingTransfers = transfers.filter((t) => t.status === 'REQUESTED').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isEmployee ? 'My Assets & Transfers' : 'Allocations & Transfers'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEmployee
            ? 'Assets currently in your care, and transfer requests involving you.'
            : 'Who holds what, overdue returns, and the transfer approval queue.'}
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Active allocations</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{allocations.length}</p>
        </div>
        <div className={`rounded-xl border p-4 shadow-sm ${overdueCount ? 'border-red-200 bg-red-50' : 'border-border bg-card'}`}>
          <p className={`text-sm ${overdueCount ? 'text-red-700' : 'text-muted-foreground'}`}>Overdue returns</p>
          <p className={`mt-1 text-2xl font-bold ${overdueCount ? 'text-red-700' : 'text-foreground'}`}>{overdueCount}</p>
        </div>
        <div className={`rounded-xl border p-4 shadow-sm ${pendingTransfers ? 'border-amber-200 bg-amber-50' : 'border-border bg-card'}`}>
          <p className={`text-sm ${pendingTransfers ? 'text-amber-700' : 'text-muted-foreground'}`}>Pending transfers</p>
          <p className={`mt-1 text-2xl font-bold ${pendingTransfers ? 'text-amber-700' : 'text-foreground'}`}>{pendingTransfers}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-1 border-b border-border px-4 pt-3">
          <button
            onClick={() => setTab('allocations')}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'allocations' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Active Allocations ({allocations.length})
          </button>
          <button
            onClick={() => setTab('transfers')}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'transfers' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Transfer Requests ({transfers.length})
            {pendingTransfers > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                {pendingTransfers}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tab === 'allocations' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 font-medium">Held By</th>
                  <th className="px-4 py-3 font-medium">Allocated</th>
                  <th className="px-4 py-3 font-medium">Expected Return</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allocations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      <PackageOpen className="mx-auto mb-2 h-8 w-8" />
                      {isEmployee ? 'No assets are currently allocated to you.' : 'No active allocations.'}
                    </td>
                  </tr>
                ) : (
                  allocations.map((a) => {
                    const overdue = isOverdue(a.expectedReturnAt);
                    return (
                      <tr key={a.id} className={overdue ? 'bg-red-50/60' : 'transition-colors hover:bg-muted/50'}>
                        <td className="px-4 py-3">
                          <Link to={`/assets/${a.assetId}`} className="font-medium text-foreground hover:text-primary">
                            {a.asset?.name}
                          </Link>
                          <span className="ml-2 font-mono text-xs text-primary">{a.asset?.assetTag}</span>
                        </td>
                        <td className="px-4 py-3 text-foreground">{a.holder?.name ?? 'Department'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(a.allocatedAt)}</td>
                        <td className="px-4 py-3">
                          <span className={overdue ? 'font-medium text-red-700' : 'text-muted-foreground'}>
                            {fmtDate(a.expectedReturnAt)}
                          </span>{' '}
                          {overdue && <OverdueBadge />}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(isManager || a.holderUserId === user?.id) && (
                            <button
                              onClick={() => setReturning(a)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Return
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 font-medium">From</th>
                  <th className="px-4 py-3 font-medium">To</th>
                  <th className="px-4 py-3 font-medium">Requested</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <ArrowRightLeft className="mx-auto mb-2 h-8 w-8" />
                      No transfer requests yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link to={`/assets/${t.assetId}`} className="font-medium text-foreground hover:text-primary">
                          {t.asset?.name}
                        </Link>
                        <span className="ml-2 font-mono text-xs text-primary">{t.asset?.assetTag}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{t.fromUserName ?? '—'}</td>
                      <td className="px-4 py-3 text-foreground">{t.toUserName ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(t.requestedAt)}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3 text-right">
                        {t.status === 'REQUESTED' && canDecide ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => decideTransfer(t.id, 'APPROVED')}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                            >
                              <Check className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => decideTransfer(t.id, 'REJECTED')}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 transition-colors hover:bg-red-100"
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t.decidedByName ? `by ${t.decidedByName}` : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Return modal */}
      <Modal isOpen={!!returning} onClose={() => setReturning(null)} title="Return Asset">
        <form onSubmit={handleReturn} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Returning <span className="font-medium text-foreground">{returning?.asset?.name}</span> (
            {returning?.asset?.assetTag}) from{' '}
            <span className="font-medium text-foreground">{returning?.holder?.name}</span>.
          </p>
          <Field label="Condition check-in notes">
            <Textarea
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="e.g. Returned in good condition"
            />
          </Field>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <SecondaryButton type="button" onClick={() => setReturning(null)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={submitting}>
              <Undo2 className="h-4 w-4" /> Confirm Return
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
