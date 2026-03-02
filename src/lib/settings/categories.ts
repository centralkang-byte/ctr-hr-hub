import {
  Calendar, BarChart3, Banknote, UserPlus, Building2, Cog,
  type LucideIcon,
} from 'lucide-react'

export interface SettingsItem {
  id: string
  label: string
  description: string
}

export interface SettingsCategory {
  id: string
  icon: LucideIcon
  label: string
  labelEn: string
  href: string
  disabled?: boolean
  items: SettingsItem[]
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'attendance',
    icon: Calendar,
    label: '근태/휴가',
    labelEn: 'Attendance & Leave',
    href: '/settings/attendance',
    items: [
      { id: 'work-schedule', label: '근무스케줄 설정', description: '법인별 기본 근무시간, 유연근무제, 시차출퇴근 패턴 정의' },
      { id: 'holidays', label: '공휴일 관리', description: '법인/국가별 공휴일 캘린더, 대체공휴일 규칙' },
      { id: 'leave-policy', label: '휴가정책', description: '연차/병가/경조사 등 휴가 유형별 부여 규칙, 이월 정책' },
      { id: 'overtime', label: '초과근무 정책', description: '52시간 상한, 연장근로 승인 워크플로, 보상휴가 전환 규칙' },
      { id: 'devices', label: '출퇴근 단말기', description: '태깅 디바이스 등록, 위치 기반 출퇴근 인증 설정' },
      { id: 'alerts-52h', label: '52시간 알림 기준', description: '주간/월간 누적 시간 임계치별 알림 트리거 설정' },
    ],
  },
  {
    id: 'performance',
    icon: BarChart3,
    label: '성과/평가',
    labelEn: 'Performance',
    href: '/settings/performance',
    items: [
      { id: 'eval-cycle', label: '평가사이클', description: '연간/반기/분기 평가 주기, 일정, 단계별 마감 기한' },
      { id: 'mbo', label: 'MBO 설정', description: '목표 수립 규칙, 가중치 범위, 자동 캐스케이딩 옵션' },
      { id: 'cfr', label: 'CFR 주기', description: 'Conversation-Feedback-Recognition 빈도, 리마인더 설정' },
      { id: 'bei', label: 'BEI 역량모델', description: '핵심가치 연계 행동지표(13개) 관리, 직급별 기대 수준' },
      { id: 'calibration', label: '캘리브레이션 규칙', description: '등급 분포 가이드라인, 강제배분 비율, 예외 승인 흐름' },
      { id: 'grade-system', label: '등급체계', description: 'S/A/B/C/D 등급 정의, 점수 구간, 표시 레이블 커스터마이징' },
      { id: 'multi-rater', label: '다면평가 설정', description: '평가자 유형(상향/동료/360), 익명성 수준, 최소 응답자 수' },
    ],
  },
  {
    id: 'compensation',
    icon: Banknote,
    label: '보상/복리후생',
    labelEn: 'Compensation & Benefits',
    href: '/settings/compensation',
    items: [
      { id: 'salary-band', label: '급여밴드', description: '직급/직무별 급여 범위, 시장 데이터 연동 기준' },
      { id: 'raise-matrix', label: '인상매트릭스', description: '성과등급 × 현재 위치(Compa-ratio) 기반 인상률 테이블' },
      { id: 'benefits', label: '복리후생 항목', description: '법인별 복리후생 메뉴, 자격 조건, 신청 기간' },
      { id: 'allowances', label: '수당 정책', description: '직책수당, 자격수당, 교통비 등 수당 유형 및 지급 규칙' },
      { id: 'payroll-integration', label: '외부 급여시스템 연동', description: '급여 데이터 전송 포맷, 마감 스케줄, API 설정' },
    ],
  },
  {
    id: 'recruitment',
    icon: UserPlus,
    label: '채용/온보딩',
    labelEn: 'Recruitment & Onboarding',
    href: '/settings/recruitment',
    items: [
      { id: 'pipeline', label: '채용 파이프라인', description: '8단계 파이프라인 커스터마이징, 단계별 자동화 규칙' },
      { id: 'eval-template', label: '평가기준 템플릿', description: '직무별 면접 평가표, 채점 기준, 합격 컷오프' },
      { id: 'ai-screening', label: 'AI 스크리닝 설정', description: 'AI 이력서 분석 기준, 매칭 가중치, 바이어스 필터' },
      { id: 'onboarding-checklist', label: '온보딩 체크리스트', description: 'Day 1/7/30/90 체크인 항목, 담당자 자동 배정 규칙' },
      { id: 'emotion-pulse', label: '감정펄스 주기', description: '신규 입사자 감정 서베이 빈도, 질문 템플릿, 에스컬레이션 기준' },
    ],
  },
  {
    id: 'organization',
    icon: Building2,
    label: '조직/인사',
    labelEn: 'Organization & HR',
    href: '/settings/organization',
    items: [
      { id: 'entities', label: '법인 관리', description: '6개 법인 기본 정보, 현지 노동법 파라미터, 통화/언어' },
      { id: 'org-chart', label: '조직도 설정', description: '부서 계층 구조, 표시 옵션, 점선 보고 라인' },
      { id: 'job-levels', label: '직급체계', description: 'L1/L2+ 직급 정의, 승진 경로, 직급별 권한 매핑' },
      { id: 'job-family', label: '직무분류', description: '직무군(Job Family), 직무(Job Role) 체계, 역량 연결' },
      { id: 'transfer-rules', label: '전출/전입 규칙', description: '법인 간 이동 워크플로, 필수 문서, 승인 체인' },
      { id: 'personnel-orders', label: '인사발령 유형', description: '승진/전보/휴직/복직 등 발령 유형 및 처리 절차' },
    ],
  },
  {
    id: 'system',
    icon: Cog,
    label: '시스템/연동',
    labelEn: 'System & Integration',
    href: '/settings/system',
    items: [
      { id: 'notifications', label: '알림 설정', description: '채널별(이메일/Teams/인앱) 알림 유형, 빈도, 수신 대상' },
      { id: 'workflow-engine', label: '워크플로 엔진', description: '승인 흐름 템플릿, 조건부 라우팅, 에스컬레이션 규칙' },
      { id: 'module-toggle', label: '모듈 활성화', description: '법인별 사용 모듈 On/Off, 기능 플래그 관리' },
      { id: 'teams', label: 'Teams 연동', description: 'Microsoft Teams 봇 설정, Adaptive Card 템플릿' },
      { id: 'm365', label: 'M365 연동', description: 'Outlook 캘린더 동기화, SharePoint 문서 연결' },
      { id: 'data-migration', label: '데이터 마이그레이션', description: 'i-people 등 레거시 데이터 임포트, 매핑 규칙' },
      { id: 'rbac', label: '역할/권한', description: 'RBAC 역할 정의, 페이지/기능별 접근 제어 매트릭스' },
      { id: 'audit-log', label: '감사로그', description: '로그 보존 기간, 추적 대상 액션, 내보내기 설정' },
    ],
  },
]

export function getCategoryById(id: string): SettingsCategory | undefined {
  return SETTINGS_CATEGORIES.find((c) => c.id === id)
}

export function getTotalItemCount(): number {
  return SETTINGS_CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0)
}
