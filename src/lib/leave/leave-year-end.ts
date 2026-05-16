// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 연차 사용기간 종료일 파생 (근로기준법 §61 사용촉진)
//
// accrualBasis(LeaveAccrualRule)에 따라 "현재 시점에서 다음으로
// 도래하는 연차 사용기간 종료일"을 계산하는 순수 함수.
//   - calendar_year         → 해당 사용기간의 12/31
//   - hire_date_anniversary → 입사 월/일 기준 다음 도래 기념일
// §61 통보 시점(종료 6개월 전 1차 / 2개월 전 2차)의 anchor.
// ═══════════════════════════════════════════════════════════

// accrualEngine.ts 와 동일 enum 문자열 (SSOT: src/lib/leave/accrualEngine.ts)
export type AccrualBasis = 'calendar_year' | 'hire_date_anniversary'

/**
 * 윤년이 아닌 해의 2/29 입사자는 2/28로 클램프.
 * (Date.UTC 는 2/29→3/1 로 롤오버하므로 명시적 처리)
 */
function makeUtcDate(year: number, month0: number, day: number): Date {
  if (month0 === 1 && day === 29) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    if (!isLeap) return new Date(Date.UTC(year, 1, 28))
  }
  return new Date(Date.UTC(year, month0, day))
}

/**
 * 현재 시점(`now`)에서 다음으로 도래하는 연차 사용기간 종료일을 반환한다.
 * 반환값은 UTC 자정 기준 달력일(시각 무의미). 과거 종료일은 anchor 하지 않는다.
 *
 * @param accrualBasis 연차 LeaveAccrualRule.accrualBasis
 * @param hireDate     입사일 (달력일)
 * @param now          기준 시점 (KST 오늘의 달력일을 UTC 자정으로 전달 권장)
 */
export function resolveLeaveYearEnd(
  accrualBasis: string,
  hireDate: Date,
  now: Date,
): Date {
  const nowY = now.getUTCFullYear()
  const nowM = now.getUTCMonth()
  const nowD = now.getUTCDate()
  // 시각 성분 제거한 비교용 기준일
  const today = Date.UTC(nowY, nowM, nowD)

  if (accrualBasis === 'hire_date_anniversary') {
    const hm = hireDate.getUTCMonth()
    const hd = hireDate.getUTCDate()
    let candidate = makeUtcDate(nowY, hm, hd)
    if (candidate.getTime() < today) {
      candidate = makeUtcDate(nowY + 1, hm, hd)
    }
    return candidate
  }

  // calendar_year (및 정의되지 않은 basis의 보수적 fallback): 해당 사용기간 12/31.
  // now 가 연중 어디든 같은 해 12/31 은 항상 today 이상.
  return new Date(Date.UTC(nowY, 11, 31))
}

/**
 * LeavePromotionLog.year 에 기록할 값 = 사용기간 종료 연도.
 * (통보 발송 시점의 달력연도가 아님 — 입사기념일 코호트 idempotency 고정)
 */
export function leaveYearEndYear(periodEnd: Date): number {
  return periodEnd.getUTCFullYear()
}

/**
 * UTC 기준 달력월 차감 (date-fns subMonths 는 런타임 로컬 TZ 의존 → 결정성 위해 직접 구현).
 * 말일 보정: 차감 결과 월의 일수보다 큰 day 는 해당 월 말일로 클램프
 * (예: 8/31 −6개월 → 2/28(또는 2/29)).
 */
export function subMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  const d = date.getUTCDate()
  const targetMonthIndex = m - months
  const targetY = y + Math.floor(targetMonthIndex / 12)
  const targetM = ((targetMonthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetY, targetM, Math.min(d, lastDay)))
}
