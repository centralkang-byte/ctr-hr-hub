// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Settings Category & Tab Configuration (H-1)
// Data-driven config for 6 categories × N tabs
// ═══════════════════════════════════════════════════════════

import {
  Building2, Clock, Banknote, Target, UserPlus, Settings,
  type LucideIcon,
} from 'lucide-react'

// ─── Type Unions ──────────────────────────────────────────

export type SettingsCategoryKey =
  | 'organization'
  | 'attendance'
  | 'payroll'
  | 'performance'
  | 'recruitment'
  | 'system'

export type OrganizationTabSlug = 'company-info' | 'departments' | 'positions' | 'grade-title-mappings' | 'job-grades' | 'employee-titles' | 'job-families' | 'assignment-rules' | 'probation' | 'custom-fields' | 'code-management' | 'locations'
export type AttendanceTabSlug = 'work-schedules' | 'weekly-hours' | 'shift-patterns' | 'leave-types' | 'leave-accrual' | 'leave-promotion' | 'designated-leave' | 'holidays' | 'overtime' | 'loa-types'
export type PayrollTabSlug = 'earnings' | 'deductions' | 'tax-free' | 'salary-bands' | 'merit-matrix' | 'bonus-rules' | 'pay-schedule' | 'currency'
export type PerformanceTabSlug = 'cycle' | 'methodology' | 'grade-scale' | 'distribution' | 'calibration' | 'cfr' | 'competency'
export type RecruitmentTabSlug = 'pipeline' | 'interview-form' | 'ai-screening' | 'onboarding-templates' | 'offboarding-checklist' | 'probation-eval'
export type SystemTabSlug = 'notification-channels' | 'notification-rules' | 'locale' | 'roles' | 'approval-flows' | 'audit' | 'data-retention' | 'integrations'

export type SettingsTabSlug =
  | OrganizationTabSlug
  | AttendanceTabSlug
  | PayrollTabSlug
  | PerformanceTabSlug
  | RecruitmentTabSlug
  | SystemTabSlug

// ─── Interfaces ───────────────────────────────────────────

export interface SettingsTab {
  slug: SettingsTabSlug
  label: string
  description?: string
  isGlobalOnly?: boolean  // 🔒 cannot be overridden per company
}

export interface SettingsCategoryConfig {
  key: SettingsCategoryKey
  label: string
  labelEn: string
  icon: LucideIcon
  tabs: SettingsTab[]
}

// ─── Category Definitions ─────────────────────────────────

