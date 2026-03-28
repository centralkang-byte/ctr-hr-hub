'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Admin Hub Client
// 성과 관리 4개 탭을 단일 허브로 통합
// URL (?tab=) 동기화: /performance/admin?tab=goals → 목표 탭 자동 활성화
// ═══════════════════════════════════════════════════════════

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { SessionUser } from '@/types'

// 하위 탭 컴포넌트
import PerformanceClient from '../PerformanceClient'
import GoalsClient from '../goals/GoalsClient'
import AdminResultsClient from './AdminResultsClient'
import PeerReviewClient from '../peer-review/PeerReviewClient'

// ─── Types ──────────────────────────────────────────────────

type PerformanceAdminTab = 'overview' | 'goals' | 'results' | 'peer-review'

// ─── Constants ──────────────────────────────────────────────

const VALID_TABS = new Set<PerformanceAdminTab>([
  'overview', 'goals', 'results', 'peer-review',
])

function resolveDefaultTab(searchParamTab: string | null): PerformanceAdminTab {
  if (searchParamTab && VALID_TABS.has(searchParamTab as PerformanceAdminTab)) {
    return searchParamTab as PerformanceAdminTab
  }
  return 'overview'
}

// ─── Component ──────────────────────────────────────────────

interface Props {
  user: SessionUser
  defaultTab?: PerformanceAdminTab
}

export function PerformanceAdminHubClient({ user, defaultTab }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('nav')

  const activeTab: PerformanceAdminTab =
    resolveDefaultTab(searchParams.get('tab')) ??
    defaultTab ??
    'overview'

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === 'overview') {
        params.delete('tab')
      } else {
        params.set('tab', value)
      }
      const query = params.toString()
      router.replace(`/performance/admin${query ? `?${query}` : ''}`, { scroll: false })
    },
    [router, searchParams],
  )

  const tabLabel = (key: string, fallback: string) => {
    try { return t(`performance.${key}`) } catch { return fallback }
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="border-b border-[#F0F0F3] overflow-x-auto">
          <TabsList className="h-auto bg-transparent p-0 w-full justify-start gap-0 rounded-none">
            {[
              { value: 'overview',    label: '개요' },
              { value: 'goals',       label: tabLabel('goals', '목표 관리') },
              { value: 'results',     label: tabLabel('results', '성과 결과') },
              { value: 'peer-review', label: tabLabel('peerReview', '동료 평가') },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium text-[#8181A5] data-[state=active]:border-[#5E81F4] data-[state=active]:text-[#5E81F4] data-[state=active]:bg-transparent hover:text-[#1C1D21]"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Radix Tabs 기본 동작: 비활성 탭은 언마운트 → 활성 탭만 API 호출 */}
        <TabsContent value="overview"><PerformanceClient user={user} /></TabsContent>
        <TabsContent value="goals"><GoalsClient user={user} /></TabsContent>
        <TabsContent value="results"><AdminResultsClient user={user} /></TabsContent>
        <TabsContent value="peer-review"><PeerReviewClient user={user} /></TabsContent>
      </Tabs>
    </div>
  )
}

export type { PerformanceAdminTab }
