import { useState, useEffect } from 'react';
import { Building2, Plus, Pencil, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { Modal } from '@/components/ui/modal';

interface Department {
  id: string;
  name: string;
  headId: string | null;
  parentId: string | null;
  status: string;
  _count: { employees: number; assets: number };
}

interface Employee {
  id: string;
  name: string;
}

export default function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: '', headId: '', parentId: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, []);

  async function fetchDepartments() {
    try {
      const { data } = await apiClient.get('/departments');
      setDepartments(data.data);
    } catch (err) {
      console.error('Failed to load departments', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEmployees() {
    try {
      const { data } = await apiClient.get('/employees');
      setEmployees(data.data);
    } catch (err) {
      console.error('Failed to load employees', err);
    }
  }

  const openAddModal = () => {
    setEditingDept(null);
    setFormData({ name: '', headId: '', parentId: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      headId: dept.headId || '',
      parentId: dept.parentId || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        headId: formData.headId || null,
        parentId: formData.parentId || null,
      };

      if (editingDept) {
        await apiClient.patch(`/departments/${editingDept.id}`, payload);
      } else {
        await apiClient.post('/departments', payload);
      }
      setIsModalOpen(false);
      fetchDepartments();
    } catch (err) {
      console.error('Failed to save department', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">Departments</h2>
          <p className="text-sm text-muted-foreground">
            Manage organizational departments and hierarchies.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Department
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Department Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Employees</th>
                <th className="px-4 py-3 font-medium text-right">Assets</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No departments found.
                  </td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr key={dept.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{dept.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          dept.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {dept.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {dept._count?.employees || 0}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {dept._count?.assets || 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(dept)}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDept ? 'Edit Department' : 'Add Department'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Department Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Engineering"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Department Head
            </label>
            <select
              value={formData.headId}
              onChange={(e) => setFormData({ ...formData, headId: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">None</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Parent Department
            </label>
            <select
              value={formData.parentId}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">None (Top Level)</option>
              {departments
                .filter((d) => !editingDept || d.id !== editingDept.id)
                .map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                editingDept ? 'Save Changes' : 'Create Department'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
