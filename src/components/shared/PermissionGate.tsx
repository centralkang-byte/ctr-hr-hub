// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PermissionGate (Server Component)
// 권한 체크 후 children 렌더링 또는 fallback/null
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import type { SessionUser } from '@/types'

interface PermissionGateProps {
  permission: string
  children: ReactNode
  fallback?: ReactNode
}

export async function PermissionGate({
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return <>{fallback}</>
  }

  const user = session.user as SessionUser
  const [module, action] = permission.split(':')

  if (!module || !action) {
    return <>{fallback}</>
  }

  if (hasPermission(user, { module, action })) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
