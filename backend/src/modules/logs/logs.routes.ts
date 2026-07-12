import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import * as logsService from './logs.service.js';

const router = Router();

// GET /api/activity-logs — ADMIN only
router.get('/', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { entityType, userId, q, limit } = req.query;
    const logs = await logsService.listLogs({
      entityType: entityType as string | undefined,
      userId: userId as string | undefined,
      q: q as string | undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ data: { logs } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch activity logs';
    res.status(500).json({ error: message });
  }
});

export default router;
