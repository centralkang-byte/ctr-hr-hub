import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PerformanceSettingsClient } from './PerformanceSettingsClient'

export const dynamic = 'force-dynamic'

export default async function PerformanceSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  return <PerformanceSettingsClient />
}
