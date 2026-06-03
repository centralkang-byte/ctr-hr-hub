import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import BulkMovementsClient from './BulkMovementsClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function BulkMovementsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  // 조직변경(발령) = HR 전용. EMPLOYEE/MANAGER 페이지 직접 로드 차단 (API는 withPermission으로 별도 방어).
  const allowedRoles = [ROLE.HR_ADMIN, ROLE.SUPER_ADMIN]
  if (!allowedRoles.includes(user.role as never)) {
    redirect('/')
  }

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <BulkMovementsClient user={user} />
    </Suspense>
  )
}
