import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma.js';
import { logActivity } from '../../lib/logger.js';

const SALT_ROUNDS = 10;

export async function signup(name: string, email: string, password: string) {
  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'EMPLOYEE', // Signup always creates EMPLOYEE
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
      status: true,
      createdAt: true,
    },
  });

  await logActivity(user.id, 'USER_SIGNUP', 'User', user.id, { email });

  return user;
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (user.status !== 'ACTIVE') {
    throw new Error('Account is inactive. Contact your administrator.');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    secret,
    { expiresIn: '24h' }
  );

  await logActivity(user.id, 'USER_LOGIN', 'User', user.id, { email });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      status: user.status,
    },
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
      status: true,
      department: {
        select: { id: true, name: true },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}
