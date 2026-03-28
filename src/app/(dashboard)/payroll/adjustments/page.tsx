import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import AdjustmentsClient from './AdjustmentsClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const metadata = {
    title: '수동 조정 | CTR HR Hub',
    description: '소급 지급, 보너스, 공제 등 급여 수동 조정을 추가합니다.',
}

export default async function AdjustmentsPage() {
    const session = await getServerSession(authOptions)
    if (!session?.user) redirect('/login')
    const user = session.user as SessionUser
    return (
        <Suspense fallback={<ListPageSkeleton />}>
            <AdjustmentsClient user={user} />
        </Suspense>
    )
}
