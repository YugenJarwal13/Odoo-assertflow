import prisma from './prisma.js';

export async function createNotification(
  userId: string,
  type: string,
  message: string
) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        message,
      },
    });
  } catch (err) {
    // Best-effort — don't crash the parent operation
    console.error('Failed to create notification:', err);
  }
}
