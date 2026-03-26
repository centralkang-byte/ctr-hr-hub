import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import MyGoalsClient from './MyGoalsClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function MyGoalsPage() {
    const session = await getServerSession(authOptions)
    if (!session?.user) redirect('/login')
    const user = session.user as SessionUser
    return (
      <Suspense fallback={<ListPageSkeleton />}>
        <MyGoalsClient user={user} />
      </Suspense>
    )
}
