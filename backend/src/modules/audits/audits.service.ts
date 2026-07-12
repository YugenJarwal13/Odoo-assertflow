import prisma from '../../lib/prisma.js';
import { logActivity } from '../../lib/logger.js';
import { createNotification } from '../../lib/notifications.js';
import { canTransition } from '../../lib/assetLifecycle.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';

const cycleInclude = {
  assignments: {
    include: { auditor: { select: { id: true, name: true, email: true } } },
  },
  items: {
    include: {
      asset: {
        select: { id: true, assetTag: true, name: true, status: true, location: true },
      },
    },
  },
} as const;

export async function listCycles(filters?: { status?: string }) {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;

  return prisma.auditCycle.findMany({
    where,
    include: {
      assignments: { include: { auditor: { select: { id: true, name: true } } } },
      _count: { select: { items: true } },
    },
    orderBy: { startDate: 'desc' },
  });
}

export async function getCycle(id: string) {
  const cycle = await prisma.auditCycle.findUnique({
    where: { id },
    include: cycleInclude,
  });
  if (!cycle) throw new NotFoundError('Audit cycle not found');

  const discrepancies = cycle.items.filter((i) => i.result === 'MISSING' || i.result === 'DAMAGED');
  return { ...cycle, discrepancies };
}

export async function createCycle(
  userId: string,
  data: { scopeDept?: string; scopeLoc?: string; startDate: string; endDate: string; auditorIds?: string[] }
) {
  if (!data.startDate || !data.endDate) {
    throw new BadRequestError('Start and end dates are required');
  }
  if (new Date(data.endDate) <= new Date(data.startDate)) {
    throw new BadRequestError('End date must be after start date');
  }

  // Scope determines which assets are auto-pulled into the cycle
  const assetWhere: Record<string, unknown> = {
    status: { notIn: ['DISPOSED'] },
  };
  if (data.scopeDept) assetWhere.departmentId = data.scopeDept;
  if (data.scopeLoc) assetWhere.location = { contains: data.scopeLoc, mode: 'insensitive' };

  const assets = await prisma.asset.findMany({ where: assetWhere, select: { id: true } });
  if (assets.length === 0) {
    throw new BadRequestError('No assets match this scope — nothing to audit');
  }

  const cycle = await prisma.auditCycle.create({
    data: {
      scopeDept: data.scopeDept || null,
      scopeLoc: data.scopeLoc || null,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      items: { create: assets.map((a) => ({ assetId: a.id })) },
      assignments: data.auditorIds?.length
        ? { create: data.auditorIds.map((auditorId) => ({ auditorId })) }
        : undefined,
    },
    include: cycleInclude,
  });

  await logActivity(userId, 'AUDIT_CYCLE_CREATED', 'AuditCycle', cycle.id, {
    scopeDept: data.scopeDept,
    scopeLoc: data.scopeLoc,
    assetCount: assets.length,
  });

  for (const auditorId of data.auditorIds ?? []) {
    await createNotification(
      auditorId,
      'AUDIT_ASSIGNED',
      `You have been assigned as auditor on a new audit cycle (${assets.length} assets)`
    );
  }

  return cycle;
}

export async function assignAuditor(userId: string, cycleId: string, auditorId: string) {
  if (!auditorId) throw new BadRequestError('Auditor is required');

  const cycle = await prisma.auditCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new NotFoundError('Audit cycle not found');
  if (cycle.status === 'CLOSED') throw new BadRequestError('Cannot modify a closed audit cycle');

  const existing = await prisma.auditAssignment.findFirst({
    where: { auditCycleId: cycleId, auditorId },
  });
  if (existing) throw new BadRequestError('This auditor is already assigned to the cycle');

  const assignment = await prisma.auditAssignment.create({
    data: { auditCycleId: cycleId, auditorId },
    include: { auditor: { select: { id: true, name: true } } },
  });

  await logActivity(userId, 'AUDITOR_ASSIGNED', 'AuditCycle', cycleId, { auditorId });
  await createNotification(auditorId, 'AUDIT_ASSIGNED', 'You have been assigned to an audit cycle');

  return assignment;
}

