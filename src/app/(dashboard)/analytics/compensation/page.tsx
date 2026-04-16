import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

const CompensationAnalyticsClient = dynamic(() => import('./CompensationAnalyticsClient'), {
  loading: () => <ChartSkeleton />,
})

export default async function CompensationAnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <CompensationAnalyticsClient user={user} />
  )
}
