import prisma from '../../lib/prisma.js';

export async function getKpis() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Run all queries in parallel for speed
  const [
    totalAssets,
    availableAssets,
    totalEmployees,
    allocatedAssets,
    overdueAllocations,
    overdueList,
    upcomingReturns,
    pendingMaintenance,
    maintenanceToday,
    activeBookings,
    pendingTransfers,
    assetsByStatus,
    departmentSummary,
    recentActivity,
  ] = await Promise.all([
    prisma.asset.count(),

    prisma.asset.count({ where: { status: 'AVAILABLE' } }),

    prisma.user.count({ where: { status: 'ACTIVE' } }),

    prisma.asset.count({ where: { status: 'ALLOCATED' } }),

    // Overdue allocations (past expectedReturnAt, still active)
    prisma.allocation.count({
      where: { isActive: true, expectedReturnAt: { lt: now }, returnedAt: null },
    }),

    // The actual overdue rows for the highlighted dashboard panel
    prisma.allocation.findMany({
      where: { isActive: true, expectedReturnAt: { lt: now }, returnedAt: null },
      take: 6,
      orderBy: { expectedReturnAt: 'asc' },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        holder: { select: { id: true, name: true } },
      },
    }),

    // Returns expected within the next 7 days (not yet overdue)
    prisma.allocation.count({
      where: { isActive: true, returnedAt: null, expectedReturnAt: { gte: now, lte: weekAhead } },
    }),

    prisma.maintenanceRequest.count({ where: { status: 'PENDING' } }),

    // Maintenance activity today (anything raised or in an active state today)
    prisma.maintenanceRequest.count({
      where: {
        OR: [
          { createdAt: { gte: todayStart, lt: todayEnd } },
          { status: { in: ['APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS'] } },
        ],
      },
    }),

    prisma.booking.count({ where: { status: { in: ['UPCOMING', 'ONGOING'] } } }),

    prisma.transfer.count({ where: { status: 'REQUESTED' } }),

    prisma.asset.groupBy({ by: ['status'], _count: { id: true } }),

    prisma.department.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { employees: true, assets: true } },
      },
      orderBy: { name: 'asc' },
    }),

    prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, role: true } } },
    }),
  ]);

  return {
    totalAssets,
    availableAssets,
    totalEmployees,
    allocatedAssets,
    overdueAllocations,
    overdueList,
    upcomingReturns,
    pendingMaintenance,
    maintenanceToday,
    activeBookings,
    pendingTransfers,
    assetsByStatus: assetsByStatus.map((s) => ({ status: s.status, count: s._count.id })),
    departmentSummary: departmentSummary.map((d) => ({
      id: d.id,
      name: d.name,
      employeeCount: d._count.employees,
      assetCount: d._count.assets,
    })),
    recentActivity,
  };
}
