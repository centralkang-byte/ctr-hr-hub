import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { SalaryBandsClient } from './SalaryBandsClient'

export default async function SalaryBandsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <SalaryBandsClient user={user} />
}
