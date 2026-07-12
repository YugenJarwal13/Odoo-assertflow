import prisma from '../../lib/prisma.js';
import { logActivity } from '../../lib/logger.js';
import { createNotification } from '../../lib/notifications.js';
import { assertTransition } from '../../lib/assetLifecycle.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';

async function notifyAssetManagers(type: string, message: string) {
  const managers = await prisma.user.findMany({
    where: { role: { in: ['ASSET_MANAGER', 'ADMIN'] }, status: 'ACTIVE' },
    select: { id: true },
  });
  await Promise.all(managers.map((m) => createNotification(m.id, type, message)));
}

export async function listRequests(filters?: {
  status?: string;
  assetId?: string;
  mine?: string; // userId
}) {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.assetId) where.assetId = filters.assetId;
  if (filters?.mine) where.raisedById = filters.mine;

  return prisma.maintenanceRequest.findMany({
    where,
    include: {
      asset: { select: { id: true, assetTag: true, name: true, status: true } },
      raisedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function raiseRequest(
  userId: string,
  data: { assetId: string; issue: string; priority?: string; photoUrl?: string }
) {
  if (!data.assetId || !data.issue) {
    throw new BadRequestError('Asset and issue description are required');
  }

  const asset = await prisma.asset.findUnique({ where: { id: data.assetId } });
  if (!asset) throw new NotFoundError('Asset not found');
  if (asset.status === 'UNDER_MAINTENANCE') {
    throw new BadRequestError('This asset is already under maintenance');
  }
  if (['LOST', 'RETIRED', 'DISPOSED'].includes(asset.status)) {
    throw new BadRequestError(`Cannot raise maintenance for a ${asset.status.toLowerCase()} asset`);
  }

  const request = await prisma.maintenanceRequest.create({
    data: {
      assetId: data.assetId,
      raisedById: userId,
      issue: data.issue,
      priority: data.priority || 'MEDIUM',
      photoUrl: data.photoUrl || null,
    },
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
      raisedBy: { select: { id: true, name: true } },
    },
  });

  await logActivity(userId, 'MAINTENANCE_RAISED', 'MaintenanceRequest', request.id, {
    assetTag: request.asset.assetTag,
    priority: request.priority,
  });

  await notifyAssetManagers(
    'MAINTENANCE_REQUESTED',
    `New ${request.priority} priority maintenance request for ${request.asset.assetTag} (${request.asset.name})`
  );

  return request;
}

export async function decideRequest(
  userId: string,
  requestId: string,
  decision: 'APPROVED' | 'REJECTED'
) {
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw new BadRequestError('Decision must be APPROVED or REJECTED');
  }

  const request = await prisma.maintenanceRequest.findUnique({
    where: { id: requestId },
    include: { asset: true },
  });
  if (!request) throw new NotFoundError('Maintenance request not found');
  if (request.status !== 'PENDING') {
    throw new BadRequestError('Only pending requests can be approved or rejected');
  }

  if (decision === 'APPROVED') {
    // Approval flips the asset to UNDER_MAINTENANCE — validated by the state machine
    assertTransition(request.asset.status, 'UNDER_MAINTENANCE');
    await prisma.$transaction([
      prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED' },
      }),
      prisma.asset.update({
        where: { id: request.assetId },
        data: { status: 'UNDER_MAINTENANCE' },
      }),
    ]);
  } else {
    await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' },
    });
  }

  await logActivity(userId, `MAINTENANCE_${decision}`, 'MaintenanceRequest', requestId, {
    assetTag: request.asset.assetTag,
  });

  await createNotification(
    request.raisedById,
    `MAINTENANCE_${decision}`,
    `Your maintenance request for ${request.asset.assetTag} (${request.asset.name}) was ${decision.toLowerCase()}`
  );

  return prisma.maintenanceRequest.findUnique({
    where: { id: requestId },
    include: { asset: { select: { id: true, assetTag: true, name: true, status: true } } },
  });
}

export async function assignTechnician(userId: string, requestId: string, technicianName: string) {
  if (!technicianName) throw new BadRequestError('Technician name is required');

  const request = await prisma.maintenanceRequest.findUnique({
    where: { id: requestId },
    include: { asset: { select: { assetTag: true, name: true } } },
  });
  if (!request) throw new NotFoundError('Maintenance request not found');
  if (request.status !== 'APPROVED') {
    throw new BadRequestError('A technician can only be assigned to an approved request');
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: { status: 'TECHNICIAN_ASSIGNED', technicianName },
  });

  await logActivity(userId, 'TECHNICIAN_ASSIGNED', 'MaintenanceRequest', requestId, {
    assetTag: request.asset.assetTag,
    technicianName,
  });

  await createNotification(
    request.raisedById,
    'TECHNICIAN_ASSIGNED',
    `Technician ${technicianName} assigned to your maintenance request for ${request.asset.assetTag}`
  );

  return updated;
}

export async function startWork(userId: string, requestId: string) {
  const request = await prisma.maintenanceRequest.findUnique({
    where: { id: requestId },
    include: { asset: { select: { assetTag: true } } },
  });
  if (!request) throw new NotFoundError('Maintenance request not found');
  if (request.status !== 'TECHNICIAN_ASSIGNED') {
    throw new BadRequestError('Work can only start once a technician is assigned');
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: { status: 'IN_PROGRESS' },
  });

  await logActivity(userId, 'MAINTENANCE_STARTED', 'MaintenanceRequest', requestId, {
    assetTag: request.asset.assetTag,
  });

  return updated;
}

export async function resolveRequest(userId: string, requestId: string) {
  const request = await prisma.maintenanceRequest.findUnique({
    where: { id: requestId },
    include: { asset: true },
  });
  if (!request) throw new NotFoundError('Maintenance request not found');
  if (!['TECHNICIAN_ASSIGNED', 'IN_PROGRESS', 'APPROVED'].includes(request.status)) {
    throw new BadRequestError('Only approved / in-progress requests can be resolved');
  }

  // Resolution flips the asset back to AVAILABLE — or back to ALLOCATED
  // if someone still holds it (active allocation survives maintenance)
  const activeAllocation = await prisma.allocation.findFirst({
    where: { assetId: request.assetId, isActive: true },
  });
  const targetStatus = activeAllocation ? 'ALLOCATED' : 'AVAILABLE';
  assertTransition(request.asset.status, targetStatus);
  await prisma.$transaction([
    prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    }),
    prisma.asset.update({
      where: { id: request.assetId },
      data: { status: targetStatus },
    }),
  ]);

  await logActivity(userId, 'MAINTENANCE_RESOLVED', 'MaintenanceRequest', requestId, {
    assetTag: request.asset.assetTag,
  });

  await createNotification(
    request.raisedById,
    'MAINTENANCE_RESOLVED',
    `Maintenance resolved — ${request.asset.assetTag} (${request.asset.name}) is available again`
  );

  return prisma.maintenanceRequest.findUnique({
    where: { id: requestId },
    include: { asset: { select: { id: true, assetTag: true, name: true, status: true } } },
  });
}
