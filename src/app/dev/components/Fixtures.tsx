'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DEV 컴포넌트 픽스처 (PR-1 컴포넌트 N2 하네스)
// 결정적 데이터. fetch 없음. e2e = data-testid 로 단언.
// ═══════════════════════════════════════════════════════════

import {
  WdGroupedStatCard,
  type WdGroupedStatGroup,
} from '@/components/shared/WdGroupedStatCard'
import {
  WdLeaveBalanceCard,
  type WdLeaveBalanceInput,
} from '@/components/shared/WdLeaveBalanceCard'

// ─── Constants (결정적 픽스처) ──────────────────────────────

function bal(
  id: string,
  name: string,
  code: string | null,
  entitled: number,
  used: number,
): WdLeaveBalanceInput {
  return { id, entitled, used, pending: 0, carriedOver: 0, adjusted: 0, leaveTypeDef: { name, code } }
}

// Q7 임계: remaining/total → ≥30 success / 10–30 accent / <10 warning / total0 neutral
const Q7_BALANCES: WdLeaveBalanceInput[] = [
  bal('q30', '연차 30%', 'annual', 100, 70), // remaining 30 → 0.30 success
  bal('q29', '연차 29%', 'annual', 100, 71), // remaining 29 → 0.29 accent
  bal('q09', '병가 9%', 'sick', 100, 91),    // remaining 9  → 0.09 warning
  bal('q00', '특수 0',  null, 0, 0),         // total 0      → neutral
]

const MULTICAT_BALANCES: WdLeaveBalanceInput[] = [
  bal('m1', '연차유급휴가', 'annual', 15, 3),
  bal('m2', '병가', 'sick', 10, 2),
  bal('m3', '경조사', 'bereavement', 5, 0),
  bal('m4', '기타', null, 3, 1),
]

const ATTENDANCE_ROWS: WdGroupedStatGroup[] = [
  {
    items: [
      { id: 'wd', label: '근무일', value: 21, unit: '일' },
      { id: 'ci', label: '출근 평균', value: '08:52' },
      { id: 'co', label: '퇴근 평균', value: '18:48' },
      { id: 'ot', label: '초과근무 누계', value: 4.2, unit: 'h', valueTone: 'warning' },
      { id: 'late', label: '지각', value: 1, unit: '회', valueTone: 'warning' },
    ],
  },
]

// ─── Component ──────────────────────────────────────────────

export function DevComponentFixtures() {
  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      <h1 className="text-xl font-bold">DEV — WdGroupedStatCard 픽스처</h1>

      <section data-testid="fx-q7">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Q7 임계 매핑 (30/29/9/0)</h2>
        <WdLeaveBalanceCard balances={Q7_BALANCES} />
      </section>

      <section data-testid="fx-leave-multicat">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">휴가 멀티카테고리</h2>
        <WdLeaveBalanceCard balances={MULTICAT_BALANCES} />
      </section>

      <section data-testid="fx-rows">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">근태 5지표 (rows, progress無)</h2>
        <WdGroupedStatCard title="월간 통계" subtitle="5월" layout="rows" groups={ATTENDANCE_ROWS} />
      </section>

      <section data-testid="fx-empty">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">빈 groups → EmptyState</h2>
        <WdLeaveBalanceCard balances={[]} />
      </section>

      <section data-testid="fx-loading">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">loading → null</h2>
        <WdLeaveBalanceCard balances={MULTICAT_BALANCES} loading />
      </section>
    </main>
  )
}
