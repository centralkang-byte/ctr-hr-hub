// Fix 1-11 + Fix 1-12: Add missing MANAGER permissions
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const DATABASE_URL = process.env.DATABASE_URL!
const adapter = new PrismaPg({ connectionString: DATABASE_URL })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

async function main() {
  const managerRole = await prisma.role.findFirst({ where: { code: 'MANAGER' } })
  if (!managerRole) { console.error('MANAGER role not found'); return }
  console.log('MANAGER role ID:', managerRole.id)

  const permissionsToAdd = [
    { module: 'attendance', action: 'manage' },  // Fix 1-11: shift-change approve
    { module: 'performance', action: 'create' },  // Fix 1-12: 1:1 creation
  ]

  const existing = await prisma.rolePermission.findMany({
    where: { roleId: managerRole.id },
    include: { permission: true }
  })
  const existingKeys = new Set(existing.map(e => `${e.permission.module}_${e.permission.action}`))

  for (const { module, action } of permissionsToAdd) {
    const key = `${module}_${action}`
    if (existingKeys.has(key)) {
      console.log(`⏭️ ${key} already exists`)
      continue
    }

    const perm = await prisma.permission.findFirst({ where: { module, action } })
    if (!perm) {
      console.log(`❌ ${key} permission module not found`)
      continue
    }

    await prisma.rolePermission.create({
      data: { roleId: managerRole.id, permissionId: perm.id }
    })
    console.log(`✅ Added ${key}`)
  }

  // Verify
  const updated = await prisma.rolePermission.findMany({
    where: { roleId: managerRole.id },
    include: { permission: true },
    orderBy: { permission: { module: 'asc' } }
  })
  console.log('\nFinal MANAGER permissions:')
  for (const rp of updated) {
    console.log(`  ${rp.permission.module}:${rp.permission.action}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
