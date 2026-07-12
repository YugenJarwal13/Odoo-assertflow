import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Plus, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/badge';
import { Field, Input, Select, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';
import { fmtDate, apiErrorMessage } from '@/lib/format';
import type { AuditCycle, Department, Employee } from '@/types';

export default function AuditsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canManage = ['ADMIN', 'ASSET_MANAGER'].includes(user?.role ?? '');

  const [cycles, setCycles] = useState<AuditCycle[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ scopeDept: '', scopeLoc: '', startDate: '', endDate: '' });
  const [auditorIds, setAuditorIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchCycles = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/audits');
      let list: AuditCycle[] = data.data;
      if (!canManage) {
        // Non-managers only see cycles they're assigned to as auditor
        list = list.filter((c) => c.assignments.some((a) => a.auditorId === user?.id));
      }
      setCycles(list);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load audit cycles'));
    } finally {
      setLoading(false);
    }
  }, [canManage, user?.id]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  useEffect(() => {
    if (!canManage) return;
    apiClient.get('/departments').then(({ data }) => setDepartments(data.data)).catch(() => {});
    apiClient.get('/employees').then(({ data }) => setEmployees(data.data)).catch(() => {});
  }, [canManage]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await apiClient.post('/audits', {
        scopeDept: form.scopeDept || undefined,
        scopeLoc: form.scopeLoc || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        auditorIds,
      });
      toast.success(`Audit cycle created with ${data.data.items.length} assets in scope`);
      setModalOpen(false);
      setForm({ scopeDept: '', scopeLoc: '', startDate: '', endDate: '' });
      setAuditorIds([]);
      fetchCycles();
      navigate(`/audits/${data.data.id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to create audit cycle'));
    } finally {
      setSubmitting(false);
    }
  };

  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Asset Audits</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Structured verification cycles — assign auditors, verify every asset, close with an
            auto-generated discrepancy report.
          </p>
        </div>
        {canManage && (
          <PrimaryButton type="button" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> New Audit Cycle
          </PrimaryButton>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : cycles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <ClipboardCheck className="h-8 w-8" />
            <p className="text-sm font-medium">
              {canManage ? 'No audit cycles yet' : 'You are not assigned to any audit cycle'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Auditors</th>
                  <th className="px-4 py-3 font-medium text-right">Assets</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cycles.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/audits/${c.id}`)}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {deptName(c.scopeDept) ?? c.scopeLoc ?? 'Organization-wide'}
                      {c.scopeLoc && deptName(c.scopeDept) && (
                        <span className="text-muted-foreground"> · {c.scopeLoc}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.assignments.map((a) => a.auditor?.name).filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{c._count?.items ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create cycle modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Audit Cycle">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Scope: Department" hint="Empty = all departments">
              <Select value={form.scopeDept} onChange={(e) => setForm({ ...form, scopeDept: e.target.value })}>
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Scope: Location" hint="Empty = all locations">
              <Input
                value={form.scopeLoc}
                onChange={(e) => setForm({ ...form, scopeLoc: e.target.value })}
                placeholder="e.g. HQ Floor 2"
              />
            </Field>
            <Field label="Start date" required>
              <Input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="End date" required>
              <Input
                type="date"
                required
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Assign auditors" hint="Auditors verify each asset in scope">
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {employees
                .filter((emp) => emp.status === 'ACTIVE')
                .map((emp) => (
                  <label
                    key={emp.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={auditorIds.includes(emp.id)}
                      onChange={(e) =>
                        setAuditorIds((ids) =>
                          e.target.checked ? [...ids, emp.id] : ids.filter((i) => i !== emp.id)
                        )
                      }
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    <span className="text-foreground">{emp.name}</span>
                    <span className="text-xs text-muted-foreground">{emp.department?.name}</span>
                  </label>
                ))}
            </div>
          </Field>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <SecondaryButton type="button" onClick={() => setModalOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={submitting}>
              <ClipboardCheck className="h-4 w-4" /> Create Cycle
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
