import { PrismaClient } from '@pterodactyl/db';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['APP_DEBUG'] === 'true'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

if (process.env['APP_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
