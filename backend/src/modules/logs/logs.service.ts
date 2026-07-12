import prisma from '../../lib/prisma.js';

export async function listLogs(filters?: {
  entityType?: string;
  userId?: string;
  q?: string;
  limit?: number;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.entityType) {
    where.entityType = filters.entityType;
  }
  if (filters?.userId) {
    where.userId = filters.userId;
  }
  if (filters?.q) {
    where.action = { contains: filters.q, mode: 'insensitive' };
  }

  return prisma.activityLog.findMany({
    where,
    take: filters?.limit ?? 200,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true, email: true, role: true } },
    },
  });
}
