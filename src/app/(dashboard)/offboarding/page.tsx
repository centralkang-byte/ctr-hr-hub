// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /offboarding (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { OffboardingDashboardClient } from './OffboardingDashboardClient'

export default async function OffboardingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  const companies =
    user.role === ROLE.SUPER_ADMIN
      ? await prisma.company.findMany({
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        })
      : []

  return <OffboardingDashboardClient user={user} companies={companies} />
}
