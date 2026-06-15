// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 평가/성장 허브 KPI 순수 헬퍼
// 현재 사이클 선택 규칙 + 평가마감 D-day 계산 (회사 timezone).
// 서버에서 unmasked PerformanceCycle 로 호출 (EMPLOYEE /cycles 마스킹 우회).
// ═══════════════════════════════════════════════════════════

import { getStartOfDayTz } from '@/lib/timezone'

// ─── Types ──────────────────────────────────────────────────

export interface CycleLike {
  id: string
  name: string
  year: number
  half: string
  status: string
  goalStart: Date | string
  goalEnd: Date | string
  evalStart: Date | string
  evalEnd: Date | string
}

// ─── 현재 사이클 선택 (Codex G1 R2 P1-5) ─────────────────────
// 1) now 가 [goalStart, evalEnd] 윈도우 안인 사이클 우선 → 상태 우선순위 + 최신
// 2) 없으면 비종료(non-terminal) 사이클 중 최신
// 3) 없으면 전체 최신
// "오래된 EVAL_OPEN 이 최신 ACTIVE 를 이기는" 함정 차단 — 날짜범위가 1차 기준.

const STATUS_PRIORITY: Record<string, number> = {
  EVAL_OPEN: 0,
  CHECK_IN: 1,
  ACTIVE: 2,
  CALIBRATION: 3,
  FINALIZED: 4,
  COMP_REVIEW: 5,
  DRAFT: 6,
  COMP_COMPLETED: 7,
  CLOSED: 8,
}

const TERMINAL_STATUSES = new Set(['CLOSED', 'COMP_COMPLETED'])

function statusRank(status: string): number {
  return STATUS_PRIORITY[status] ?? 99
}

/** year desc → goalStart desc (최신 우선) */
function byRecency(a: CycleLike, b: CycleLike): number {
  if (b.year !== a.year) return b.year - a.year
  return new Date(b.goalStart).getTime() - new Date(a.goalStart).getTime()
}

export function pickCurrentCycle<T extends CycleLike>(cycles: T[], now: Date): T | null {
  if (!cycles || cycles.length === 0) return null
  const nowMs = now.getTime()

  // 1) 활동 윈도우 안 (목표 시작 ~ 평가 종료)
  const inWindow = cycles.filter((c) => {
    const start = new Date(c.goalStart).getTime()
    const end = new Date(c.evalEnd).getTime()
    return nowMs >= start && nowMs <= end
  })
  if (inWindow.length > 0) {
    return [...inWindow].sort((a, b) => {
      const r = statusRank(a.status) - statusRank(b.status)
      return r !== 0 ? r : byRecency(a, b)
    })[0]
  }

  // 2) 비종료 사이클 중 최신
  const nonTerminal = cycles.filter((c) => !TERMINAL_STATUSES.has(c.status))
  if (nonTerminal.length > 0) {
    return [...nonTerminal].sort(byRecency)[0]
  }

  // 3) 전체 최신
  return [...cycles].sort(byRecency)[0]
}

// ─── 평가 마감 D-day (회사 timezone 기준) ────────────────────
// 브라우저 로컬 아님 — 미국 법인 사용자가 어디서 접속하든 동일 업무일 (Codex G1 R2 P1-7).
// 반환: target(평가종료일) - today, 회사 tz 자정 기준 정수 일수. 음수 = 마감 경과.

export function computeCycleDday(evalEnd: Date | string, now: Date, tz: string): number {
  const todayStart = getStartOfDayTz(now, tz).getTime()
  const targetStart = getStartOfDayTz(evalEnd, tz).getTime()
  // DST 로 하루가 23/25h 일 수 있어 반올림으로 일 단위 보정
  return Math.round((targetStart - todayStart) / 86_400_000)
}

// ─── 사이클 표시 라벨 (Q 표기 금지 — half 만 존재) ───────────
// PerformanceCycle 은 quarter 컬럼이 없음 → "상반기/하반기/연간". cycle.name 우선.

export function cycleHalfLabel(half: string): string {
  if (half === 'H1') return '상반기'
  if (half === 'H2') return '하반기'
  return '연간'
}
