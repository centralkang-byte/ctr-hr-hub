import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AttendanceSettingsV2Client } from './AttendanceSettingsV2Client'

export const dynamic = 'force-dynamic'

export default async function AttendanceSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  return <AttendanceSettingsV2Client />
}
