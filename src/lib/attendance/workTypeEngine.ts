// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Work Type Engine (B6-1)
// 근무유형별 근태 처리: 고정/유연/교대/재택
// ═══════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────

export type WorkType = 'FIXED' | 'FLEXIBLE' | 'SHIFT' | 'REMOTE'

export interface FlexWorkConfig {
  flexEnabled: boolean
  coreTimeStart?: string  // 'HH:MM'
  coreTimeEnd?: string    // 'HH:MM'
  minDailyHours?: number  // hours
}

export interface AttendanceInput {
  clockIn: Date
  clockOut: Date
  workType: WorkType
  flexWork?: FlexWorkConfig
  /** 교대근무 슬롯에서 가져온 예정 근무 시작/종료 (분) */
  shiftStartMinutes?: number
  shiftEndMinutes?: number
  /** 표준 근무시간 (분), 기본 480 */
  standardMinutes?: number
  /** 휴식시간 (분), 기본 60 */
  breakMinutes?: number
  // FIX: Issue #7 — Add workDate for calendar-based weekend/holiday classification.
  //   Without this, SHIFT workers' weekend duty was treated as regular weekday.
  /** 근무 날짜 (KST 날짜 기준) — 주말/공휴일 여부 판단에 사용 */
  workDate?: Date
  /** 공휴일 여부 (날짜 조회 후 caller가 직접 제공) */
  isHoliday?: boolean
}

export interface AttendanceResult {
  totalMinutes: number
  overtimeMinutes: number
  nightMinutes: number      // 22:00~06:00 야간 근무 분
  isLate: boolean           // 지각 여부
  isEarlyLeave: boolean     // 조기 퇴근 여부
  isAbsent: boolean         // 결근 여부
  workType: WorkType
  /** 유연근무 코어타임 내 근무 여부 */
  coreTimeCompliant?: boolean
  // FIX: Issue #7 — Expose weekend/holiday classification for overtime premium calculation.
  /** 주말 근무 여부 (교대근무자의 주말 교대 포함) */
  isWeekend?: boolean
  /** 공휴일 근무 여부 */
  isHoliday?: boolean
}

// ─── 유틸 ─────────────────────────────────────────────────

/** Date → 자정 기준 분 환산 (KST offset 적용 전 UTC 기준) */
function toMinutesOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

/** HH:MM → 분 */
function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * 22:00~06:00 야간 구간에 해당하는 근무 분 계산
 * crossDay 대응: clockOut이 다음 날일 수 있음
 */
function calcNightMinutes(clockIn: Date, clockOut: Date): number {
  const NIGHT_START = 22 * 60  // 22:00
//   const NIGHT_END_NEXT = 30 * 60  // 다음날 06:00 = 30 * 60

  const totalMs = clockOut.getTime() - clockIn.getTime()
  if (totalMs <= 0) return 0

  const inMin = toMinutesOfDay(clockIn)
  const outMin = toMinutesOfDay(clockOut)
  // 총 경과 분
  const durationMin = Math.round(totalMs / 60000)

  let nightMin = 0
  // 24시간 슬라이딩 윈도우 — 단순 근사 계산
  // 22:00-24:00 구간
  if (inMin < 24 * 60 && outMin > NIGHT_START) {
    const overlapStart = Math.max(inMin, NIGHT_START)
    const overlapEnd = Math.min(outMin > inMin ? outMin : 24 * 60, 24 * 60)
    nightMin += Math.max(0, overlapEnd - overlapStart)
  }
  // 00:00-06:00 구간
  if (inMin < 6 * 60 || outMin < 6 * 60 || durationMin > 12 * 60) {
    const morningStart = 0
    const morningEnd = 6 * 60
    const effectiveOut = outMin < inMin ? outMin : (durationMin > 12 * 60 ? morningEnd : 0)
    if (effectiveOut > 0) {
      nightMin += Math.max(0, Math.min(effectiveOut, morningEnd) - morningStart)
    }
  }

  return Math.min(nightMin, durationMin)
}

// ─── 고정 근무 처리 ────────────────────────────────────────

