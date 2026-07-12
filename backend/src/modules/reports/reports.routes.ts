import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { sendError } from '../../lib/errors.js';
import * as reportsService from './reports.service.js';

const router = Router();

const managerRoles = ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'];

// GET /api/reports/utilization
router.get('/utilization', requireAuth, requireRole(managerRoles), async (_req, res) => {
  try {
    res.json({ data: await reportsService.utilization() });
  } catch (err) {
    sendError(res, err, 'Failed to build utilization report');
  }
});

// GET /api/reports/maintenance-frequency
router.get('/maintenance-frequency', requireAuth, requireRole(managerRoles), async (_req, res) => {
  try {
    res.json({ data: await reportsService.maintenanceFrequency() });
  } catch (err) {
    sendError(res, err, 'Failed to build maintenance report');
  }
});

// GET /api/reports/booking-heatmap
router.get('/booking-heatmap', requireAuth, requireRole(managerRoles), async (_req, res) => {
  try {
    res.json({ data: await reportsService.bookingHeatmap() });
  } catch (err) {
    sendError(res, err, 'Failed to build booking heatmap');
  }
});

// GET /api/reports/department-summary
router.get('/department-summary', requireAuth, requireRole(managerRoles), async (_req, res) => {
  try {
    res.json({ data: await reportsService.departmentSummary() });
  } catch (err) {
    sendError(res, err, 'Failed to build department summary');
  }
});

export default router;
