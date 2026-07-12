import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { sendError } from '../../lib/errors.js';
import * as maintenanceService from './maintenance.service.js';

const router = Router();

// GET /api/maintenance?status=&assetId=&mine=true
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, assetId, mine } = req.query;
    const requests = await maintenanceService.listRequests({
      status: status as string | undefined,
      assetId: assetId as string | undefined,
      mine: mine === 'true' ? req.user!.id : undefined,
    });
    res.json({ data: requests });
  } catch (err) {
    sendError(res, err, 'Failed to list maintenance requests');
  }
});

// POST /api/maintenance — any authenticated user can raise a request
router.post('/', requireAuth, async (req, res) => {
  try {
    const request = await maintenanceService.raiseRequest(req.user!.id, req.body);
    res.status(201).json({ data: request });
  } catch (err) {
    sendError(res, err, 'Failed to raise maintenance request');
  }
});

// PATCH /api/maintenance/:id/decision — ADMIN, ASSET_MANAGER
router.patch(
  '/:id/decision',
  requireAuth,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  async (req, res) => {
    try {
      const request = await maintenanceService.decideRequest(
        req.user!.id,
        String(req.params.id),
        req.body?.decision
      );
      res.json({ data: request });
    } catch (err) {
      sendError(res, err, 'Failed to decide maintenance request');
    }
  }
);

// PATCH /api/maintenance/:id/assign-technician — ADMIN, ASSET_MANAGER
router.patch(
  '/:id/assign-technician',
  requireAuth,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  async (req, res) => {
    try {
      const request = await maintenanceService.assignTechnician(
        req.user!.id,
        String(req.params.id),
        req.body?.technicianName
      );
      res.json({ data: request });
    } catch (err) {
      sendError(res, err, 'Failed to assign technician');
    }
  }
);

// PATCH /api/maintenance/:id/start — ADMIN, ASSET_MANAGER
router.patch(
  '/:id/start',
  requireAuth,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  async (req, res) => {
    try {
      const request = await maintenanceService.startWork(req.user!.id, String(req.params.id));
      res.json({ data: request });
    } catch (err) {
      sendError(res, err, 'Failed to start maintenance work');
    }
  }
);

// PATCH /api/maintenance/:id/resolve — ADMIN, ASSET_MANAGER
router.patch(
  '/:id/resolve',
  requireAuth,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  async (req, res) => {
    try {
      const request = await maintenanceService.resolveRequest(req.user!.id, String(req.params.id));
      res.json({ data: request });
    } catch (err) {
      sendError(res, err, 'Failed to resolve maintenance request');
    }
  }
);

export default router;
