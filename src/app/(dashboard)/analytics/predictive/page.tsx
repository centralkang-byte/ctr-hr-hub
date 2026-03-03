import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import PredictiveAnalyticsClient from './PredictiveAnalyticsClient'

export default async function PredictiveAnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user = session.user as { role?: string }
  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role ?? '')) {
    redirect('/analytics')
  }

  return <PredictiveAnalyticsClient />
}
