import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
import bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding AssetFlow database...\n');

  // ─── 1. Admin User ────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@assetflow.com' },
    update: {},
    create: {
      name: 'Aarav Sharma',
      email: 'admin@assetflow.com',
      passwordHash: adminHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Admin: ${admin.email} (password: admin123)`);

  // ─── 2. Departments ───────────────────────────────────────
  const departments = await Promise.all(
    [
      { name: 'IT & Infrastructure' },
      { name: 'Engineering' },
      { name: 'Human Resources' },
      { name: 'Marketing' },
    ].map((d) =>
      prisma.department.upsert({
        where: { id: d.name.replace(/\s+/g, '-').toLowerCase() },
        update: {},
        create: { name: d.name },
      })
    )
  );
  console.log(`✅ Departments: ${departments.map((d) => d.name).join(', ')}`);

  // ─── 3. Asset Categories ──────────────────────────────────
  const categories = await Promise.all(
    [
      { name: 'Laptops', fields: { warrantyPeriodMonths: true, processor: true } },
      { name: 'Monitors', fields: { screenSize: true, resolution: true } },
      { name: 'Furniture', fields: { material: true } },
      { name: 'Vehicles', fields: { licensePlate: true, fuelType: true } },
    ].map((c) =>
      prisma.assetCategory.upsert({
        where: { id: c.name.toLowerCase() },
        update: {},
        create: { name: c.name, fields: c.fields },
      })
    )
  );
  console.log(`✅ Categories: ${categories.map((c) => c.name).join(', ')}`);

  // ─── 4. Employees ─────────────────────────────────────────
  const empPassword = await bcrypt.hash('password123', 10);

  const employees = [
    { name: 'Priya Patel', email: 'priya@assetflow.com', role: 'ASSET_MANAGER' as const, deptIdx: 0, status: 'ACTIVE' },
    { name: 'Rahul Gupta', email: 'rahul@assetflow.com', role: 'DEPARTMENT_HEAD' as const, deptIdx: 1, status: 'ACTIVE' },
    { name: 'Ananya Singh', email: 'ananya@assetflow.com', role: 'EMPLOYEE' as const, deptIdx: 0, status: 'ACTIVE' },
    { name: 'Vikram Reddy', email: 'vikram@assetflow.com', role: 'EMPLOYEE' as const, deptIdx: 1, status: 'ACTIVE' },
    { name: 'Meera Joshi', email: 'meera@assetflow.com', role: 'DEPARTMENT_HEAD' as const, deptIdx: 2, status: 'ACTIVE' },
    { name: 'Arjun Kumar', email: 'arjun@assetflow.com', role: 'EMPLOYEE' as const, deptIdx: 3, status: 'INACTIVE' },
    { name: 'Sneha Verma', email: 'sneha@assetflow.com', role: 'EMPLOYEE' as const, deptIdx: 2, status: 'ACTIVE' },
    { name: 'Karan Desai', email: 'karan@assetflow.com', role: 'EMPLOYEE' as const, deptIdx: 3, status: 'ACTIVE' },
  ];

  for (const emp of employees) {
    const user = await prisma.user.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        name: emp.name,
        email: emp.email,
        passwordHash: empPassword,
        role: emp.role,
        departmentId: departments[emp.deptIdx]!.id,
        status: emp.status,
      },
    });
    console.log(`✅ ${emp.role.padEnd(17)} ${user.name} (${user.email})`);
  }

  // Assign admin to IT department
  await prisma.user.update({
    where: { id: admin.id },
    data: { departmentId: departments[0]!.id },
  });

  // ─── 5. Track B demo data (assets, allocations, bookings, maintenance, audit) ───
  const assetCount = await prisma.asset.count();
  if (assetCount >= 15) {
    console.log(`\nℹ️  ${assetCount} assets already present — skipping Track B demo data.`);
  } else {
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    const byEmail = Object.fromEntries(users.map((u) => [u.email, u.id]));
    const priya = byEmail['priya@assetflow.com']!;
    const rahul = byEmail['rahul@assetflow.com']!;
    const ananya = byEmail['ananya@assetflow.com']!;
    const vikram = byEmail['vikram@assetflow.com']!;
    const sneha = byEmail['sneha@assetflow.com']!;
    const karan = byEmail['karan@assetflow.com']!;

    const lastAsset = await prisma.asset.findFirst({ orderBy: { assetTag: 'desc' } });
    let tagNum = lastAsset ? parseInt(lastAsset.assetTag.replace('AF-', ''), 10) : 0;
    const nextTag = () => `AF-${String(++tagNum).padStart(4, '0')}`;

    const cat = (name: string) => categories.find((c) => c.name === name)!.id;
    const dept = (name: string) => departments.find((d) => d.name.includes(name))!.id;

    const day = (offset: number, hour = 10) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      d.setHours(hour, 0, 0, 0);
      return d;
    };

    const assetSpecs = [
      { name: 'MacBook Pro 14"', c: 'Laptops', dep: 'IT', loc: 'HQ Floor 2', cost: 185000, cond: 'Good' },
      { name: 'Dell Latitude 5540', c: 'Laptops', dep: 'Engineering', loc: 'HQ Floor 3', cost: 92000, cond: 'Good' },
      { name: 'ThinkPad X1 Carbon', c: 'Laptops', dep: 'Engineering', loc: 'HQ Floor 3', cost: 145000, cond: 'New' },
      { name: 'HP EliteBook 840', c: 'Laptops', dep: 'Human', loc: 'HQ Floor 1', cost: 88000, cond: 'Fair' },
      { name: 'MacBook Air M3', c: 'Laptops', dep: 'Marketing', loc: 'HQ Floor 1', cost: 114000, cond: 'New' },
      { name: 'Dell UltraSharp 27"', c: 'Monitors', dep: 'Engineering', loc: 'HQ Floor 3', cost: 42000, cond: 'Good' },
      { name: 'LG 32" 4K Monitor', c: 'Monitors', dep: 'IT', loc: 'HQ Floor 2', cost: 38000, cond: 'Good' },
      { name: 'Samsung 24" Monitor', c: 'Monitors', dep: 'Human', loc: 'HQ Floor 1', cost: 15000, cond: 'Fair' },
      { name: 'Ergonomic Desk Chair', c: 'Furniture', dep: 'Human', loc: 'HQ Floor 1', cost: 22000, cond: 'Good' },
      { name: 'Standing Desk', c: 'Furniture', dep: 'Engineering', loc: 'HQ Floor 3', cost: 35000, cond: 'Good' },
      { name: 'Conference Room Alpha', c: 'Furniture', dep: 'IT', loc: 'HQ Floor 2', cost: 0, cond: 'Good', bookable: true },
      { name: 'Conference Room Beta', c: 'Furniture', dep: 'IT', loc: 'HQ Floor 1', cost: 0, cond: 'Good', bookable: true },
      { name: 'Projector Epson EB-X51', c: 'Monitors', dep: 'Marketing', loc: 'HQ Floor 1', cost: 45000, cond: 'Good', bookable: true },
      { name: 'Toyota Innova (Pool Car)', c: 'Vehicles', dep: 'IT', loc: 'Basement Parking', cost: 2100000, cond: 'Good', bookable: true },
      { name: 'Honda City (Pool Car)', c: 'Vehicles', dep: 'Marketing', loc: 'Basement Parking', cost: 1500000, cond: 'Fair', bookable: true },
      { name: 'iPad Pro 12.9"', c: 'Laptops', dep: 'Marketing', loc: 'HQ Floor 1', cost: 112000, cond: 'New' },
      { name: 'Canon EOS R6 Camera', c: 'Monitors', dep: 'Marketing', loc: 'HQ Floor 1', cost: 215000, cond: 'Good' },
      { name: 'Cisco IP Phone', c: 'Monitors', dep: 'IT', loc: 'HQ Floor 2', cost: 9000, cond: 'Good' },
    ];

    const assets: { id: string; name: string }[] = [];
    for (const s of assetSpecs) {
      const a = await prisma.asset.create({
        data: {
          assetTag: nextTag(),
          name: s.name,
          categoryId: cat(s.c),
          serialNumber: `SN-${Math.floor(10000 + Math.random() * 89999)}`,
          acquisitionDate: day(-Math.floor(90 + Math.random() * 400)),
          acquisitionCost: s.cost || null,
          condition: s.cond,
          location: s.loc,
          departmentId: dept(s.dep),
          isBookable: !!s.bookable,
        },
      });
      assets.push({ id: a.id, name: a.name });
    }
    console.log(`✅ ${assets.length} assets registered`);

    const asset = (name: string) => assets.find((a) => a.name === name)!.id;

    // Allocations — including one overdue and one due soon
    const allocations: [string, string, number | null, boolean][] = [
      // [assetName, holderId, expectedReturn offset days (null = open-ended), overdue?]
      ['MacBook Pro 14"', ananya, 30, false],
      ['Dell Latitude 5540', vikram, -6, true], // OVERDUE
      ['ThinkPad X1 Carbon', rahul, null, false],
      ['HP EliteBook 840', sneha, 3, false], // due soon → upcoming returns
      ['Dell UltraSharp 27"', vikram, null, false],
      ['Ergonomic Desk Chair', sneha, null, false],
      ['iPad Pro 12.9"', karan, -2, true], // OVERDUE
    ];
    for (const [name, holder, retOffset, _overdue] of allocations) {
      await prisma.allocation.create({
        data: {
          assetId: asset(name),
          holderUserId: holder,
          allocatedAt: day(-Math.floor(10 + Math.random() * 40)),
          expectedReturnAt: retOffset === null ? null : day(retOffset),
        },
      });
      await prisma.asset.update({ where: { id: asset(name) }, data: { status: 'ALLOCATED' } });
    }
    console.log(`✅ ${allocations.length} allocations (2 overdue, 1 due this week)`);

    // A returned allocation for history depth
    await prisma.allocation.create({
      data: {
        assetId: asset('MacBook Air M3'),
        holderUserId: karan,
        allocatedAt: day(-60),
        expectedReturnAt: day(-30),
        returnedAt: day(-28),
        conditionNoteIn: 'Returned in good condition, minor scuff on lid',
        isActive: false,
      },
    });

    // A pending transfer request (Vikram's overdue laptop → Ananya)
    await prisma.transfer.create({
      data: { assetId: asset('Dell Latitude 5540'), fromUserId: vikram, toUserId: ananya },
    });
    console.log('✅ 1 pending transfer request');

    // Bookings across this week for the heatmap + calendar demo
    const bookingSpecs: [string, string, number, number, number][] = [
      // [resourceName, bookedBy, dayOffset, startHour, endHour]
      ['Conference Room Alpha', ananya, 0, 9, 10],
      ['Conference Room Alpha', rahul, 0, 10, 12],
      ['Conference Room Alpha', sneha, 1, 14, 15],
      ['Conference Room Beta', karan, 1, 9, 11],
      ['Conference Room Beta', ananya, 2, 13, 14],
      ['Projector Epson EB-X51', sneha, 2, 10, 12],
      ['Toyota Innova (Pool Car)', rahul, 3, 8, 18],
      ['Conference Room Alpha', vikram, 3, 11, 12],
      ['Conference Room Beta', rahul, 4, 15, 17],
      ['Honda City (Pool Car)', karan, 5, 9, 13],
      ['Conference Room Alpha', ananya, -1, 9, 10], // completed
      ['Conference Room Beta', sneha, -2, 14, 16], // completed
    ];
    for (const [name, booker, d, sh, eh] of bookingSpecs) {
      await prisma.booking.create({
        data: {
          assetId: asset(name),
          bookedById: booker,
          startTime: day(d, sh),
          endTime: day(d, eh),
          status: d < 0 ? 'COMPLETED' : 'UPCOMING',
        },
      });
    }
    console.log(`✅ ${bookingSpecs.length} bookings across the week`);

    // Maintenance requests at different workflow stages
    await prisma.maintenanceRequest.create({
      data: {
        assetId: asset('Samsung 24" Monitor'),
        raisedById: sneha,
        issue: 'Screen flickers when brightness is above 60%',
        priority: 'HIGH',
        status: 'PENDING',
      },
    });
    await prisma.maintenanceRequest.create({
      data: {
        assetId: asset('LG 32" 4K Monitor'),
        raisedById: ananya,
        issue: 'Dead pixels in the top-right corner',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        technicianName: 'Ravi — TechCare Services',
      },
    });
    await prisma.asset.update({ where: { id: asset('LG 32" 4K Monitor') }, data: { status: 'UNDER_MAINTENANCE' } });
    await prisma.maintenanceRequest.create({
      data: {
        assetId: asset('Standing Desk'),
        raisedById: vikram,
        issue: 'Height adjustment motor makes grinding noise',
        priority: 'LOW',
        status: 'RESOLVED',
        technicianName: 'FurniFix Co.',
        createdAt: day(-20),
        resolvedAt: day(-15),
      },
    });
    await prisma.maintenanceRequest.create({
      data: {
        assetId: asset('Honda City (Pool Car)'),
        raisedById: karan,
        issue: 'AC not cooling, needs gas refill',
        priority: 'MEDIUM',
        status: 'APPROVED',
      },
    });
    console.log('✅ 4 maintenance requests (pending / approved / in-progress / resolved)');

    // An open audit cycle scoped to HQ with Priya assigned
    const hqAssets = await prisma.asset.findMany({
      where: { location: { contains: 'HQ Floor 2' } },
      select: { id: true },
    });
    const cycle = await prisma.auditCycle.create({
      data: {
        scopeLoc: 'HQ Floor 2',
        startDate: day(-2),
        endDate: day(12),
        assignments: { create: [{ auditorId: priya }] },
        items: { create: hqAssets.map((a) => ({ assetId: a.id })) },
      },
    });
    // Pre-verify one item so the cycle shows progress
    const firstItem = await prisma.auditItem.findFirst({ where: { auditCycleId: cycle.id } });
    if (firstItem) {
      await prisma.auditItem.update({ where: { id: firstItem.id }, data: { result: 'VERIFIED' } });
    }
    console.log(`✅ Open audit cycle (HQ Floor 2, ${hqAssets.length} assets, auditor: Priya)`);

    // Notifications so the bell isn't empty on first login
    const notifSpecs: [string, string, string][] = [
      [ananya, 'ASSET_ASSIGNED', 'Asset AF-0001 (MacBook Pro 14") has been assigned to you'],
      [vikram, 'OVERDUE_RETURN', 'Dell Latitude 5540 is past its expected return date — please return it'],
      [priya, 'TRANSFER_REQUESTED', 'Transfer requested for Dell Latitude 5540 — pending your approval'],
      [priya, 'MAINTENANCE_REQUESTED', 'New HIGH priority maintenance request for Samsung 24" Monitor'],
      [priya, 'AUDIT_ASSIGNED', 'You have been assigned as auditor on the HQ Floor 2 audit cycle'],
      [sneha, 'BOOKING_CONFIRMED', 'Booking confirmed: Conference Room Alpha tomorrow 14:00–15:00'],
    ];
    for (const [uid, type, message] of notifSpecs) {
      await prisma.notification.create({ data: { userId: uid, type, message } });
    }

    // Activity log entries so the trail looks alive
    const logSpecs: [string, string, string][] = [
      [priya, 'ASSET_REGISTERED', 'Asset'],
      [priya, 'ASSET_ALLOCATED', 'Asset'],
      [admin.id, 'DEPARTMENT_CREATED', 'Department'],
      [admin.id, 'AUDIT_CYCLE_CREATED', 'AuditCycle'],
      [ananya, 'BOOKING_CREATED', 'Booking'],
      [sneha, 'MAINTENANCE_RAISED', 'MaintenanceRequest'],
    ];
    for (const [uid, action, entityType] of logSpecs) {
      await prisma.activityLog.create({
        data: { userId: uid, action, entityType, entityId: 'seed', meta: { seeded: true } },
      });
    }
    console.log('✅ Notifications + activity log entries');
  }

  console.log('\n🎉 Seed complete! You can now log in with:');
  console.log('   Admin:          admin@assetflow.com / admin123');
  console.log('   Asset Manager:  priya@assetflow.com / password123');
  console.log('   Dept Head:      rahul@assetflow.com / password123');
  console.log('   Employee:       ananya@assetflow.com / password123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
