import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

const AttritionRiskClient = dynamic(() => import('./AttritionRiskClient'), {
  loading: () => <ChartSkeleton />,
})

export default async function AttritionRiskPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <AttritionRiskClient user={user} />
  )
}
