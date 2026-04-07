'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compliance Hub Client
// 컴플라이언스 7개 영역을 단일 탭 허브로 통합
// URL (?tab=) 동기화: /compliance?tab=gdpr → GDPR 탭 자동 활성화
// ═══════════════════════════════════════════════════════════

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { SessionUser } from '@/types'

// 하위 탭 컴포넌트 (각각 독립 페이지로도 존재, URL 유지)
import ComplianceClient from './ComplianceClient'
import GdprClient from './gdpr/GdprClient'
import DataRetentionClient from './data-retention/DataRetentionClient'
import PiiAuditClient from './pii-audit/PiiAuditClient'
import DpiaClient from './dpia/DpiaClient'
import KrComplianceClient from './kr/KrComplianceClient'
import CnComplianceClient from './cn/CnComplianceClient'
import RuComplianceClient from './ru/RuComplianceClient'

// ─── Types ──────────────────────────────────────────────────

type ComplianceTab =
  | 'overview'
  | 'gdpr'
  | 'data-retention'
  | 'pii-audit'
  | 'dpia'
  | 'kr'
  | 'cn'
  | 'ru'

// ─── Constants ──────────────────────────────────────────────

// 기존 개별 URL → 탭 키 매핑 (직접 접근 URL과 호환)
const PATH_TO_TAB: Record<string, ComplianceTab> = {
  '/compliance/gdpr':           'gdpr',
  '/compliance/data-retention': 'data-retention',
  '/compliance/pii-audit':      'pii-audit',
  '/compliance/dpia':           'dpia',
  '/compliance/kr':             'kr',
  '/compliance/cn':             'cn',
  '/compliance/ru':             'ru',
}

const VALID_TABS = new Set<ComplianceTab>([
  'overview', 'gdpr', 'data-retention', 'pii-audit', 'dpia', 'kr', 'cn', 'ru',
])

function resolveDefaultTab(searchParamTab: string | null): ComplianceTab {
  if (searchParamTab && VALID_TABS.has(searchParamTab as ComplianceTab)) {
    return searchParamTab as ComplianceTab
  }
  // 하위 경로에서 진입한 경우 처리 (pathname 기반 fallback은 상위에서 처리)
  return 'overview'
}

// ─── Component ──────────────────────────────────────────────

interface Props {
  user: SessionUser
  // 직접 접근한 하위 경로(예: /compliance/gdpr)의 탭 키 — page.tsx에서 전달
  defaultTab?: ComplianceTab
}

export function ComplianceHubClient({ user, defaultTab }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('compliance')

  // URL ?tab= 파라미터 우선, 없으면 defaultTab(경로 기반), 없으면 overview
  const activeTab: ComplianceTab =
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
      router.replace(`/compliance${query ? `?${query}` : ''}`, { scroll: false })
    },
    [router, searchParams],
  )

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="border-b border-border overflow-x-auto">
          <TabsList className="h-auto bg-transparent p-0 w-full justify-start gap-0 rounded-none">
            {[
              { value: 'overview',       labelKey: 'hub.tabs.overview' },
              { value: 'gdpr',           labelKey: 'hub.tabs.gdpr' },
              { value: 'data-retention', labelKey: 'hub.tabs.dataRetention' },
              { value: 'pii-audit',      labelKey: 'hub.tabs.piiAudit' },
              { value: 'dpia',           labelKey: 'hub.tabs.dpia' },
              { value: 'kr',             labelKey: 'hub.tabs.kr' },
              { value: 'cn',             labelKey: 'hub.tabs.cn' },
              { value: 'ru',             labelKey: 'hub.tabs.ru' },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent hover:text-foreground"
              >
                {t(tab.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Radix Tabs 기본 동작: 비활성 탭은 언마운트 → 활성 탭만 API 호출 */}
        <TabsContent value="overview"><ComplianceClient user={user} /></TabsContent>
        <TabsContent value="gdpr"><GdprClient user={user} /></TabsContent>
        <TabsContent value="data-retention"><DataRetentionClient user={user} /></TabsContent>
        <TabsContent value="pii-audit"><PiiAuditClient user={user} /></TabsContent>
        <TabsContent value="dpia"><DpiaClient user={user} /></TabsContent>
        <TabsContent value="kr"><KrComplianceClient user={user} /></TabsContent>
        <TabsContent value="cn"><CnComplianceClient user={user} /></TabsContent>
        <TabsContent value="ru"><RuComplianceClient user={user} /></TabsContent>
      </Tabs>
    </div>
  )
}

// PATH_TO_TAB은 /compliance 하위 경로 page.tsx에서 사용
export { PATH_TO_TAB }
export type { ComplianceTab }
