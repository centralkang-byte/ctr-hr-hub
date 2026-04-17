import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface BaseProps {
  className?: string
  children: React.ReactNode
}

interface HomeSectionProps extends BaseProps {
  /** <h2> id — aria-labelledby 대상 */
  titleId?: string
  /** 섹션 제목 — 렌더링하지 않고 sr-only로만 원한다면 srOnly */
  title?: string
  srOnly?: boolean
}

type GridCols = 1 | 2 | 3 | 4 | 12

interface HomeGridProps extends BaseProps {
  /** 데스크톱(`lg`) 이상에서 12-col 그리드 내 cols 결정 */
  cols?: GridCols
  /** 추가 gap (기본: shell wrapper에서 상속) */
  gap?: 'sm' | 'md' | 'lg'
}

interface HomeStackProps extends BaseProps {
  gap?: 'sm' | 'md' | 'lg'
}

// ─── Wrapper ────────────────────────────────────────────────

/**
 * 홈 대시보드의 최상위 wrapper.
 * **중요**: 실제 scroll container는 `src/app/(dashboard)/DashboardShell.tsx`의
 * `<main className="flex-1 overflow-auto ...">`. 이 Shell은 내부 콘텐츠 정렬만 담당.
 * - Mobile: single column
 * - sm(≥640): 2-col friendly
 * - lg(≥1024): 12-col CSS Grid 활용 (HomeGrid로 표현)
 * - xl(≥1280): `max-w-[1440px]` 중앙 정렬
 *
 * Codex Gate 1 Fix #2: scroll-snap 제거 — 외부 main이 실 스크롤포트.
 * Padding은 parent main(`p-4 md:p-6`)에 의해 이미 적용됨. 중복 방지.
 */
export function DashboardHomeShell({ className, children }: BaseProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-[1440px] flex-col gap-4 md:gap-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ─── HomeSection ────────────────────────────────────────────

/**
 * 홈 내부 하나의 논리 섹션. 제목 + 컨텐츠.
 * aria-labelledby 패턴 또는 aria-label.
 */
export function HomeSection({
  className,
  children,
  title,
  titleId,
  srOnly,
}: HomeSectionProps) {
  const resolvedId = titleId ?? (title ? `homesection-${title.replace(/\s+/g, '-')}` : undefined)

  return (
    <section
      aria-labelledby={resolvedId}
      className={cn('flex flex-col gap-3', className)}
    >
      {title ? (
        <h2
          id={resolvedId}
          className={cn('text-sm font-semibold text-foreground', srOnly && 'sr-only')}
        >
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  )
}

// ─── HomeGrid ───────────────────────────────────────────────

const GAP_CLASS: Record<NonNullable<HomeGridProps['gap']>, string> = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
}

const COLS_CLASS: Record<GridCols, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  // Codex Gate 2 P2 fix — 12-col은 모든 breakpoint에서 12 columns.
  // 자식은 `col-span-12 lg:col-span-N` 으로 모바일 stacking 표현.
  12: 'grid-cols-12',
}

/**
 * 반응형 그리드. cols=12는 12-col CSS Grid를 활성화 — 자식은 `col-span-*` 직접 사용.
 */
export function HomeGrid({
  className,
  children,
  cols = 4,
  gap = 'md',
}: HomeGridProps) {
  return (
    <div className={cn('grid', COLS_CLASS[cols], GAP_CLASS[gap], className)}>
      {children}
    </div>
  )
}

// ─── HomeStack ──────────────────────────────────────────────

/**
 * 세로 스택. HomeSection 내부에서 세부 컨텐츠 정렬용.
 */
export function HomeStack({
  className,
  children,
  gap = 'md',
}: HomeStackProps) {
  return (
    <div className={cn('flex flex-col', GAP_CLASS[gap], className)}>
      {children}
    </div>
  )
}
