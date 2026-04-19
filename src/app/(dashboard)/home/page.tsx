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
import { EmployeeHomeV2 } from '@/components/home/EmployeeHomeV2'
import { ManagerHomeV2 } from '@/components/home/ManagerHomeV2'
import { HrAdminHomeV2 } from '@/components/home/HrAdminHomeV2'
import { ExecutiveHomeV2 } from '@/components/home/ExecutiveHomeV2'
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
      return <HrAdminHomeV2 user={user} />

    case ROLE.MANAGER:
      return <ManagerHomeV2 user={user} />

    case ROLE.EXECUTIVE:
      return <ExecutiveHomeV2 user={user} />

    default:
      return <EmployeeHomeV2 user={user} />
  }
}
