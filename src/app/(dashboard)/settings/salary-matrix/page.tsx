import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { SalaryMatrixClient } from './SalaryMatrixClient'

export default async function SalaryMatrixPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <SalaryMatrixClient user={user} />
}
