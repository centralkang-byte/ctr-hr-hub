import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { BenefitsClient } from './BenefitsClient'

export const metadata = { title: '복리후생 관리 | CTR HR Hub' }

export default async function BenefitsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <BenefitsClient user={user} />
}
