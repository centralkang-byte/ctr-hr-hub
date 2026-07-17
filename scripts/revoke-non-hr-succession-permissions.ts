// ═══════════════════════════════════════════════════════════
// Revoke Non-HR Succession Permissions
// ───────────────────────────────────────────────────────────
// Dry-run by default. Deletes only role_permissions rows where:
//   role.code IN (EMPLOYEE, MANAGER, EXECUTIVE)
//   permission.module = succession
//
// Usage:
//   npx tsx scripts/revoke-non-hr-succession-permissions.ts
//   npx tsx scripts/revoke-non-hr-succession-permissions.ts --confirm-revoke
// ═══════════════════════════════════════════════════════════

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const NON_HR_ROLES = ['EMPLOYEE', 'MANAGER', 'EXECUTIVE'] as const

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const adapter = new PrismaPg({ connectionString: databaseUrl })
  const prisma = new PrismaClient({ adapter })

  try {
    const targets = await prisma.rolePermission.findMany({
      where: {
        role: { code: { in: [...NON_HR_ROLES] } },
        permission: { module: 'succession' },
      },
      select: {
        id: true,
        role: { select: { code: true } },
        permission: { select: { action: true } },
      },
      orderBy: [{ role: { code: 'asc' } }, { permission: { action: 'asc' } }],
    })

    console.log('Non-HR succession permission targets:')
    if (targets.length === 0) {
      console.log('  none')
      return
    }
    for (const target of targets) {
      console.log(`  ${target.role.code}:succession:${target.permission.action} (${target.id})`)
    }

    if (!process.argv.includes('--confirm-revoke')) {
      console.log(`\nDry run only. ${targets.length} row(s) would be deleted.`)
      console.log('Re-run with --confirm-revoke after reviewing the exact targets.')
      return
    }

    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.rolePermission.deleteMany({
        where: {
          id: { in: targets.map((target) => target.id) },
          role: { code: { in: [...NON_HR_ROLES] } },
          permission: { module: 'succession' },
        },
      })
      if (deleted.count !== targets.length) {
        throw new Error(
          `Cleanup target changed during execution: expected ${targets.length}, deleted ${deleted.count}`,
        )
      }
      const remaining = await tx.rolePermission.count({
        where: {
          role: { code: { in: [...NON_HR_ROLES] } },
          permission: { module: 'succession' },
        },
      })
      if (remaining !== 0) {
        throw new Error(`Cleanup verification failed: ${remaining} row(s) remain`)
      }
      return deleted.count
    })

    console.log(`\nDeleted ${result} non-HR succession permission row(s).`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
