import prisma from '../../lib/prisma.js';

export async function getKpis() {
  // Run all queries in parallel for speed
  const [
    totalAssets,
    totalEmployees,
    allocatedAssets,
    overdueAllocations,
    pendingMaintenance,
    activeBookings,
    assetsByStatus,
    departmentSummary,
    recentActivity,
  ] = await Promise.all([
    // Total assets
    prisma.asset.count(),

    // Active employees
    prisma.user.count({ where: { status: 'ACTIVE' } }),

    // Currently allocated assets
    prisma.asset.count({ where: { status: 'ALLOCATED' } }),

    // Overdue allocations (past expectedReturnAt, still active)
    prisma.allocation.count({
      where: {
        isActive: true,
        expectedReturnAt: { lt: new Date() },
        returnedAt: null,
      },
    }),

    // Pending maintenance requests
    prisma.maintenanceRequest.count({
      where: { status: 'PENDING' },
    }),

    // Active bookings (UPCOMING or ONGOING)
    prisma.booking.count({
      where: { status: { in: ['UPCOMING', 'ONGOING'] } },
    }),

    // Assets grouped by status
    prisma.asset.groupBy({
      by: ['status'],
      _count: { id: true },
    }),

    // Department-wise allocation summary
    prisma.department.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { employees: true, assets: true },
        },
      },
      orderBy: { name: 'asc' },
    }),

    // Recent activity (last 10)
    prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, role: true } },
      },
    }),
  ]);

  return {
    totalAssets,
    totalEmployees,
    allocatedAssets,
    overdueAllocations,
    pendingMaintenance,
    activeBookings,
    assetsByStatus: assetsByStatus.map((s) => ({
      status: s.status,
      count: s._count.id,
    })),
    departmentSummary: departmentSummary.map((d) => ({
      id: d.id,
      name: d.name,
      employeeCount: d._count.employees,
      assetCount: d._count.assets,
    })),
    recentActivity,
  };
}