export const SETTINGS_CATEGORIES: SettingsCategoryConfig[] = [
  {
    key: 'organization',
    label: '조직/인사',
    labelEn: 'Organization',
    icon: Building2,
    tabs: [
      { slug: 'company-info', label: '법인 기본정보', description: '법인명, 주소, 사업자번호, 대표자' },
      { slug: 'departments', label: '부서 구조', description: '부서 트리, 코드 체계' },
      { slug: 'positions', label: '직위 관리', description: '법인별 직위(보직) 목록 및 보고 체계' },
      { slug: 'grade-title-mappings', label: '직급-호칭 매핑', description: '법인별 직급↔호칭 매핑 (L/E/S 체계)' },
      { slug: 'job-grades', label: '직급 체계 (레거시)', description: '직급 목록, 승진 순서, 체류 연수' },
      { slug: 'employee-titles', label: '호칭 관리 (레거시)', description: '법인별 호칭 목록 (직급과 독립)' },
      { slug: 'job-families', label: '직종/직무', description: 'Job Family, Job Profile' },
      { slug: 'assignment-rules', label: '발령 규칙', description: '발령 유형, 승인 절차' },
      { slug: 'probation', label: '수습 기간', description: '기간, 평가 기준, 자동 전환' },
      { slug: 'custom-fields', label: '커스텀 필드', description: '사용자 정의 필드 관리' },
      { slug: 'code-management', label: '코드 관리', description: '시스템 코드/열거형' },
      { slug: 'locations', label: '근무지 관리', description: '공장/사무소 등 근무지 목록' },
    ],
  },
  {
    key: 'attendance',
    label: '근태/휴가',
    labelEn: 'Attendance & Leave',
    icon: Clock,
    tabs: [
      { slug: 'work-schedules', label: '근무 스케줄', description: '기본 근무시간, 점심시간, 유연근무' },
      { slug: 'weekly-hours', label: '주간 근무한도', description: '52h/44h/48h/40h (법인별 필수)' },
      { slug: 'shift-patterns', label: '교대근무', description: '교대 패턴, 수당 배율' },
      { slug: 'leave-types', label: '휴가 유형', description: '연차/병가/경조사 등 목록' },
      { slug: 'leave-accrual', label: '휴가 부여 규칙', description: '입사일 기준 vs 회계연도, 비례 부여' },
      { slug: 'leave-promotion', label: '연차촉진', description: '알림 시점, 미사용 소멸 규칙' },
      { slug: 'designated-leave', label: '지정연차', description: '법인별 지정 연차 사용일 관리' },
      { slug: 'holidays', label: '법정 공휴일', description: '나라별 공휴일 캘린더' },
      { slug: 'overtime', label: '초과근무', description: '사전승인 필수 여부, 수당 배율' },
      { slug: 'loa-types', label: '휴직 유형', description: '육아/질병/가족돌봄 등 휴직 유형 관리' },
    ],
  },
  {
    key: 'payroll',
    label: '급여/보상',
    labelEn: 'Payroll & Compensation',
    icon: Banknote,
    tabs: [
      { slug: 'earnings', label: '급여 항목', description: '기본급, 식대, 교통비, 직책수당' },
      { slug: 'deductions', label: '공제 항목', description: '4대보험, 소득세, 주민세' },
      { slug: 'tax-free', label: '비과세 한도', description: '식대 20만원, 교통비 등' },
      { slug: 'salary-bands', label: '연봉 밴드', description: '직급별 최소/중간/최대' },
      { slug: 'merit-matrix', label: '인상률 매트릭스', description: '등급×밴드위치 인터랙티브 테이블' },
      { slug: 'bonus-rules', label: '성과급 규칙', description: '등급별 배율' },
      { slug: 'pay-schedule', label: '급여일', description: '매월 N일 (법인별)' },
      { slug: 'currency', label: '통화/환율', description: '법인별 통화 + 환율 관리' },
    ],
  },
  {
    key: 'performance',
    label: '성과/평가',
    labelEn: 'Performance',
    icon: Target,
    tabs: [
      { slug: 'cycle', label: '평가 주기', description: '반기/연간/분기' },
      { slug: 'methodology', label: '평가 방법론', description: 'MBO:BEI 비중 (레벨별)' },
      { slug: 'grade-scale', label: '등급 체계', description: 'E/M+/M/B' },
      { slug: 'distribution', label: '배분 가이드라인', description: '10/30/50/10 권장 비율' },
      { slug: 'calibration', label: '캘리브레이션', description: '필수 여부, 참여 범위' },
      { slug: 'cfr', label: 'CFR 설정', description: '1:1 최소 빈도, 피드백 익명' },
      { slug: 'competency', label: '역량 라이브러리', description: '핵심가치 13개 행동지표', isGlobalOnly: true },
    ],
  },
  {
    key: 'recruitment',
    label: '채용/온보딩',
    labelEn: 'Recruitment & Onboarding',
    icon: UserPlus,
    tabs: [
      { slug: 'pipeline', label: '채용 파이프라인', description: '단계 수, 단계명' },
      { slug: 'interview-form', label: '면접 평가항목', description: '평가표 기본 항목' },
      { slug: 'ai-screening', label: 'AI 스크리닝', description: '사용 여부, 기준 점수', isGlobalOnly: true },
      { slug: 'onboarding-templates', label: '온보딩 템플릿', description: '체크리스트 기본 항목' },
      { slug: 'offboarding-checklist', label: '오프보딩 체크리스트', description: '장비 회수, IT 비활성화 등' },
      { slug: 'probation-eval', label: '수습 평가', description: '평가 시점(30/60/90일), 기준' },
    ],
  },
  {
    key: 'system',
    label: '시스템',
    labelEn: 'System',
    icon: Settings,
    tabs: [
      { slug: 'notification-channels', label: '알림 채널', description: '이메일/Teams/앱 푸시' },
      { slug: 'notification-rules', label: '알림 규칙', description: '이벤트별 알림 대상' },
      { slug: 'locale', label: '언어/타임존', description: '법인별 기본 언어 + 타임존' },
      { slug: 'roles', label: '역할/권한', description: 'RBAC 역할 정의', isGlobalOnly: true },
      { slug: 'approval-flows', label: '결재 플로우', description: '모듈별 전결 규정 설정' },
      { slug: 'audit', label: '감사 로그', description: '보존 기간, 조회 범위' },
      { slug: 'data-retention', label: '데이터 보존', description: 'GDPR 삭제 주기, PII 마스킹' },
      { slug: 'integrations', label: '연동', description: 'Teams 웹훅, SSO/SAML, ERP, API 키' },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────

export function getCategoryConfig(key: SettingsCategoryKey): SettingsCategoryConfig {
  const config = SETTINGS_CATEGORIES.find((c) => c.key === key)
  if (!config) throw new Error(`Unknown settings category: ${key}`)
  return config
}

export function getTabConfig(category: SettingsCategoryKey, slug: string): SettingsTab | undefined {
  const config = getCategoryConfig(category)
  return config.tabs.find((t) => t.slug === slug)
}

export function getDefaultTab(category: SettingsCategoryKey): SettingsTabSlug {
  const config = getCategoryConfig(category)
  return config.tabs[0].slug
}