/**
 * FIXED: 표준 출퇴근 (9:00~18:00)
 * - 지각: clockIn > standardStart (09:00 = 540)
 * - 조기퇴근: clockOut < standardEnd (18:00 = 1080)
 * - 초과근무: totalMinutes > standardMinutes + breakMinutes
 */
function processFixed(input: AttendanceInput): AttendanceResult {
  const { clockIn, clockOut } = input
  const standardMinutes = input.standardMinutes ?? 480
  const breakMinutes = input.breakMinutes ?? 60

  const STANDARD_START = 9 * 60   // 09:00
  const STANDARD_END = 18 * 60    // 18:00

  const inMin = toMinutesOfDay(clockIn)
  const outMin = toMinutesOfDay(clockOut)

  const totalMs = clockOut.getTime() - clockIn.getTime()
  const totalMinutes = Math.max(0, Math.round(totalMs / 60000) - breakMinutes)
  const overtimeMinutes = Math.max(0, totalMinutes - standardMinutes)
  const nightMinutes = calcNightMinutes(clockIn, clockOut)

  return {
    totalMinutes,
    overtimeMinutes,
    nightMinutes,
    isLate: inMin > STANDARD_START,
    isEarlyLeave: outMin < STANDARD_END,
    isAbsent: false,
    workType: 'FIXED',
  }
}

// ─── 유연 근무 처리 ────────────────────────────────────────

/**
 * FLEXIBLE: 유연근무제
 * - 코어타임 내 근무 여부 확인
 * - 일 최소 근무시간(minDailyHours) 미달 시 isEarlyLeave = true
 * - 지각/조기퇴근 없음 (코어타임 이탈만 체크)
 */
function processFlexible(input: AttendanceInput): AttendanceResult {
  const { clockIn, clockOut, flexWork } = input
  const standardMinutes = input.standardMinutes ?? 480
  const breakMinutes = input.breakMinutes ?? 60
  const minDailyMinutes = (flexWork?.minDailyHours ?? 8) * 60

  const totalMs = clockOut.getTime() - clockIn.getTime()
  const totalMinutes = Math.max(0, Math.round(totalMs / 60000) - breakMinutes)
  const overtimeMinutes = Math.max(0, totalMinutes - standardMinutes)
  const nightMinutes = calcNightMinutes(clockIn, clockOut)

  let coreTimeCompliant = true
  if (flexWork?.flexEnabled && flexWork.coreTimeStart && flexWork.coreTimeEnd) {
    const coreStart = timeStringToMinutes(flexWork.coreTimeStart)
    const coreEnd = timeStringToMinutes(flexWork.coreTimeEnd)
    const inMin = toMinutesOfDay(clockIn)
    const outMin = toMinutesOfDay(clockOut)
    // 코어타임 내에 출근하고 코어타임 이후 퇴근해야 compliant
    coreTimeCompliant = inMin <= coreStart && outMin >= coreEnd
  }

  return {
    totalMinutes,
    overtimeMinutes,
    nightMinutes,
    isLate: false,
    isEarlyLeave: totalMinutes < minDailyMinutes,
    isAbsent: false,
    workType: 'FLEXIBLE',
    coreTimeCompliant,
  }
}

// ─── 교대 근무 처리 ────────────────────────────────────────

/**
 * SHIFT: 교대근무
 * - shiftStartMinutes / shiftEndMinutes: 예정 근무 시간 (분)
 * - 10분 초과 지각 = isLate
 * - 예정 시간 10분 이상 일찍 퇴근 = isEarlyLeave
 * - 야간 교대 (22:00~06:00) nightMinutes 계산
 */
