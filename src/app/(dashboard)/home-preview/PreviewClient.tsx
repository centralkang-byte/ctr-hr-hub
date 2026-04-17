'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  FileText,
  Pencil,
  UserPlus,
  CalendarDays,
  Coffee,
  Moon,
  Sun,
  Monitor,
  Smartphone,
  Tablet,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import type { SessionUser } from '@/types'
import { cn } from '@/lib/utils'
import { DashboardHomeShell, HomeGrid, HomeSection } from '@/components/home/shell/DashboardHomeShell'
import { StatCard } from '@/components/home/primitives/StatCard'
import { ListCard } from '@/components/home/primitives/ListCard'
import { HeroCard } from '@/components/home/primitives/HeroCard'
import { InsightStrip } from '@/components/home/primitives/InsightStrip'
import { EmptyState } from '@/components/home/primitives/EmptyState'

// ─── Types ──────────────────────────────────────────────────

type Viewport = 'mobile' | 'tablet' | 'desktop' | 'full'

interface Props {
  user: SessionUser
}

interface OnboardingItem {
  id: string
  name: string
  dept: string
  progress: number
  daysLeft: number
}

// ─── Mock data ──────────────────────────────────────────────

const MOCK_ONBOARDING: OnboardingItem[] = [
  { id: '1', name: '김지훈', dept: '개발팀', progress: 85, daysLeft: 3 },
  { id: '2', name: '이소연', dept: '인사팀', progress: 42, daysLeft: 12 },
  { id: '3', name: 'Jake Miller', dept: 'Sales', progress: 60, daysLeft: 7 },
  { id: '4', name: '박민재', dept: '재무팀', progress: 20, daysLeft: 28 },
]

const SPARK_UP = [4, 5, 6, 5, 7, 8, 9, 11, 10, 12]
const SPARK_DOWN = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]
const SPARK_FLAT = [6, 7, 6, 7, 6, 7, 6, 7, 6, 7]

const VIEWPORT_WIDTH: Record<Viewport, string> = {
  mobile: 'max-w-[375px]',
  tablet: 'max-w-[768px]',
  desktop: 'max-w-[1280px]',
  full: 'max-w-[1440px]',
}

const VIEWPORT_ICON = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  full: Monitor,
} as const

// ─── Component ──────────────────────────────────────────────

