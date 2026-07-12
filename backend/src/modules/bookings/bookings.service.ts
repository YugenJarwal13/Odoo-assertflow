import prisma from '../../lib/prisma.js';
import { logActivity } from '../../lib/logger.js';
import { createNotification } from '../../lib/notifications.js';
import { ConflictError, NotFoundError, BadRequestError } from '../../lib/errors.js';

/**
 * Lazily roll booking statuses forward based on the clock:
 * UPCOMING → ONGOING once startTime passes, → COMPLETED once endTime passes.
 */
async function refreshBookingStatuses() {
  const now = new Date();
  await prisma.$transaction([
    prisma.booking.updateMany({
      where: { status: { in: ['UPCOMING', 'ONGOING'] }, endTime: { lte: now } },
      data: { status: 'COMPLETED' },
    }),
    prisma.booking.updateMany({
      where: { status: 'UPCOMING', startTime: { lte: now }, endTime: { gt: now } },
      data: { status: 'ONGOING' },
    }),
  ]);
}

export async function listBookings(filters?: {
  assetId?: string;
  status?: string;
  mine?: string; // userId — restrict to own bookings
}) {
  await refreshBookingStatuses();

  const where: Record<string, unknown> = {};
  if (filters?.assetId) where.assetId = filters.assetId;
  if (filters?.status) where.status = filters.status;
  if (filters?.mine) where.bookedById = filters.mine;

  return prisma.booking.findMany({
    where,
    include: {
      asset: { select: { id: true, assetTag: true, name: true, location: true } },
      bookedBy: { select: { id: true, name: true } },
    },
    orderBy: { startTime: 'asc' },
  });
}

async function assertNoOverlap(
  assetId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
) {
  // Overlap: existing.start < new.end AND existing.end > new.start
  // Back-to-back slots (10:00–11:00 after 9:00–10:00) are allowed.
  const conflict = await prisma.booking.findFirst({
    where: {
      assetId,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      status: { in: ['UPCOMING', 'ONGOING'] },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    include: { bookedBy: { select: { name: true } } },
  });

  if (conflict) {
    throw new ConflictError(
      `Time slot unavailable — already booked by ${conflict.bookedBy.name} from ${conflict.startTime.toISOString()} to ${conflict.endTime.toISOString()}`,
      {
        code: 'BOOKING_OVERLAP',
        conflictingBooking: {
          id: conflict.id,
          startTime: conflict.startTime,
          endTime: conflict.endTime,
          bookedByName: conflict.bookedBy.name,
        },
      }
    );
  }
}

export async function createBooking(
  userId: string,
  data: { assetId: string; startTime: string; endTime: string }
) {
  if (!data.assetId || !data.startTime || !data.endTime) {
    throw new BadRequestError('Resource, start time and end time are required');
  }

  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new BadRequestError('Invalid start or end time');
  }
  if (end <= start) throw new BadRequestError('End time must be after start time');
  if (end <= new Date()) throw new BadRequestError('Booking must end in the future');

  const asset = await prisma.asset.findUnique({ where: { id: data.assetId } });
  if (!asset) throw new NotFoundError('Resource not found');
  if (!asset.isBookable) throw new BadRequestError('This asset is not a bookable resource');
  if (['LOST', 'RETIRED', 'DISPOSED', 'UNDER_MAINTENANCE'].includes(asset.status)) {
    throw new BadRequestError(`This resource is currently ${asset.status.replace(/_/g, ' ').toLowerCase()} and cannot be booked`);
  }

  await assertNoOverlap(data.assetId, start, end);

  const booking = await prisma.booking.create({
    data: {
      assetId: data.assetId,
      bookedById: userId,
      startTime: start,
      endTime: end,
    },
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
      bookedBy: { select: { id: true, name: true } },
    },
  });

  await logActivity(userId, 'BOOKING_CREATED', 'Booking', booking.id, {
    assetTag: booking.asset.assetTag,
    startTime: data.startTime,
    endTime: data.endTime,
  });

  await createNotification(
    userId,
    'BOOKING_CONFIRMED',
    `Booking confirmed: ${booking.asset.name} (${booking.asset.assetTag}) from ${start.toLocaleString()} to ${end.toLocaleString()}`
  );

  return booking;
}

export async function updateBooking(
  userId: string,
  userRole: string,
  bookingId: string,
  data: { action: 'cancel' | 'reschedule'; startTime?: string; endTime?: string }
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { asset: { select: { assetTag: true, name: true } } },
  });
  if (!booking) throw new NotFoundError('Booking not found');

  const isManager = ['ADMIN', 'ASSET_MANAGER'].includes(userRole);
  if (!isManager && booking.bookedById !== userId) {
    throw new BadRequestError('You can only modify your own bookings');
  }
  if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
    throw new BadRequestError(`This booking is already ${booking.status.toLowerCase()}`);
  }

  if (data.action === 'cancel') {
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });
    await logActivity(userId, 'BOOKING_CANCELLED', 'Booking', bookingId, {
      assetTag: booking.asset.assetTag,
    });
    await createNotification(
      booking.bookedById,
      'BOOKING_CANCELLED',
      `Booking cancelled: ${booking.asset.name} (${booking.asset.assetTag})`
    );
    return updated;
  }

  if (data.action === 'reschedule') {
    if (!data.startTime || !data.endTime) {
      throw new BadRequestError('New start and end times are required to reschedule');
    }
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    if (end <= start) throw new BadRequestError('End time must be after start time');

    await assertNoOverlap(booking.assetId, start, end, bookingId);

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { startTime: start, endTime: end, status: 'UPCOMING' },
    });
    await logActivity(userId, 'BOOKING_RESCHEDULED', 'Booking', bookingId, {
      assetTag: booking.asset.assetTag,
      startTime: data.startTime,
      endTime: data.endTime,
    });
    await createNotification(
      booking.bookedById,
      'BOOKING_RESCHEDULED',
      `Booking rescheduled: ${booking.asset.name} now ${start.toLocaleString()} – ${end.toLocaleString()}`
    );
    return updated;
  }

  throw new BadRequestError('Action must be "cancel" or "reschedule"');
}
