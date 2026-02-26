// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Prisma Client Singleton
// ═══════════════════════════════════════════════════════════

import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  __prisma: PrismaClient | undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma 7 type issue with accelerateUrl
export const prisma: PrismaClient =
  globalForPrisma.__prisma ??
  new (PrismaClient as any)({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma
}
