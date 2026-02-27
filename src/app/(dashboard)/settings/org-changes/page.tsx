// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /settings/org-changes (Server Page)
// 조직개편 관리: HR_ADMIN 전용
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE } from '@/lib/constants'
import type { SessionUser, RefOption } from '@/types'
import { OrgChangesClient } from './OrgChangesClient'

export default async function OrgChangesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser

  // HR_ADMIN / SUPER_ADMIN only
  if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
    redirect('/employees')
  }

  const companyFilter =
    user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

  const [companies, departments] = await Promise.all([
    user.role === ROLE.SUPER_ADMIN
      ? prisma.company.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : [],
    prisma.department.findMany({
      where: { deletedAt: null, ...companyFilter },
      select: { id: true, name: true, companyId: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <OrgChangesClient
      user={user}
      companies={companies}
      departments={departments as RefOption[]}
    />
  )
}
