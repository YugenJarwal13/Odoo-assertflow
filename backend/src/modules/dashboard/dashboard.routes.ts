import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as dashboardService from './dashboard.service.js';

const router = Router();

// GET /api/dashboard/kpis
router.get('/kpis', requireAuth, async (_req, res) => {
  try {
    const kpis = await dashboardService.getKpis();
    res.json({ data: kpis });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch KPIs';
    res.status(500).json({ error: message });
  }
});

export default router;
