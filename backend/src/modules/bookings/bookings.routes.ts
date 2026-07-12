import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { sendError } from '../../lib/errors.js';
import * as bookingsService from './bookings.service.js';

const router = Router();

// GET /api/bookings?assetId=&status=&mine=true
router.get('/', requireAuth, async (req, res) => {
  try {
    const { assetId, status, mine } = req.query;
    const bookings = await bookingsService.listBookings({
      assetId: assetId as string | undefined,
      status: status as string | undefined,
      mine: mine === 'true' ? req.user!.id : undefined,
    });
    res.json({ data: bookings });
  } catch (err) {
    sendError(res, err, 'Failed to list bookings');
  }
});

// POST /api/bookings — any authenticated user
router.post('/', requireAuth, async (req, res) => {
  try {
    const booking = await bookingsService.createBooking(req.user!.id, req.body);
    res.status(201).json({ data: booking });
  } catch (err) {
    sendError(res, err, 'Failed to create booking');
  }
});

// PATCH /api/bookings/:id — cancel or reschedule
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const booking = await bookingsService.updateBooking(
      req.user!.id,
      req.user!.role,
      String(req.params.id),
      req.body
    );
    res.json({ data: booking });
  } catch (err) {
    sendError(res, err, 'Failed to update booking');
  }
});

export default router;
