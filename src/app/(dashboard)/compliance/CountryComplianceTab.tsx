'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Country Compliance Tab
// kr/cn/ru 국가별 컴플라이언스 — compact tabs로 전환
// ═══════════════════════════════════════════════════════════

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { SessionUser } from '@/types'

import KrComplianceClient from './kr/KrComplianceClient'
import CnComplianceClient from './cn/CnComplianceClient'
import RuComplianceClient from './ru/RuComplianceClient'

// ─── Types ──────────────────────────────────────────────────

type Region = 'kr' | 'cn' | 'ru'

interface Props {
  user: SessionUser
  defaultRegion?: string
}

// ─── Constants ──────────────────────────────────────────────

const VALID_REGIONS = new Set<Region>(['kr', 'cn', 'ru'])

// ─── Helpers ────────────────────────────────────────────────

function resolveRegion(
  searchParamRegion: string | null,
  defaultRegion?: string,
): Region {
  if (searchParamRegion && VALID_REGIONS.has(searchParamRegion as Region)) {
    return searchParamRegion as Region
  }
  if (defaultRegion && VALID_REGIONS.has(defaultRegion as Region)) {
    return defaultRegion as Region
  }
  return 'kr'
}

// ─── Component ──────────────────────────────────────────────

export default function CountryComplianceTab({ user, defaultRegion }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('compliance')

  // URL에서 매 렌더마다 region 유도 — back/forward/외부 URL 변경 반영
  const activeRegion = resolveRegion(searchParams.get('region'), defaultRegion)

  const handleRegionChange = useCallback(
    (value: string) => {
      const region = value as Region
      // URL에 region 파라미터 반영 — state는 URL이 SSOT
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', 'country')
      params.set('region', region)
      const query = params.toString()
      router.replace(`/compliance?${query}`, { scroll: false })
    },
    [router, searchParams],
  )

  return (
    <div className="space-y-4">
      {/* 국가 선택 — compact variant */}
      <Tabs value={activeRegion} onValueChange={handleRegionChange}>
        <TabsList variant="compact" aria-label="Country selection">
          <TabsTrigger variant="compact" value="kr">
            {t('hub.tabs.kr')}
          </TabsTrigger>
          <TabsTrigger variant="compact" value="cn">
            {t('hub.tabs.cn')}
          </TabsTrigger>
          <TabsTrigger variant="compact" value="ru">
            {t('hub.tabs.ru')}
          </TabsTrigger>
        </TabsList>

        {/* 선택된 국가만 렌더 — 각 Client가 자체 loading 처리 */}
        <TabsContent value="kr"><KrComplianceClient user={user} /></TabsContent>
        <TabsContent value="cn"><CnComplianceClient user={user} /></TabsContent>
        <TabsContent value="ru"><RuComplianceClient user={user} /></TabsContent>
      </Tabs>
    </div>
  )
}
