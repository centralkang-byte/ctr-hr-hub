// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /employees (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { EmployeeListClient } from './EmployeeListClient'

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return <EmployeeListClient user={user} />
}
