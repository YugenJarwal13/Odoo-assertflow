import prisma from './prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';

export async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  meta?: Record<string, unknown>
) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        meta: meta as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    // Log but don't crash the request — activity logging is best-effort
    console.error('Failed to log activity:', err);
  }
}
