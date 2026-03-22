'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — OrgClientWrapper
// dynamic({ ssr: false })는 Client Component에서만 사용 가능
// ═══════════════════════════════════════════════════════════

import dynamic from 'next/dynamic'
import type { SessionUser, RefOption } from '@/types'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

const OrgClient = dynamic(
  () => import('./OrgClient').then(m => ({ default: m.OrgClient })),
  { ssr: false, loading: () => <ChartSkeleton className="h-[600px]" /> },
)

export function OrgClientWrapper({ user, companies }: { user: SessionUser; companies: RefOption[] }) {
  return <OrgClient user={user} companies={companies} />
}
