import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTranslations } from 'next-intl/server'
import type { SessionUser } from '@/types'
import AdjustmentsClient from './AdjustmentsClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
    const t = await getTranslations('payroll')
    return { title: `${t('page.adjustments')} | CTR HR Hub` }
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
