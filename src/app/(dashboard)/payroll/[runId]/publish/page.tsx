import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import PayrollPublishDashboardClient from './PayrollPublishDashboardClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

interface Props {
    params: Promise<{ runId: string }>
}

export default async function PayrollPublishPage({ params }: Props) {
    const { runId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) redirect('/login')
    const user = session.user as SessionUser
    return (
        <Suspense fallback={<ListPageSkeleton />}>
            <PayrollPublishDashboardClient user={user} runId={runId} />
        </Suspense>
    )
}
