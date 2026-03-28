import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OnboardingDetailClient from './OnboardingDetailClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function OnboardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session?.user) redirect('/login')
    const { id } = await params
    return (
        <Suspense fallback={<ListPageSkeleton />}>
            <OnboardingDetailClient user={session.user} onboardingId={id} />
        </Suspense>
    )
}
