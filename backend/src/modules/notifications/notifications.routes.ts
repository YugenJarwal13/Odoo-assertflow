import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as notifService from './notifications.service.js';

const router = Router();

// GET /api/notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const notifications = await notifService.listNotifications(req.user!.id);
    const unreadCount = await notifService.getUnreadCount(req.user!.id);
    res.json({ data: { notifications, unreadCount } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch notifications';
    res.status(500).json({ error: message });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const notification = await notifService.markAsRead(String(req.params.id), req.user!.id);
    res.json({ data: notification });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to mark notification as read';
    res.status(400).json({ error: message });
  }
});

export default router;