function processShift(input: AttendanceInput): AttendanceResult {
  const { clockIn, clockOut, shiftStartMinutes, shiftEndMinutes } = input
  const breakMinutes = input.breakMinutes ?? 60

  // FIX: Issue #7 — Calendar-based weekend classification for shift workers.
  //   Previously: shift work date classification ignored calendar day.
  //   Now: check workDate.getDay() to detect Sat(6)/Sun(0) regardless of shift schedule.
  const isWeekend = input.workDate
    ? (() => { const d = input.workDate.getDay(); return d === 0 || d === 6 })()
    : false
  const isHoliday = input.isHoliday ?? false

  const LATE_TOLERANCE = 10  // 10분 지각 허용

  const totalMs = clockOut.getTime() - clockIn.getTime()
  const totalMinutes = Math.max(0, Math.round(totalMs / 60000) - breakMinutes)

  // 교대 예정 시간이 없으면 일반 계산으로 폴백
  if (shiftStartMinutes == null || shiftEndMinutes == null) {
    const overtimeMinutes = Math.max(0, totalMinutes - (input.standardMinutes ?? 480))
    const nightMinutes = calcNightMinutes(clockIn, clockOut)
    return {
      totalMinutes,
      overtimeMinutes,
      nightMinutes,
      isLate: false,
      isEarlyLeave: false,
      isAbsent: false,
      workType: 'SHIFT',
      isWeekend,
      isHoliday,
    }
  }

  const shiftDuration = (shiftEndMinutes - shiftStartMinutes + 1440) % 1440  // 자정 넘김 대응
  const standardShiftMinutes = shiftDuration - breakMinutes
  const overtimeMinutes = Math.max(0, totalMinutes - standardShiftMinutes)
  const nightMinutes = calcNightMinutes(clockIn, clockOut)

  const inMin = toMinutesOfDay(clockIn)
  const outMin = toMinutesOfDay(clockOut)

  const isLate = inMin > shiftStartMinutes + LATE_TOLERANCE
  const isEarlyLeave = outMin < shiftEndMinutes - LATE_TOLERANCE

  return {
    totalMinutes,
    overtimeMinutes,
    nightMinutes,
    isLate,
    isEarlyLeave,
    isAbsent: false,
    workType: 'SHIFT',
    isWeekend,
    isHoliday,
  }
}

// ─── 재택 근무 처리 ────────────────────────────────────────

/**
 * REMOTE: 재택근무
 * - 지각/조기퇴근 체크 없음
 * - 야간 근무 없음 (재택은 야간 수당 미적용)
 * - 일 최소 근무시간 체크
 */
function processRemote(input: AttendanceInput): AttendanceResult {
  const { clockIn, clockOut } = input
  const standardMinutes = input.standardMinutes ?? 480
  const breakMinutes = input.breakMinutes ?? 60

  const totalMs = clockOut.getTime() - clockIn.getTime()
  const totalMinutes = Math.max(0, Math.round(totalMs / 60000) - breakMinutes)
  const overtimeMinutes = Math.max(0, totalMinutes - standardMinutes)

  return {
    totalMinutes,
    overtimeMinutes,
    nightMinutes: 0,  // 재택은 야간수당 미적용
    isLate: false,
    isEarlyLeave: totalMinutes < standardMinutes,
    isAbsent: false,
    workType: 'REMOTE',
  }
}

// ─── Public API ───────────────────────────────────────────

/**
 * 근무유형별 근태 처리 메인 엔트리포인트
 * clock-out 시 호출하여 totalMinutes, overtimeMinutes 등을 계산합니다.
 */
export function processAttendance(input: AttendanceInput): AttendanceResult {
  const totalMs = input.clockOut.getTime() - input.clockIn.getTime()
  if (totalMs <= 0) {
    return {
      totalMinutes: 0,
      overtimeMinutes: 0,
      nightMinutes: 0,
      isLate: false,
      isEarlyLeave: false,
      isAbsent: false,
      workType: input.workType,
    }
  }

  switch (input.workType) {
    case 'FIXED':
      return processFixed(input)
    case 'FLEXIBLE':
      return processFlexible(input)
    case 'SHIFT':
      return processShift(input)
    case 'REMOTE':
      return processRemote(input)
    default:
      return processFixed(input)
  }
}

/**
 * 결근 판정
 * - 해당 날짜에 출근 기록이 없고 휴가/공휴일도 아닐 때
 */
export function markAbsent(workType: WorkType = 'FIXED'): AttendanceResult {
  return {
    totalMinutes: 0,
    overtimeMinutes: 0,
    nightMinutes: 0,
    isLate: false,
    isEarlyLeave: false,
    isAbsent: true,
    workType,
  }
}