export async function markItem(
  userId: string,
  userRole: string,
  cycleId: string,
  itemId: string,
  data: { result: 'VERIFIED' | 'MISSING' | 'DAMAGED'; note?: string }
) {
  if (!['VERIFIED', 'MISSING', 'DAMAGED'].includes(data.result)) {
    throw new BadRequestError('Result must be VERIFIED, MISSING or DAMAGED');
  }

  const cycle = await prisma.auditCycle.findUnique({
    where: { id: cycleId },
    include: { assignments: true },
  });
  if (!cycle) throw new NotFoundError('Audit cycle not found');
  if (cycle.status === 'CLOSED') throw new BadRequestError('This audit cycle is closed');

  // Only assigned auditors (or admins) may mark items
  const isAssigned = cycle.assignments.some((a) => a.auditorId === userId);
  if (!isAssigned && userRole !== 'ADMIN') {
    throw new BadRequestError('Only assigned auditors can verify items in this cycle');
  }

  const item = await prisma.auditItem.findUnique({
    where: { id: itemId },
    include: { asset: { select: { assetTag: true, name: true } } },
  });
  if (!item || item.auditCycleId !== cycleId) {
    throw new NotFoundError('Audit item not found in this cycle');
  }

  const updated = await prisma.auditItem.update({
    where: { id: itemId },
    data: { result: data.result, note: data.note || null },
    include: {
      asset: { select: { id: true, assetTag: true, name: true, status: true, location: true } },
    },
  });

  await logActivity(userId, `AUDIT_ITEM_${data.result}`, 'AuditItem', itemId, {
    assetTag: item.asset.assetTag,
    note: data.note,
  });

  // Discrepancies immediately alert admins + asset managers
  if (data.result !== 'VERIFIED') {
    const managers = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'ASSET_MANAGER'] }, status: 'ACTIVE' },
      select: { id: true },
    });
    await Promise.all(
      managers.map((m) =>
        createNotification(
          m.id,
          'AUDIT_DISCREPANCY',
          `Audit discrepancy: ${item.asset.assetTag} (${item.asset.name}) marked ${data.result}`
        )
      )
    );
  }

  return updated;
}

export async function closeCycle(userId: string, cycleId: string) {
  const cycle = await prisma.auditCycle.findUnique({
    where: { id: cycleId },
    include: { items: { include: { asset: true } } },
  });
  if (!cycle) throw new NotFoundError('Audit cycle not found');
  if (cycle.status === 'CLOSED') throw new BadRequestError('This audit cycle is already closed');

  const pending = cycle.items.filter((i) => i.result === 'PENDING');
  if (pending.length > 0) {
    throw new BadRequestError(
      `${pending.length} item(s) are still unverified — mark every asset before closing the cycle`
    );
  }

  // Confirmed-missing assets flip to LOST (when the lifecycle allows it)
  const missingItems = cycle.items.filter(
    (i) => i.result === 'MISSING' && canTransition(i.asset.status, 'LOST')
  );

  await prisma.$transaction([
    prisma.auditCycle.update({ where: { id: cycleId }, data: { status: 'CLOSED' } }),
    ...missingItems.map((i) =>
      prisma.asset.update({ where: { id: i.assetId }, data: { status: 'LOST' } })
    ),
  ]);

  const discrepancies = cycle.items.filter((i) => i.result !== 'VERIFIED');

  await logActivity(userId, 'AUDIT_CYCLE_CLOSED', 'AuditCycle', cycleId, {
    total: cycle.items.length,
    verified: cycle.items.length - discrepancies.length,
    missing: cycle.items.filter((i) => i.result === 'MISSING').length,
    damaged: cycle.items.filter((i) => i.result === 'DAMAGED').length,
  });

  return getCycle(cycleId);
}
