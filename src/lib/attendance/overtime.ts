// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Overtime computation (shared SSOT)
// 출퇴근(clock-out)·단말기·수동보정 경로가 동일 공식을 쓰도록 추출한 순수 헬퍼.
// 이전엔 각 경로가 초과근무 식을 따로 갖고 있어 수동보정 경로는 누락(overtimeMinutes
// stale → 급여 초과수당 오류)되어 있었음. 단일 SSOT로 재발(drift) 차단.
// ═══════════════════════════════════════════════════════════

/** 표준 근무시간 (분) — 8시간 */
export const STANDARD_MINUTES = 480

/** 기본 휴식시간 (분) — 1시간. 웹 출퇴근·수동보정 경로의 고정 차감값 */
export const DEFAULT_BREAK_MINUTES = 60

/**
 * 초과근무 분 계산: `max(0, totalMinutes − breakMinutes − STANDARD_MINUTES)`.
 *
 * @param totalMinutes raw 경과 분 (휴식 미차감 — clock-out/보정 경로의 totalMinutes 컨벤션)
 * @param breakMinutes 차감할 휴식 분 (기본 60). 단말기 경로는 누진 휴식을 직접 전달.
 */
export function computeOvertimeMinutes(
  totalMinutes: number,
  breakMinutes: number = DEFAULT_BREAK_MINUTES,
): number {
  return Math.max(0, totalMinutes - breakMinutes - STANDARD_MINUTES)
}

/**
 * 단말기(지문) 경로용 누진 휴식 차감: 8시간↑ → 60, 4시간↑ → 30, 그 외 0.
 * 웹 경로의 고정 60분과 다른 **기존 단말기 컨벤션**을 그대로 보존한다.
 * (웹↔단말기 휴식정책 불일치 자체는 별도 도메인 결정 사안 — 여기서 통일하지 않음)
 */
export function graduatedBreakMinutes(totalMinutes: number): number {
  return totalMinutes >= 480 ? 60 : totalMinutes >= 240 ? 30 : 0
}
