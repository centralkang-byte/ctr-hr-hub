import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PayrollSettingsClient } from './PayrollSettingsClient'

export const dynamic = 'force-dynamic'

export default async function PayrollSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  return <PayrollSettingsClient />
}
