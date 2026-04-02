#!/usr/bin/env tsx
// Run quarterly review seed independently
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { seedQuarterlyReviews } from '../prisma/seeds/44-quarterly-reviews'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL not set')

const adapter = new PrismaPg({ connectionString: DATABASE_URL })
const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

async function main() {
  try {
    await seedQuarterlyReviews(prisma)
    console.log('✅ Quarterly review seed complete')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
