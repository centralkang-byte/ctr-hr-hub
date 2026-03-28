// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Org Snapshot Builder
// 조직도 스냅샷 데이터 구성 + upsert (cron + manual 공유)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

export async function buildOrgSnapshot(
  companyId: string,
  createdById?: string,
) {
  const [departments, totalHeadcount] = await Promise.all([
    prisma.department.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        parentId: true,
        _count: {
          select: {
            assignments: {
              where: {
                isPrimary: true,
                endDate: null,
                status: 'ACTIVE',
                employee: { deletedAt: null },
              },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.employee.count({
      where: {
        deletedAt: null,
        assignments: {
          some: {
            companyId,
            status: 'ACTIVE',
            isPrimary: true,
            endDate: null,
          },
        },
      },
    }),
  ])

  const snapshotData = {
    totalHeadcount,
    capturedAt: new Date().toISOString(),
    departments: departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      level: dept.level,
      parentId: dept.parentId,
      headcount: dept._count.assignments,
    })),
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return prisma.orgSnapshot.upsert({
    where: {
      companyId_snapshotDate: {
        companyId,
        snapshotDate: today,
      },
    },
    create: {
      companyId,
      snapshotDate: today,
      snapshotData,
      createdById: createdById ?? null,
    },
    update: {
      snapshotData,
      createdById: createdById ?? undefined,
    },
  })
}
