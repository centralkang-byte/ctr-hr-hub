// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Prisma Client Singleton
// ═══════════════════════════════════════════════════════════

// server-only: 클라이언트 번들로 절대 포함되지 않도록 강제.
// 이 줄이 없으면 'use client' 컴포넌트가 prisma를 import할 경우
// Vercel 빌드가 조용히 실패함.
import 'server-only'

import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  __prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    // Return a client that will fail on actual DB calls but won't crash on import
    // This allows the app to start even without a DB connection (e.g., for SSG/build)
    return new PrismaClient({
      adapter: new PrismaPg({ connectionString: 'postgresql://localhost:5432/placeholder' }),
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
  }
  const isSupabase =
    connectionString.includes('supabase.co') || connectionString.includes('supabase.com')
  // CI uses a plain-TCP Postgres container on localhost; production builds
  // (next start) force NODE_ENV=production, which would otherwise enable SSL
  // against a host that does not support it and break every Prisma query.
  const isLocalhost =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1')
  const ssl =
    !isLocalhost && (isSupabase || process.env.NODE_ENV === 'production')
      ? { rejectUnauthorized: false }
      : undefined
  const adapter = new PrismaPg({ connectionString, ssl })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const prisma: PrismaClient =
  globalForPrisma.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma
}
