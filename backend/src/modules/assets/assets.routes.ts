import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { sendError } from '../../lib/errors.js';
import * as assetsService from './assets.service.js';

const router = Router();

// ─── Asset Registry ──────────────────────────────────────────

// GET /api/assets — any authenticated user (employees see bookable/held assets in UI)
router.get('/assets', requireAuth, async (req, res) => {
  try {
    const { q, status, categoryId, departmentId, location, isBookable } = req.query;
    const assets = await assetsService.listAssets({
      q: q as string | undefined,
      status: status as string | undefined,
      categoryId: categoryId as string | undefined,
      departmentId: departmentId as string | undefined,
      location: location as string | undefined,
      isBookable: isBookable === undefined ? undefined : isBookable === 'true',
    });
    res.json({ data: assets });
  } catch (err) {
    sendError(res, err, 'Failed to list assets');
  }
});

// POST /api/assets — ADMIN, ASSET_MANAGER
router.post('/assets', requireAuth, requireRole(['ADMIN', 'ASSET_MANAGER']), async (req, res) => {
  try {
    const { name, categoryId } = req.body;
    if (!name || !categoryId) {
      res.status(400).json({ error: 'Asset name and category are required' });
      return;
    }
    const asset = await assetsService.createAsset(req.user!.id, req.body);
    res.status(201).json({ data: asset });
  } catch (err) {
    sendError(res, err, 'Failed to register asset');
  }
});

// GET /api/assets/:id
router.get('/assets/:id', requireAuth, async (req, res) => {
  try {
    const asset = await assetsService.getAsset(String(req.params.id));
    res.json({ data: asset });
  } catch (err) {
    sendError(res, err, 'Failed to fetch asset');
  }
});

// PATCH /api/assets/:id — ADMIN, ASSET_MANAGER
router.patch(
  '/assets/:id',
  requireAuth,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  async (req, res) => {
    try {
      const asset = await assetsService.updateAsset(req.user!.id, String(req.params.id), req.body);
      res.json({ data: asset });
    } catch (err) {
      sendError(res, err, 'Failed to update asset');
    }
  }
);

// GET /api/assets/:id/history
router.get('/assets/:id/history', requireAuth, async (req, res) => {
  try {
    const history = await assetsService.getAssetHistory(String(req.params.id));
    res.json({ data: history });
  } catch (err) {
    sendError(res, err, 'Failed to fetch asset history');
  }
});

// ─── Allocation ──────────────────────────────────────────────

// POST /api/assets/:id/allocate — ADMIN, ASSET_MANAGER, DEPARTMENT_HEAD
router.post(
  '/assets/:id/allocate',
  requireAuth,
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  async (req, res) => {
    try {
      const allocation = await assetsService.allocateAsset(req.user!.id, String(req.params.id), req.body);
      res.status(201).json({ data: allocation });
    } catch (err) {
      sendError(res, err, 'Failed to allocate asset');
    }
  }
);

// GET /api/allocations?active=&overdue=
router.get('/allocations', requireAuth, async (req, res) => {
  try {
    const { active, overdue } = req.query;
    const allocations = await assetsService.listAllocations({
      active: active === undefined ? undefined : active === 'true',
      overdue: overdue === 'true',
    });
    res.json({ data: allocations });
  } catch (err) {
    sendError(res, err, 'Failed to list allocations');
  }
});

// POST /api/allocations/:id/return — holder or manager
router.post('/allocations/:id/return', requireAuth, async (req, res) => {
  try {
    const result = await assetsService.returnAsset(
      req.user!.id,
      req.user!.role,
      String(req.params.id),
      req.body?.conditionNoteIn
    );
    res.json({ data: result });
  } catch (err) {
    sendError(res, err, 'Failed to return asset');
  }
});

// ─── Transfers ───────────────────────────────────────────────

// POST /api/assets/:id/transfer-request — any authenticated user
router.post('/assets/:id/transfer-request', requireAuth, async (req, res) => {
  try {
    const transfer = await assetsService.requestTransfer(
      req.user!.id,
      String(req.params.id),
      req.body?.toUserId
    );
    res.status(201).json({ data: transfer });
  } catch (err) {
    sendError(res, err, 'Failed to request transfer');
  }
});

// GET /api/transfers?status=
router.get('/transfers', requireAuth, async (req, res) => {
  try {
    const transfers = await assetsService.listTransfers({
      status: req.query.status as string | undefined,
    });
    res.json({ data: transfers });
  } catch (err) {
    sendError(res, err, 'Failed to list transfers');
  }
});

// PATCH /api/transfers/:id/decision — ADMIN, ASSET_MANAGER, DEPARTMENT_HEAD
router.patch(
  '/transfers/:id/decision',
  requireAuth,
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  async (req, res) => {
    try {
      const transfer = await assetsService.decideTransfer(
        req.user!.id,
        String(req.params.id),
        req.body?.decision
      );
      res.json({ data: transfer });
    } catch (err) {
      sendError(res, err, 'Failed to decide transfer');
    }
  }
);

export default router;
