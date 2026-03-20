// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Pre-hire Safety Screen (B-3k)
// 발령일 미도래 직원에게 안내 화면 표시
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/types'
import PreHireClient from './PreHireClient'

export const dynamic = 'force-dynamic'

export default async function PreHirePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser

  // Check for future assignment
  const futureAssignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: user.employeeId,
      isPrimary: true,
      endDate: null,
      effectiveDate: { gt: new Date() },
    },
    include: {
      company: { select: { name: true } },
      department: { select: { name: true } },
      position: { select: { titleKo: true } },
    },
    orderBy: { effectiveDate: 'asc' },
  })

  return (
    <PreHireClient
      userName={user.name ?? ''}
      futureAssignment={futureAssignment ? {
        effectiveDate: futureAssignment.effectiveDate.toISOString(),
        companyName: futureAssignment.company?.name ?? '',
        departmentName: futureAssignment.department?.name ?? '',
        positionTitle: futureAssignment.position?.titleKo ?? '',
      } : null}
    />
  )
}
