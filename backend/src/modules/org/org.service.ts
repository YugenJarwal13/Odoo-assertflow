import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { logActivity } from '../../lib/logger.js';
import { createNotification } from '../../lib/notifications.js';

// ─── Departments ─────────────────────────────────────────────

export async function listDepartments() {
  return prisma.department.findMany({
    include: {
      _count: { select: { employees: true, assets: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function createDepartment(
  userId: string,
  data: { name: string; headId?: string; parentId?: string }
) {
  const dept = await prisma.department.create({
    data: {
      name: data.name,
      headId: data.headId,
      parentId: data.parentId,
    },
  });

  await logActivity(userId, 'DEPARTMENT_CREATED', 'Department', dept.id, {
    name: dept.name,
  });

  return dept;
}

export async function updateDepartment(
  userId: string,
  id: string,
  data: { name?: string; headId?: string | null; parentId?: string | null; status?: string }
) {
  const dept = await prisma.department.update({
    where: { id },
    data,
  });

  await logActivity(userId, 'DEPARTMENT_UPDATED', 'Department', dept.id, {
    name: dept.name,
    changes: data,
  });

  return dept;
}

// ─── Asset Categories ────────────────────────────────────────

export async function listCategories() {
  return prisma.assetCategory.findMany({
    include: {
      _count: { select: { assets: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function createCategory(
  userId: string,
  data: { name: string; fields?: Record<string, unknown> }
) {
  const cat = await prisma.assetCategory.create({
    data: {
      name: data.name,
      fields: data.fields as Prisma.InputJsonValue | undefined,
    },
  });

  await logActivity(userId, 'CATEGORY_CREATED', 'AssetCategory', cat.id, {
    name: cat.name,
  });

  return cat;
}

export async function updateCategory(
  userId: string,
  id: string,
  data: { name?: string; fields?: Record<string, unknown> }
) {
  const cat = await prisma.assetCategory.update({
    where: { id },
    data: {
      name: data.name,
      fields: data.fields as Prisma.InputJsonValue | undefined,
    },
  });

  await logActivity(userId, 'CATEGORY_UPDATED', 'AssetCategory', cat.id, {
    name: cat.name,
  });

  return cat;
}

// ─── Employees ───────────────────────────────────────────────

export async function listEmployees(filters?: {
  status?: string;
  departmentId?: string;
  q?: string;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.departmentId) {
    where.departmentId = filters.departmentId;
  }
  if (filters?.q) {
    where.OR = [
      { name: { contains: filters.q, mode: 'insensitive' } },
      { email: { contains: filters.q, mode: 'insensitive' } },
    ];
  }

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  });
}

export async function createEmployee(
  adminUserId: string,
  data: { name: string; email: string; role: string; departmentId?: string; status?: string }
) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new Error('An employee with this email already exists');
  }

  const passwordHash = await bcrypt.hash('password123', 10); // default password

  const employee = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role as 'ADMIN' | 'ASSET_MANAGER' | 'DEPARTMENT_HEAD' | 'EMPLOYEE',
      departmentId: data.departmentId || null,
      status: data.status || 'ACTIVE',
    },
    select: { id: true, name: true, email: true, role: true, departmentId: true, status: true },
  });

  await logActivity(adminUserId, 'EMPLOYEE_CREATED', 'User', employee.id, { name: employee.name, email: employee.email });
  return employee;
}

export async function updateEmployeeDetails(
  adminUserId: string,
  employeeId: string,
  data: { name?: string; role?: string; departmentId?: string | null; status?: string }
) {
  const validRoles = ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'];
  if (data.role && !validRoles.includes(data.role)) {
    throw new Error(`Invalid role: ${data.role}`);
  }

  const employee = await prisma.user.update({
    where: { id: employeeId },
    data: {
      name: data.name,
      role: data.role as 'ADMIN' | 'ASSET_MANAGER' | 'DEPARTMENT_HEAD' | 'EMPLOYEE' | undefined,
      departmentId: data.departmentId,
      status: data.status,
    },
    select: { id: true, name: true, email: true, role: true, departmentId: true, status: true },
  });

  await logActivity(adminUserId, 'EMPLOYEE_UPDATED', 'User', employeeId, { changes: data });
  return employee;
}

export async function updateEmployeeRole(
  adminUserId: string,
  employeeId: string,
  newRole: string
) {
  const validRoles = ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'];
  if (!validRoles.includes(newRole)) {
    throw new Error(`Invalid role: ${newRole}`);
  }

  const employee = await prisma.user.update({
    where: { id: employeeId },
    data: { role: newRole as 'ADMIN' | 'ASSET_MANAGER' | 'DEPARTMENT_HEAD' | 'EMPLOYEE' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      departmentId: true,
    },
  });

  await logActivity(adminUserId, 'ROLE_CHANGED', 'User', employeeId, {
    newRole,
    employeeName: employee.name,
  });

  await createNotification(
    employeeId,
    'ROLE_CHANGED',
    `Your role has been updated to ${newRole.replace(/_/g, ' ')}`
  );

  return employee;
}
