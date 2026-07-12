import prisma from '../../lib/prisma.js';
import { logActivity } from '../../lib/logger.js';
import { createNotification } from '../../lib/notifications.js';
import { assertTransition } from '../../lib/assetLifecycle.js';
import { ConflictError, NotFoundError, BadRequestError } from '../../lib/errors.js';
import type { AssetStatus } from '../../../generated/prisma/enums.js';

// ─── Helpers ─────────────────────────────────────────────────

async function nextAssetTag(): Promise<string> {
  const last = await prisma.asset.findFirst({
    orderBy: { assetTag: 'desc' },
    select: { assetTag: true },
  });
  const lastNum = last ? parseInt(last.assetTag.replace('AF-', ''), 10) : 0;
  return `AF-${String(lastNum + 1).padStart(4, '0')}`;
}

async function notifyRole(role: 'ADMIN' | 'ASSET_MANAGER', type: string, message: string) {
  const users = await prisma.user.findMany({
    where: { role, status: 'ACTIVE' },
    select: { id: true },
  });
  await Promise.all(users.map((u) => createNotification(u.id, type, message)));
}

// ─── Asset Registry ──────────────────────────────────────────

export async function listAssets(filters?: {
  q?: string;
  status?: string;
  categoryId?: string;
  departmentId?: string;
  location?: string;
  isBookable?: boolean;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.status) where.status = filters.status;
  if (filters?.categoryId) where.categoryId = filters.categoryId;
  if (filters?.departmentId) where.departmentId = filters.departmentId;
  if (filters?.location) where.location = { contains: filters.location, mode: 'insensitive' };
  if (filters?.isBookable !== undefined) where.isBookable = filters.isBookable;
  if (filters?.q) {
    where.OR = [
      { name: { contains: filters.q, mode: 'insensitive' } },
      { assetTag: { contains: filters.q, mode: 'insensitive' } },
      { serialNumber: { contains: filters.q, mode: 'insensitive' } },
      { location: { contains: filters.q, mode: 'insensitive' } },
    ];
  }

  return prisma.asset.findMany({
    where,
    include: {
      category: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      allocations: {
        where: { isActive: true },
        include: { holder: { select: { id: true, name: true } } },
        take: 1,
      },
    },
    orderBy: { assetTag: 'asc' },
  });
}

export async function getAsset(id: string) {
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      category: true,
      department: { select: { id: true, name: true } },
      allocations: {
        where: { isActive: true },
        include: { holder: { select: { id: true, name: true, email: true } } },
        take: 1,
      },
    },
  });
  if (!asset) throw new NotFoundError('Asset not found');
  return asset;
}

