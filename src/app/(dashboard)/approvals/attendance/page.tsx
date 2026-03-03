import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { AttendanceApprovalClient } from './AttendanceApprovalClient'

export const metadata = { title: '통합 승인함 | CTR HR Hub' }

export default async function AttendanceApprovalPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <AttendanceApprovalClient user={user} />
}
