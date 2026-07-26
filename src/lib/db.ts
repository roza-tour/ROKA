import { PrismaClient } from '@prisma/client';

/**
 * عميل Prisma وحيد (singleton) لتفادي إنشاء اتصالات متعددة
 * أثناء إعادة التحميل الساخن في وضع التطوير.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export default db;