export function PreviewClient({ user }: Props) {
  const [viewport, setViewport] = useState<Viewport>('full')
  const { setTheme, resolvedTheme } = useTheme()
  const t = useTranslations('home.preview')

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Preview toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-card px-4 py-3">
        <div className="flex flex-col gap-0.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t('title')}</span>
            <span className="text-xs text-muted-foreground">
              {user.email} — {t('envBadge')}
            </span>
          </div>
          {/*
            Codex Gate 2 P2 note — max-width 기반 preview는 Tailwind breakpoint를 트리거하지 않음.
            실제 모바일/태블릿 레이아웃은 브라우저 DevTools의 Device Emulation을 사용.
          */}
          <p className="text-[11px] leading-[1.4] text-muted-foreground">
            {t('breakpointHint')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['mobile', 'tablet', 'desktop', 'full'] as Viewport[]).map((vp) => {
            const Icon = VIEWPORT_ICON[vp]
            const isActive = viewport === vp
            const vpLabel = t(`viewport.${vp}` as 'viewport.mobile')
            return (
              <button
                key={vp}
                type="button"
                onClick={() => setViewport(vp)}
                aria-label={t('viewport.switchTo', { viewport: vpLabel })}
                aria-pressed={isActive}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-muted/70',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{vpLabel}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-lg bg-muted px-3 text-xs font-medium hover:bg-muted/70',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {resolvedTheme === 'dark' ? t('theme.light') : t('theme.dark')}
          </button>
        </div>
      </div>

      {/* Viewport-constrained content */}
      <div
        className={cn(
          'mx-auto w-full transition-[max-width] duration-300',
          VIEWPORT_WIDTH[viewport],
        )}
      >
        <DashboardHomeShell>
          {/* === HeroCard showcase === */}
          <HomeSection title={t('section.hero')} srOnly>
            <HeroCard
              greeting={`좋은 아침입니다, ${user.name ?? '홍길동'}님`}
              focus={{
                title: '오늘 4건의 결재가 대기 중입니다',
                description: '가장 오래된 요청이 2일 경과했습니다. 빠르게 처리하여 팀의 흐름을 지켜주세요.',
                cta: { label: '결재함 열기', href: '/approvals' },
              }}
              secondary={[
                { label: '일정 보기', href: '/calendar', icon: CalendarDays },
                { label: '휴식 제안', href: '#', icon: Coffee },
              ]}
              illustration="sunrise"
            />
          </HomeSection>

          {/* === StatCard showcase === */}
          <HomeSection title={t('section.stat')}>
            <HomeGrid cols={4}>
              <StatCard
                label="총 인원"
                value="625"
                trend={{ direction: 'up', delta: '+12', sr: '지난 달 대비 12명 증가' }}
                sparkline={SPARK_UP}
                action={{ label: '조직도', href: '/org' }}
                tone="info"
              />
              <StatCard
                label="승인 대기"
                value="4"
                trend={{ direction: 'down', delta: '-2', sr: '어제 대비 2건 감소' }}
                sparkline={SPARK_DOWN}
                action={{ label: '열기', href: '/approvals' }}
                tone="warning"
              />
              <StatCard
                label="온보딩 진행"
                value="8"
                trend={{ direction: 'flat', delta: '±0', sr: '변동 없음' }}
                sparkline={SPARK_FLAT}
                action={{ label: '보기', href: '/onboarding' }}
              />
              <StatCard label="로딩 중" value="—" loading />
            </HomeGrid>
          </HomeSection>

          {/* === ListCard showcase === */}
          <HomeSection title={t('section.list')}>
            <HomeGrid cols={2}>
              <ListCard
                title="진행 중 온보딩"
                items={MOCK_ONBOARDING}
                maxRows={3}
                viewAllHref="/onboarding"
                renderItem={(item) => ({
                  id: item.id,
                  primary: `${item.name} — ${item.dept}`,
                  secondary: `진행률 ${item.progress}% · D-${item.daysLeft}`,
                  statusDot: item.progress >= 70 ? 'success' : item.progress >= 40 ? 'warning' : 'error',
                  statusLabel: item.progress >= 70 ? '양호' : item.progress >= 40 ? '주의' : '지연',
                  href: `/onboarding/${item.id}`,
                })}
                actions={() => [
                  { icon: Pencil, label: '편집', onClick: () => undefined },
                  { icon: FileText, label: '문서 열기', onClick: () => undefined },
                ]}
              />
              <ListCard
                title="결재 대기 — 빈 상태"
                items={[] as OnboardingItem[]}
                renderItem={(item) => ({
                  id: item.id,
                  primary: item.name,
                })}
                emptyState={
                  <EmptyState
                    icon={CheckCircle2}
                    title="오늘 할 일을 모두 끝냈어요"
                    description="신규 요청이 들어오면 여기에 표시됩니다."
                    tone="success"
                  />
                }
              />
            </HomeGrid>
          </HomeSection>

          {/* === InsightStrip showcase === */}
          <HomeSection title={t('section.insight')}>
            <InsightStrip
              kind="ai-suggestion"
              message="이번 주 3건의 휴가 승인이 지연되고 있어요. 일괄 승인을 검토해보세요."
              action={{ label: '검토하기', href: '/leave/pending' }}
            />
            <InsightStrip
              kind="announcement"
              message="2026-04-22(월) 14:00-14:30 시스템 점검 예정입니다."
            />
            <InsightStrip
              kind="system"
              icon={Clock}
              message="이번 달 52시간 초과 위험 직원 2명을 확인해주세요."
              action={{ label: '대시보드', href: '/attendance/52h' }}
            />
          </HomeSection>

          {/* === EmptyState showcase === */}
          <HomeSection title={t('section.empty')}>
            <HomeGrid cols={2}>
              <EmptyState
                icon={UserPlus}
                title="신규 입사자가 없습니다"
                description="신규 채용이 결정되면 온보딩 카드가 여기에 표시됩니다."
                action={{ label: '채용 현황 보기', href: '/recruitment', variant: 'ghost' }}
              />
              <EmptyState
                icon={CheckCircle2}
                title="모든 작업 완료"
                description="오늘 처리할 항목이 없습니다. 수고하셨습니다."
                tone="success"
              />
            </HomeGrid>
          </HomeSection>

          {/* === 12-col Grid demo === */}
          <HomeSection title={t('section.grid')}>
            <HomeGrid cols={12}>
              <div className="col-span-12 rounded-2xl bg-primary/5 p-6 text-center text-xs text-muted-foreground">
                col-span-12 (Hero 자리)
              </div>
              <div className="col-span-12 rounded-2xl bg-accent/5 p-4 text-center text-xs text-muted-foreground lg:col-span-3">
                col-span-3
              </div>
              <div className="col-span-12 rounded-2xl bg-accent/5 p-4 text-center text-xs text-muted-foreground lg:col-span-3">
                col-span-3
              </div>
              <div className="col-span-12 rounded-2xl bg-accent/5 p-4 text-center text-xs text-muted-foreground lg:col-span-3">
                col-span-3
              </div>
              <div className="col-span-12 rounded-2xl bg-accent/5 p-4 text-center text-xs text-muted-foreground lg:col-span-3">
                col-span-3
              </div>
              <div className="col-span-12 rounded-2xl bg-muted/40 p-6 text-center text-xs text-muted-foreground lg:col-span-6">
                col-span-6 (ListCard 자리)
              </div>
              <div className="col-span-12 rounded-2xl bg-muted/40 p-6 text-center text-xs text-muted-foreground lg:col-span-6">
                col-span-6 (ListCard 자리)
              </div>
            </HomeGrid>
          </HomeSection>
        </DashboardHomeShell>
      </div>
    </div>
  )
}
