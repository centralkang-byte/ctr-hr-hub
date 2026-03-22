// DESIGN.md Section 10 — Status Color Mapping (통합)
// 모든 상태 뱃지 색상의 단일 소스. 페이지별 개별 hex 하드코딩 금지.

/** 시맨틱 배지 variant → Tailwind className (bg + text + border) */
export const STATUS_VARIANT = {
  /** 승인 / 정상 / 완료 / 활성 */
  success: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]',
  /** 대기 / 수습 / 검토중 */
  warning: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]',
  /** 반려 / 오류 / 만료 / 결근 */
  error: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
  /** 진행중 / 온보딩 / 참고 */
  info: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
  /** 미시작 / 초안 / 취소 / 비활성 */
  neutral: 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]',
  /** 정규직 / 카테고리 구분 */
  primary: 'bg-[#EEF2FF] text-[#6159E7] border-[#C7D2FE]',
} as const

/** 시맨틱 foreground 색상 (차트, 인라인 텍스트용) */
export const STATUS_FG = {
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',
  neutral: '#64748B',
  primary: '#6159E7',
} as const

/** 시맨틱 background 색상 (차트 fill, 배경색용) */
export const STATUS_BG = {
  success: '#ECFDF5',
  warning: '#FFFBEB',
  error: '#FEF2F2',
  info: '#EFF6FF',
  neutral: '#F1F5F9',
  primary: '#EEF2FF',
} as const

export type StatusVariant = keyof typeof STATUS_VARIANT
