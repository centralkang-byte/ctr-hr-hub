// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Seed: MANAGER compensation_read permission
// MANAGER needs compensation read access for off-cycle requests
// ═══════════════════════════════════════════════════════════

import type { PrismaClient } from '../../src/generated/prisma/client.js'

export async function seedManagerCompensationPerm(prisma: PrismaClient) {
  console.log('\n🔐 Adding MANAGER compensation permissions...\n')

  const managerRole = await prisma.role.findFirst({
    where: { name: 'Manager' },
    select: { id: true },
  })

  if (!managerRole) {
    console.log('  ⚠️ Manager role not found — skipping')
    return
  }

  // compensation_read + compensation_create for off-cycle
  const permsToAdd = [
    { module: 'compensation', action: 'read' },
    { module: 'compensation', action: 'create' },
  ]

  for (const { module, action } of permsToAdd) {
    const perm = await prisma.permission.findFirst({
      where: { module, action },
      select: { id: true },
    })

    if (!perm) {
      console.log(`  ⚠️ ${module}_${action} permission not found`)
      continue
    }

    const existing = await prisma.rolePermission.findFirst({
      where: { roleId: managerRole.id, permissionId: perm.id },
    })

    if (existing) {
      console.log(`  ✅ Manager already has ${module}_${action}`)
      continue
    }

    await prisma.rolePermission.create({
      data: { roleId: managerRole.id, permissionId: perm.id },
    })
    console.log(`  ✅ Manager → ${module}_${action} added`)
  }
}
