import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { CompareClient } from './CompareClient'

export const metadata = { title: '글로벌 법인 비교 | CTR HR Hub' }

export default async function ComparePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  const allowedRoles = [ROLE.HR_ADMIN, ROLE.SUPER_ADMIN, ROLE.EXECUTIVE]
  if (!allowedRoles.includes(user.role as never)) redirect('/dashboard')
  return <CompareClient />
}
