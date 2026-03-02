import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import YearEndHRClient from './YearEndHRClient'

export default async function YearEndHRPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser

  // Only HR_ADMIN and SUPER_ADMIN can access this page
  if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
    redirect('/home')
  }

  const currentYear = new Date().getFullYear()

  return <YearEndHRClient user={user} defaultYear={currentYear} />
}
