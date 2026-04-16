'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compliance Hub Client
// 4개 그룹 탭으로 재구성: Overview / Data Protection / PII Audit / Country
// URL (?tab=, ?section=, ?region=) 동기화 + 레거시 리다이렉트
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { SessionUser } from '@/types'

// 하위 탭 컴포넌트
import ComplianceClient from './ComplianceClient'
import PiiAuditClient from './pii-audit/PiiAuditClient'
import DataProtectionTab from './DataProtectionTab'
import CountryComplianceTab from './CountryComplianceTab'

// ─── Types ──────────────────────────────────────────────────

type ComplianceTab = 'overview' | 'data-protection' | 'pii-audit' | 'country'

// ─── Constants ──────────────────────────────────────────────

// 레거시 tab 값 → 새 tab + section/region 매핑
const LEGACY_TAB_MAP: Record<string, { tab: ComplianceTab; section?: string; region?: string }> = {
  // Data Protection 그룹
  'gdpr':           { tab: 'data-protection', section: 'gdpr' },
  'dpia':           { tab: 'data-protection', section: 'dpia' },
  'data-retention': { tab: 'data-protection', section: 'data-retention' },
  // Country 그룹
  'kr':             { tab: 'country', region: 'kr' },
  'cn':             { tab: 'country', region: 'cn' },
  'ru':             { tab: 'country', region: 'ru' },
}

// 경로 기반 딥링크 매핑 — page.tsx에서 사용
const PATH_TO_TAB: Record<string, { tab: ComplianceTab; section?: string; region?: string }> = {
  '/compliance/gdpr':           { tab: 'data-protection', section: 'gdpr' },
  '/compliance/dpia':           { tab: 'data-protection', section: 'dpia' },
  '/compliance/data-retention': { tab: 'data-protection', section: 'data-retention' },
  '/compliance/pii-audit':      { tab: 'pii-audit' },
  '/compliance/kr':             { tab: 'country', region: 'kr' },
  '/compliance/cn':             { tab: 'country', region: 'cn' },
  '/compliance/ru':             { tab: 'country', region: 'ru' },
}

const VALID_TABS = new Set<ComplianceTab>(['overview', 'data-protection', 'pii-audit', 'country'])

// ─── Helpers ────────────────────────────────────────────────

function resolveTab(searchParamTab: string | null, defaultTab?: ComplianceTab): ComplianceTab {
  if (searchParamTab && VALID_TABS.has(searchParamTab as ComplianceTab)) {
    return searchParamTab as ComplianceTab
  }
  if (defaultTab && VALID_TABS.has(defaultTab)) {
    return defaultTab
  }
  return 'overview'
}

// ─── Component ──────────────────────────────────────────────

interface Props {
  user: SessionUser
  defaultTab?: ComplianceTab
  defaultSection?: string
  defaultRegion?: string
}

export function ComplianceHubClient({
  user,
  defaultTab,
  defaultSection,
  defaultRegion,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('compliance')

  const rawTab = searchParams.get('tab')
  const rawSection = searchParams.get('section')
  const rawRegion = searchParams.get('region')

  // 레거시 tab 값 resolve — 첫 렌더부터 올바른 탭을 표시 (flash 방지)
  const legacyMapped = rawTab && LEGACY_TAB_MAP[rawTab] ? LEGACY_TAB_MAP[rawTab] : null

  const activeTab: ComplianceTab = legacyMapped
    ? legacyMapped.tab
    : resolveTab(rawTab, defaultTab)
  const activeSection = legacyMapped?.section ?? rawSection ?? defaultSection
  const activeRegion = legacyMapped?.region ?? rawRegion ?? defaultRegion

  // 레거시 URL은 post-render로 정상 URL로 교체 (북마크/공유 링크 영구화)
  useEffect(() => {
    if (legacyMapped) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', legacyMapped.tab)
      if (legacyMapped.section) params.set('section', legacyMapped.section)
      if (legacyMapped.region) params.set('region', legacyMapped.region)
      router.replace(`/compliance?${params.toString()}`, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacyMapped?.tab, legacyMapped?.section, legacyMapped?.region])

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === 'overview') {
        params.delete('tab')
      } else {
        params.set('tab', value)
      }
      // 탭 변경 시 section/region 파라미터 초기화 (다른 탭의 state)
      if (value !== 'data-protection') params.delete('section')
      if (value !== 'country') params.delete('region')
      const query = params.toString()
      router.replace(`/compliance${query ? `?${query}` : ''}`, { scroll: false })
    },
    [router, searchParams],
  )

  // Data Protection 서브 섹션 변경 — GdprClient의 tab click을 URL에 반영
  const handleSectionChange = useCallback(
    (section: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', 'data-protection')
      params.set('section', section)
      router.replace(`/compliance?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList aria-label="Compliance navigation">
          <TabsTrigger value="overview">{t('hub.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="data-protection">{t('hub.tabs.dataProtection')}</TabsTrigger>
          <TabsTrigger value="pii-audit">{t('hub.tabs.piiAudit')}</TabsTrigger>
          <TabsTrigger value="country">{t('hub.tabs.country')}</TabsTrigger>
        </TabsList>

        {/* Radix Tabs 기본 동작: 비활성 탭은 언마운트 → 활성 탭만 API 호출 */}
        <TabsContent value="overview">
          <ComplianceClient user={user} />
        </TabsContent>
        <TabsContent value="data-protection">
          <DataProtectionTab
            user={user}
            activeSection={activeSection ?? undefined}
            onSectionChange={handleSectionChange}
          />
        </TabsContent>
        <TabsContent value="pii-audit">
          <PiiAuditClient user={user} />
        </TabsContent>
        <TabsContent value="country">
          <CountryComplianceTab user={user} defaultRegion={activeRegion ?? undefined} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// PATH_TO_TAB은 /compliance 하위 경로 page.tsx에서 사용
export { PATH_TO_TAB }
export type { ComplianceTab }