export async function getAssetHistory(id: string) {
  const asset = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
  if (!asset) throw new NotFoundError('Asset not found');

  const [allocations, transfers, maintenance] = await Promise.all([
    prisma.allocation.findMany({
      where: { assetId: id },
      include: { holder: { select: { id: true, name: true } } },
      orderBy: { allocatedAt: 'desc' },
    }),
    prisma.transfer.findMany({
      where: { assetId: id },
      orderBy: { requestedAt: 'desc' },
    }),
    prisma.maintenanceRequest.findMany({
      where: { assetId: id },
      include: { raisedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Resolve transfer participant names in one query
  const userIds = [
    ...new Set(
      transfers.flatMap((t) => [t.fromUserId, t.toUserId, t.decidedById]).filter(Boolean) as string[]
    ),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameOf = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return {
    allocations,
    transfers: transfers.map((t) => ({
      ...t,
      fromUserName: t.fromUserId ? nameOf[t.fromUserId] ?? null : null,
      toUserName: t.toUserId ? nameOf[t.toUserId] ?? null : null,
      decidedByName: t.decidedById ? nameOf[t.decidedById] ?? null : null,
    })),
    maintenance,
  };
}

export async function createAsset(
  userId: string,
  data: {
    name: string;
    categoryId: string;
    serialNumber?: string;
    acquisitionDate?: string;
    acquisitionCost?: number;
    condition?: string;
    location?: string;
    photoUrl?: string;
    isBookable?: boolean;
    departmentId?: string;
  }
) {
  const assetTag = await nextAssetTag();

  const asset = await prisma.asset.create({
    data: {
      assetTag,
      name: data.name,
      categoryId: data.categoryId,
      serialNumber: data.serialNumber || null,
      acquisitionDate: data.acquisitionDate ? new Date(data.acquisitionDate) : null,
      acquisitionCost: data.acquisitionCost ?? null,
      condition: data.condition || null,
      location: data.location || null,
      photoUrl: data.photoUrl || null,
      isBookable: data.isBookable ?? false,
      departmentId: data.departmentId || null,
    },
    include: { category: { select: { id: true, name: true } } },
  });

  await logActivity(userId, 'ASSET_REGISTERED', 'Asset', asset.id, {
    assetTag: asset.assetTag,
    name: asset.name,
  });

  return asset;
}

export async function updateAsset(
  userId: string,
  id: string,
  data: {
    name?: string;
    categoryId?: string;
    serialNumber?: string | null;
    acquisitionDate?: string | null;
    acquisitionCost?: number | null;
    condition?: string | null;
    location?: string | null;
    photoUrl?: string | null;
    isBookable?: boolean;
    departmentId?: string | null;
    status?: string;
  }
) {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) throw new NotFoundError('Asset not found');

  // Status changes must respect the lifecycle state machine
  if (data.status && data.status !== asset.status) {
    assertTransition(asset.status, data.status as AssetStatus);
  }

  const updated = await prisma.asset.update({
    where: { id },
    data: {
      name: data.name,
      categoryId: data.categoryId,
      serialNumber: data.serialNumber,
      acquisitionDate:
        data.acquisitionDate === undefined
          ? undefined
          : data.acquisitionDate
            ? new Date(data.acquisitionDate)
            : null,
      acquisitionCost: data.acquisitionCost,
      condition: data.condition,
      location: data.location,
      photoUrl: data.photoUrl,
      isBookable: data.isBookable,
      departmentId: data.departmentId,
      status: data.status as AssetStatus | undefined,
    },
    include: { category: { select: { id: true, name: true } } },
  });

  await logActivity(userId, 'ASSET_UPDATED', 'Asset', id, {
    assetTag: updated.assetTag,
    changes: data,
  });

  return updated;
}

// ─── Allocation (with the conflict rule) ─────────────────────

export async function allocateAsset(
  userId: string,
  assetId: string,
  data: { holderUserId?: string; holderDepartmentId?: string; expectedReturnAt?: string }
) {
  if (!data.holderUserId && !data.holderDepartmentId) {
    throw new BadRequestError('Provide an employee or a department to allocate to');
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      allocations: {
        where: { isActive: true },
        include: { holder: { select: { id: true, name: true } } },
        take: 1,
      },
    },
  });
  if (!asset) throw new NotFoundError('Asset not found');

  // THE conflict rule: an asset already held cannot be allocated again
  const active = asset.allocations[0];
  if (active || asset.status === 'ALLOCATED') {
    const holderName = active?.holder?.name ?? 'another holder';
    throw new ConflictError(`This asset is currently held by ${holderName}`, {
      code: 'ALREADY_ALLOCATED',
      holderName,
      holderUserId: active?.holderUserId ?? null,
      canRequestTransfer: true,
    });
  }

  assertTransition(asset.status, 'ALLOCATED');

  const [allocation] = await prisma.$transaction([
    prisma.allocation.create({
      data: {
        assetId,
        holderUserId: data.holderUserId || null,
        holderDepartmentId: data.holderDepartmentId || null,
        expectedReturnAt: data.expectedReturnAt ? new Date(data.expectedReturnAt) : null,
      },
      include: { holder: { select: { id: true, name: true } } },
    }),
    prisma.asset.update({ where: { id: assetId }, data: { status: 'ALLOCATED' } }),
  ]);

  await logActivity(userId, 'ASSET_ALLOCATED', 'Asset', assetId, {
    assetTag: asset.assetTag,
    holderUserId: data.holderUserId,
    holderDepartmentId: data.holderDepartmentId,
  });

  if (data.holderUserId) {
    await createNotification(
      data.holderUserId,
      'ASSET_ASSIGNED',
      `Asset ${asset.assetTag} (${asset.name}) has been assigned to you`
    );
  }

  return allocation;
}

export async function listAllocations(filters?: { active?: boolean; overdue?: boolean }) {
  const where: Record<string, unknown> = {};
  if (filters?.active !== undefined) where.isActive = filters.active;
  if (filters?.overdue) {
    where.isActive = true;
    where.returnedAt = null;
    where.expectedReturnAt = { lt: new Date() };
  }

  return prisma.allocation.findMany({
    where,
    include: {
      asset: { select: { id: true, assetTag: true, name: true, status: true } },
      holder: { select: { id: true, name: true, email: true } },
    },
    orderBy: { allocatedAt: 'desc' },
  });
}

export async function returnAsset(
  userId: string,
  userRole: string,
  allocationId: string,
  conditionNoteIn?: string
) {
  const allocation = await prisma.allocation.findUnique({
    where: { id: allocationId },
    include: { asset: true, holder: { select: { id: true, name: true } } },
  });
  if (!allocation) throw new NotFoundError('Allocation not found');
  if (!allocation.isActive) throw new BadRequestError('This allocation is already closed');

  // Only managers/admins or the current holder can return an asset
  const isManager = ['ADMIN', 'ASSET_MANAGER'].includes(userRole);
  if (!isManager && allocation.holderUserId !== userId) {
    throw new BadRequestError('Only the current holder or an asset manager can return this asset');
  }

  assertTransition(allocation.asset.status, 'AVAILABLE');

  await prisma.$transaction([
    prisma.allocation.update({
      where: { id: allocationId },
      data: { isActive: false, returnedAt: new Date(), conditionNoteIn: conditionNoteIn || null },
    }),
    prisma.asset.update({ where: { id: allocation.assetId }, data: { status: 'AVAILABLE' } }),
  ]);

  await logActivity(userId, 'ASSET_RETURNED', 'Asset', allocation.assetId, {
    assetTag: allocation.asset.assetTag,
    conditionNoteIn,
  });

  if (allocation.holderUserId && allocation.holderUserId !== userId) {
    await createNotification(
      allocation.holderUserId,
      'ASSET_RETURNED',
      `Asset ${allocation.asset.assetTag} (${allocation.asset.name}) has been marked as returned`
    );
  }

  return { returned: true };
}

// ─── Transfers ───────────────────────────────────────────────

export async function requestTransfer(userId: string, assetId: string, toUserId: string) {
  if (!toUserId) throw new BadRequestError('Target employee is required');

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      allocations: { where: { isActive: true }, take: 1 },
    },
  });
  if (!asset) throw new NotFoundError('Asset not found');

  const active = asset.allocations[0];
  if (!active) {
    throw new BadRequestError('Asset is not currently allocated — allocate it directly instead');
  }
  if (active.holderUserId === toUserId) {
    throw new BadRequestError('Asset is already held by this employee');
  }

  const existing = await prisma.transfer.findFirst({
    where: { assetId, status: 'REQUESTED' },
  });
  if (existing) {
    throw new ConflictError('A transfer request for this asset is already pending', {
      code: 'TRANSFER_PENDING',
    });
  }

  const transfer = await prisma.transfer.create({
    data: {
      assetId,
      fromUserId: active.holderUserId,
      toUserId,
    },
  });

  await logActivity(userId, 'TRANSFER_REQUESTED', 'Transfer', transfer.id, {
    assetTag: asset.assetTag,
    toUserId,
  });

  await notifyRole(
    'ASSET_MANAGER',
    'TRANSFER_REQUESTED',
    `Transfer requested for ${asset.assetTag} (${asset.name}) — pending your approval`
  );

  return transfer;
}

