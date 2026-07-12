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
