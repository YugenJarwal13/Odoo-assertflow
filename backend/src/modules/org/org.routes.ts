import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import * as orgService from './org.service.js';

const router = Router();

// ─── Departments ─────────────────────────────────────────────

// GET /api/departments — any authenticated user
router.get('/departments', requireAuth, async (_req, res) => {
  try {
    const departments = await orgService.listDepartments();
    res.json({ data: departments });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list departments';
    res.status(500).json({ error: message });
  }
});

// POST /api/departments — ADMIN only
router.post('/departments', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { name, headId, parentId } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Department name is required' });
      return;
    }
    const dept = await orgService.createDepartment(req.user!.id, { name, headId, parentId });
    res.status(201).json({ data: dept });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create department';
    res.status(400).json({ error: message });
  }
});

// PATCH /api/departments/:id — ADMIN only
router.patch('/departments/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { name, headId, parentId, status } = req.body;
    const dept = await orgService.updateDepartment(req.user!.id, req.params.id, {
      name,
      headId,
      parentId,
      status,
    });
    res.json({ data: dept });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update department';
    res.status(400).json({ error: message });
  }
});

// ─── Categories ──────────────────────────────────────────────

// GET /api/categories — any authenticated user
router.get('/categories', requireAuth, async (_req, res) => {
  try {
    const categories = await orgService.listCategories();
    res.json({ data: categories });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list categories';
    res.status(500).json({ error: message });
  }
});

// POST /api/categories — ADMIN only
router.post('/categories', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { name, fields } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }
    const cat = await orgService.createCategory(req.user!.id, { name, fields });
    res.status(201).json({ data: cat });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create category';
    res.status(400).json({ error: message });
  }
});

// PATCH /api/categories/:id — ADMIN only
router.patch('/categories/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { name, fields } = req.body;
    const cat = await orgService.updateCategory(req.user!.id, req.params.id, { name, fields });
    res.json({ data: cat });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update category';
    res.status(400).json({ error: message });
  }
});

// ─── Employees ───────────────────────────────────────────────

// GET /api/employees — ADMIN, ASSET_MANAGER, DEPARTMENT_HEAD
router.get(
  '/employees',
  requireAuth,
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  async (req, res) => {
    try {
      const { status, departmentId, q } = req.query;
      const employees = await orgService.listEmployees({
        status: status as string | undefined,
        departmentId: departmentId as string | undefined,
        q: q as string | undefined,
      });
      res.json({ data: employees });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list employees';
      res.status(500).json({ error: message });
    }
  }
);

// PATCH /api/employees/:id/role — ADMIN only
router.patch(
  '/employees/:id/role',
  requireAuth,
  requireRole(['ADMIN']),
  async (req, res) => {
    try {
      const { role } = req.body;
      if (!role) {
        res.status(400).json({ error: 'Role is required' });
        return;
      }
      const employee = await orgService.updateEmployeeRole(req.user!.id, req.params.id, role);
      res.json({ data: employee });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update role';
      res.status(400).json({ error: message });
    }
  }
);

// POST /api/employees — ADMIN only
router.post(
  '/employees',
  requireAuth,
  requireRole(['ADMIN']),
  async (req, res) => {
    try {
      const { name, email, role, departmentId, status } = req.body;
      if (!name || !email || !role) {
        res.status(400).json({ error: 'Name, email, and role are required' });
        return;
      }
      const employee = await orgService.createEmployee(req.user!.id, { name, email, role, departmentId, status });
      res.status(201).json({ data: employee });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create employee';
      res.status(400).json({ error: message });
    }
  }
);

// PATCH /api/employees/:id — ADMIN only
router.patch(
  '/employees/:id',
  requireAuth,
  requireRole(['ADMIN']),
  async (req, res) => {
    try {
      const { name, role, departmentId, status } = req.body;
      const employee = await orgService.updateEmployeeDetails(req.user!.id, req.params.id, { name, role, departmentId, status });
      res.json({ data: employee });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update employee';
      res.status(400).json({ error: message });
    }
  }
);

export default router;
