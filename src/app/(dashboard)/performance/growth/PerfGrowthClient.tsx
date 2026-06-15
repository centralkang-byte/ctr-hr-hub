'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 평가/성장 허브 Client
// 목표 + 분기 리뷰 + 자기평가 3탭 통합 (프로토 PerfGrowthWrapper).
// 자식이 헤더 1차 액션을 등록(callback-registration) → 허브가 활성 탭 액션 버튼 1개 렌더.
// 탭은 최초 방문 시 mount, 이후 keep-alive (자기평가 미저장 입력 보존).
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, type ComponentProps } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Target, ClipboardCheck, Sparkles, Plus, Loader2, type LucideIcon } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WdStatusChips } from '@/components/shared/WdStatusChips'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/types'
import type { HubTabKey, PrimaryActionState, GrowthHubKpi } from '@/lib/performance/growth-hub'
import { cycleHalfLabel } from '@/lib/performance/growth-kpi'
import type { SelfAssessmentProps } from '@/lib/skills/load-self-assessment-props'
import MyGoalsClient from '../my-goals/MyGoalsClient'
import MyQuarterlyReviewClient from '../my-quarterly-review/MyQuarterlyReviewClient'
import MySkillsClient from '../../my/skills/MySkillsClient'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  user: SessionUser
  skillsProps: SelfAssessmentProps
  kpi: GrowthHubKpi | null
}

type ChipItems = ComponentProps<typeof WdStatusChips>['items']

// ─── Constants ──────────────────────────────────────────────

const TAB_ORDER: HubTabKey[] = ['goals', 'quarterly', 'skills']
const TAB_ICON: Record<HubTabKey, LucideIcon> = {
  goals: Target,
  quarterly: ClipboardCheck,
  skills: Sparkles,
}

// ─── Helpers ────────────────────────────────────────────────

function isHubTab(v: string | null): v is HubTabKey {
  return v === 'goals' || v === 'quarterly' || v === 'skills'
}

// ─── Component ──────────────────────────────────────────────

export default function PerfGrowthClient({ user, skillsProps, kpi }: Props) {
  const t = useTranslations('performance.growth')
  const router = useRouter()
  const searchParams = useSearchParams()

  const urlTab = searchParams.get('tab')
  const active: HubTabKey = isHubTab(urlTab) ? urlTab : 'goals'

  // 최초 방문 시 mount, 이후 keep-alive
  const [visited, setVisited] = useState<Set<HubTabKey>>(() => new Set([active]))
  useEffect(() => {
    setVisited((prev) => (prev.has(active) ? prev : new Set(prev).add(active)))
  }, [active])

  // 자식이 등록한 탭별 1차 액션 디스크립터
  const [actions, setActions] = useState<Record<HubTabKey, PrimaryActionState | null>>({
    goals: null,
    quarterly: null,
    skills: null,
  })

  const setTab = useCallback(
    (next: string) => {
      if (!isHubTab(next)) return
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', next)
      // push: 탭 전환을 history 에 남겨 브라우저 뒤로가기 동작 보장 (scroll 유지)
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  // 탭별 안정적 등록 콜백 (cleanup-null 이 동일 탭 슬롯만 비우도록 키 고정)
  const makeHandler = useCallback(
    (tab: HubTabKey) => (s: PrimaryActionState | null) =>
      setActions((prev) => ({ ...prev, [tab]: s })),
    [],
  )
  const onGoals = useMemo(() => makeHandler('goals'), [makeHandler])
  const onQuarterly = useMemo(() => makeHandler('quarterly'), [makeHandler])
  const onSkills = useMemo(() => makeHandler('skills'), [makeHandler])

  const activeAction = actions[active]
  const ActionIcon: LucideIcon = activeAction?.pending ? Loader2 : activeAction?.icon ?? Plus

  // KPI 칩 (실데이터만 — 없는 칩은 생략)
  const chips = useMemo<ChipItems>(() => {
    if (!kpi) return []
    const items: ChipItems = [
      { label: t('kpi.cycle'), value: kpi.cycleName || cycleHalfLabel(kpi.cycleHalf), tone: 'accent' },
      { label: t('kpi.goalsInProgress'), value: kpi.approvedGoals, muted: kpi.approvedGoals === 0 },
    ]
    if (kpi.dday >= 0) {
      items.push({
        label: t('kpi.evalDeadline'),
        value: kpi.dday === 0 ? t('kpi.ddayToday') : `D-${kpi.dday}`,
        tone: 'warn',
      })
    }
    return items
  }, [kpi, t])

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
            {chips.length > 0 && (
              <WdStatusChips items={chips} aria-label={t('kpi.ariaLabel')} className="mt-3" />
            )}
          </div>
          {activeAction?.visible && (
            <button
              type="button"
              onClick={() => activeAction.run()}
              disabled={!activeAction.enabled || activeAction.pending}
              aria-busy={activeAction.pending}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-warm px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-95 disabled:opacity-40"
            >
              <ActionIcon className={cn('h-4 w-4', activeAction.pending && 'animate-spin')} aria-hidden="true" />
              {t(activeAction.labelKey as Parameters<typeof t>[0])}
            </button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={active} onValueChange={setTab}>
          <TabsList aria-label={t('tabsAriaLabel')}>
            {TAB_ORDER.map((k) => {
              const Icon = TAB_ICON[k]
              return (
                <TabsTrigger key={k} value={k}>
                  <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t(`tab.${k}` as Parameters<typeof t>[0])}
                </TabsTrigger>
              )
            })}
          </TabsList>

          <TabsContent value="goals" forceMount className={cn('mt-4', active !== 'goals' && 'hidden')}>
            {visited.has('goals') && (
              <MyGoalsClient user={user} embedded onPrimaryActionChange={onGoals} />
            )}
          </TabsContent>
          <TabsContent value="quarterly" forceMount className={cn('mt-4', active !== 'quarterly' && 'hidden')}>
            {visited.has('quarterly') && (
              <MyQuarterlyReviewClient user={user} embedded onPrimaryActionChange={onQuarterly} />
            )}
          </TabsContent>
          <TabsContent value="skills" forceMount className={cn('mt-4', active !== 'skills' && 'hidden')}>
            {visited.has('skills') && (
              <MySkillsClient
                user={user}
                embedded
                onPrimaryActionChange={onSkills}
                competencies={skillsProps.competencies}
                requirementMap={skillsProps.requirementMap}
                grade={skillsProps.grade}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
