import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OnboardingDetailClient from './OnboardingDetailClient'

export default async function OnboardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session?.user) redirect('/login')
    const { id } = await params
    return <OnboardingDetailClient user={session.user} onboardingId={id} />
}
