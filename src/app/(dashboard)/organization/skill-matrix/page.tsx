// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 스킬 매트릭스 페이지 (B8-3)
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import SkillMatrixClient from './SkillMatrixClient'
import type { SessionUser } from '@/types'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const dynamic = 'force-dynamic'

export default async function SkillMatrixPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser
  const allowedRoles = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EXECUTIVE']
  if (!allowedRoles.includes(user.role)) redirect('/my/skills')

  // 부서 목록 로드 (현재 법인)
  const departments = await prisma.department.findMany({
    where: { companyId: user.companyId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <SkillMatrixClient user={user} departments={departments} />
    </Suspense>
  )
}
