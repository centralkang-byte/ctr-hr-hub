import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { MyBenefitsClient } from './MyBenefitsClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const metadata = { title: '나의 복리후생 | CTR HR Hub' }

export default async function MyBenefitsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <MyBenefitsClient user={user} />
    </Suspense>
  )
}
