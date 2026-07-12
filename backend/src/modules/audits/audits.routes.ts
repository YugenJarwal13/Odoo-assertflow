import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { sendError } from '../../lib/errors.js';
import * as auditsService from './audits.service.js';

const router = Router();

// GET /api/audits?status=
router.get('/', requireAuth, async (req, res) => {
  try {
    const cycles = await auditsService.listCycles({
      status: req.query.status as string | undefined,
    });
    res.json({ data: cycles });
  } catch (err) {
    sendError(res, err, 'Failed to list audit cycles');
  }
});

// GET /api/audits/:id — cycle detail incl. items + discrepancy report
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const cycle = await auditsService.getCycle(String(req.params.id));
    res.json({ data: cycle });
  } catch (err) {
    sendError(res, err, 'Failed to fetch audit cycle');
  }
});

// POST /api/audits — ADMIN, ASSET_MANAGER
router.post('/', requireAuth, requireRole(['ADMIN', 'ASSET_MANAGER']), async (req, res) => {
  try {
    const cycle = await auditsService.createCycle(req.user!.id, req.body);
    res.status(201).json({ data: cycle });
  } catch (err) {
    sendError(res, err, 'Failed to create audit cycle');
  }
});

// POST /api/audits/:id/assign-auditor — ADMIN, ASSET_MANAGER
router.post(
  '/:id/assign-auditor',
  requireAuth,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  async (req, res) => {
    try {
      const assignment = await auditsService.assignAuditor(
        req.user!.id,
        String(req.params.id),
        req.body?.auditorId
      );
      res.status(201).json({ data: assignment });
    } catch (err) {
      sendError(res, err, 'Failed to assign auditor');
    }
  }
);

// PATCH /api/audits/:id/items/:itemId — assigned auditors / admin
router.patch('/:id/items/:itemId', requireAuth, async (req, res) => {
  try {
    const item = await auditsService.markItem(
      req.user!.id,
      req.user!.role,
      String(req.params.id),
      String(req.params.itemId),
      req.body
    );
    res.json({ data: item });
  } catch (err) {
    sendError(res, err, 'Failed to mark audit item');
  }
});

// POST /api/audits/:id/close — ADMIN, ASSET_MANAGER
router.post(
  '/:id/close',
  requireAuth,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  async (req, res) => {
    try {
      const cycle = await auditsService.closeCycle(req.user!.id, String(req.params.id));
      res.json({ data: cycle });
    } catch (err) {
      sendError(res, err, 'Failed to close audit cycle');
    }
  }
);

export default router;