export async function listTransfers(filters?: { status?: string }) {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;

  const transfers = await prisma.transfer.findMany({
    where,
    include: { asset: { select: { id: true, assetTag: true, name: true } } },
    orderBy: { requestedAt: 'desc' },
  });

  const userIds = [
    ...new Set(
      transfers.flatMap((t) => [t.fromUserId, t.toUserId, t.decidedById]).filter(Boolean) as string[]
    ),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameOf = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return transfers.map((t) => ({
    ...t,
    fromUserName: t.fromUserId ? nameOf[t.fromUserId] ?? null : null,
    toUserName: t.toUserId ? nameOf[t.toUserId] ?? null : null,
    decidedByName: t.decidedById ? nameOf[t.decidedById] ?? null : null,
  }));
}

export async function decideTransfer(
  userId: string,
  transferId: string,
  decision: 'APPROVED' | 'REJECTED'
) {
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw new BadRequestError('Decision must be APPROVED or REJECTED');
  }

  const transfer = await prisma.transfer.findUnique({
    where: { id: transferId },
    include: { asset: true },
  });
  if (!transfer) throw new NotFoundError('Transfer request not found');
  if (transfer.status !== 'REQUESTED') {
    throw new BadRequestError('This transfer request has already been decided');
  }

  if (decision === 'REJECTED') {
    const updated = await prisma.transfer.update({
      where: { id: transferId },
      data: { status: 'REJECTED', decidedAt: new Date(), decidedById: userId },
    });
    await logActivity(userId, 'TRANSFER_REJECTED', 'Transfer', transferId, {
      assetTag: transfer.asset.assetTag,
    });
    if (transfer.toUserId) {
      await createNotification(
        transfer.toUserId,
        'TRANSFER_REJECTED',
        `Your transfer request for ${transfer.asset.assetTag} (${transfer.asset.name}) was rejected`
      );
    }
    return updated;
  }

  // APPROVED → close old allocation, create the new one, history updates automatically
  const activeAllocation = await prisma.allocation.findFirst({
    where: { assetId: transfer.assetId, isActive: true },
  });

  const ops = [];
  if (activeAllocation) {
    ops.push(
      prisma.allocation.update({
        where: { id: activeAllocation.id },
        data: { isActive: false, returnedAt: new Date(), conditionNoteIn: 'Transferred' },
      })
    );
  }
  ops.push(
    prisma.allocation.create({
      data: {
        assetId: transfer.assetId,
        holderUserId: transfer.toUserId,
        expectedReturnAt: activeAllocation?.expectedReturnAt ?? null,
      },
    }),
    prisma.asset.update({ where: { id: transfer.assetId }, data: { status: 'ALLOCATED' } }),
    prisma.transfer.update({
      where: { id: transferId },
      data: { status: 'COMPLETED', decidedAt: new Date(), decidedById: userId },
    })
  );
  await prisma.$transaction(ops);

  await logActivity(userId, 'TRANSFER_APPROVED', 'Transfer', transferId, {
    assetTag: transfer.asset.assetTag,
    fromUserId: transfer.fromUserId,
    toUserId: transfer.toUserId,
  });

  if (transfer.toUserId) {
    await createNotification(
      transfer.toUserId,
      'TRANSFER_APPROVED',
      `Transfer approved — ${transfer.asset.assetTag} (${transfer.asset.name}) is now allocated to you`
    );
  }
  if (transfer.fromUserId) {
    await createNotification(
      transfer.fromUserId,
      'TRANSFER_APPROVED',
      `${transfer.asset.assetTag} (${transfer.asset.name}) has been transferred from you`
    );
  }

  return prisma.transfer.findUnique({ where: { id: transferId } });
}
