import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { MyLeaveClient } from './MyLeaveClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const metadata = { title: '내 휴가 | CTR HR Hub' }

export default async function MyLeavePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <MyLeaveClient user={user} />
    </Suspense>
  )
}
