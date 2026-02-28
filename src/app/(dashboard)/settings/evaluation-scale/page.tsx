import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { EvaluationScaleClient } from './EvaluationScaleClient'

export default async function EvaluationScalePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <EvaluationScaleClient user={user} />
}
