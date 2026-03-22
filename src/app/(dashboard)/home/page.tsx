// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Dashboard Home (Server Component)
// 역할별 홈 페이지 분기
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { EmployeeHome } from '@/components/home/EmployeeHome'
import { ManagerHome } from '@/components/home/ManagerHome'
import { HrAdminHome } from '@/components/home/HrAdminHome'
import { ExecutiveHome } from '@/components/home/ExecutiveHome'
import { HomeSkeleton } from '@/components/shared/PageSkeleton'

// ─── Page ─────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent user={user} />
    </Suspense>
  )
}

function HomeContent({ user }: { user: SessionUser }) {
  switch (user.role) {
    case ROLE.SUPER_ADMIN:
    case ROLE.HR_ADMIN:
      return <HrAdminHome user={user} />

    case ROLE.MANAGER:
      return <ManagerHome user={user} />

    case ROLE.EXECUTIVE:
      return <ExecutiveHome user={user} />

    default:
      return <EmployeeHome user={user} />
  }
}
