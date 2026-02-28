import { PrismaClient } from './src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new (PrismaClient as any)({ adapter })
  const rows = await prisma.ssoIdentity.findMany({ select: { email: true, provider: true }, take: 10 })
  console.log(JSON.stringify(rows, null, 2))
  await prisma.$disconnect()
}
main().catch(console.error)
