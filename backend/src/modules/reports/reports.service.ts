import prisma from '../../lib/prisma.js';

/** Most-used vs idle assets, plus status breakdown per category. */
export async function utilization() {
  const [assets, allocationCounts, statusGroups] = await Promise.all([
    prisma.asset.findMany({
      select: {
        id: true,
        assetTag: true,
        name: true,
        status: true,
        category: { select: { name: true } },
        _count: { select: { allocations: true, bookings: true } },
      },
    }),
    prisma.allocation.groupBy({
      by: ['assetId'],
      _count: { id: true },
    }),
    prisma.asset.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
  ]);

  const usage = assets
    .map((a) => ({
      id: a.id,
      assetTag: a.assetTag,
      name: a.name,
      status: a.status,
      category: a.category.name,
      usageCount: a._count.allocations + a._count.bookings,
    }))
    .sort((x, y) => y.usageCount - x.usageCount);

  const activeStatuses = ['AVAILABLE', 'ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE'];
  const activeAssets = assets.filter((a) => activeStatuses.includes(a.status));
  const utilizationRate =
    activeAssets.length > 0
      ? Math.round(
          (activeAssets.filter((a) => a.status === 'ALLOCATED').length / activeAssets.length) * 100
        )
      : 0;

  return {
    mostUsed: usage.slice(0, 10),
    idle: usage.filter((u) => u.usageCount === 0),
    utilizationRate,
    statusBreakdown: statusGroups.map((s) => ({ status: s.status, count: s._count.id })),
    totalAllocationsEver: allocationCounts.reduce((sum, c) => sum + c._count.id, 0),
  };
}

/** Maintenance request counts by asset and by category. */
export async function maintenanceFrequency() {
  const requests = await prisma.maintenanceRequest.findMany({
    select: {
      status: true,
      priority: true,
      createdAt: true,
      resolvedAt: true,
      asset: {
        select: { id: true, assetTag: true, name: true, category: { select: { name: true } } },
      },
    },
  });

  const byAsset = new Map<string, { assetTag: string; name: string; count: number }>();
  const byCategory = new Map<string, number>();
  const byPriority = new Map<string, number>();

  for (const r of requests) {
    const a = byAsset.get(r.asset.id) ?? { assetTag: r.asset.assetTag, name: r.asset.name, count: 0 };
    a.count += 1;
    byAsset.set(r.asset.id, a);
    byCategory.set(r.asset.category.name, (byCategory.get(r.asset.category.name) ?? 0) + 1);
    byPriority.set(r.priority, (byPriority.get(r.priority) ?? 0) + 1);
  }

  return {
    total: requests.length,
    open: requests.filter((r) => !['RESOLVED', 'REJECTED'].includes(r.status)).length,
    byAsset: [...byAsset.values()].sort((x, y) => y.count - x.count).slice(0, 10),
    byCategory: [...byCategory.entries()].map(([category, count]) => ({ category, count })),
    byPriority: [...byPriority.entries()].map(([priority, count]) => ({ priority, count })),
  };
}

/** Booking counts per weekday × hour-of-day — powers the heatmap. */
export async function bookingHeatmap() {
  const bookings = await prisma.booking.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: { startTime: true, endTime: true },
  });

  // 7 days × 24 hours grid
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const b of bookings) {
    const start = new Date(b.startTime);
    const end = new Date(b.endTime);
    // Count each hour the booking spans (capped at 24h to avoid runaway loops)
    const cursor = new Date(start);
    let guard = 0;
    while (cursor < end && guard < 24) {
      grid[cursor.getDay()]![cursor.getHours()] += 1;
      cursor.setHours(cursor.getHours() + 1);
      guard += 1;
    }
  }

  return { grid, totalBookings: bookings.length };
}

/** Allocation summary per department (Track A owns the dashboard variant; this is the report). */
export async function departmentSummary() {
  const departments = await prisma.department.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      _count: { select: { employees: true, assets: true } },
    },
    orderBy: { name: 'asc' },
  });

  const activeAllocations = await prisma.allocation.findMany({
    where: { isActive: true },
    select: {
      holderDepartmentId: true,
      holder: { select: { departmentId: true } },
    },
  });

  const allocCount = new Map<string, number>();
  for (const a of activeAllocations) {
    const deptId = a.holderDepartmentId ?? a.holder?.departmentId;
    if (deptId) allocCount.set(deptId, (allocCount.get(deptId) ?? 0) + 1);
  }

  return departments.map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    employees: d._count.employees,
    assetsOwned: d._count.assets,
    activeAllocations: allocCount.get(d.id) ?? 0,
  }));
}
