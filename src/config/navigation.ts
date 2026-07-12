// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Navigation Configuration (9-Section IA)
// HR 라이프사이클: People → Hire → Develop → Perform → Reward → Analyze
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: sidebar navigation IA — 30+ menu items, role-based visibility, 4 layers
// Last verified: 2026-03-28 (Session 49 — IA 리팩터링)
// ═══════════════════════════════════════════════════════════════

import {
  Home,
  User,
  Users,
  Building2,
  UserCheck,
  BarChart3,
  Settings,
  UserCircle,
  Clock,
  CalendarDays,
  Target,
  Gift,
  MessageSquare,
  ClipboardCheck,
  Network,
//   CalendarClock,
  UserPlus,
//   UserMinus,
//   GraduationCap,
  Wallet,
  Gavel,
//   Award,
  Banknote,
  Crown,
  Shield,
  ShieldCheck,
  Heart,
  FileText,
//   Monitor,
  Scale,
  Sparkles,
  TrendingDown,
  Briefcase,
  LayoutDashboard,
  Bell,
//   Palette,
//   Languages,
//   List,
//   FormInput,
//   GitBranch,
//   Mail,
//   Gauge,
//   ToggleLeft,
//   Download,
  LayoutGrid,
  ListChecks,
//   Smile,
  Layers,
  Globe,
  Calculator,
//   Upload,
  type LucideIcon,
} from 'lucide-react'
import { MODULE } from '@/lib/constants'
import { ROLE_GROUPS } from '@/lib/rbac/rbac-spec'

// ─── Types ──────────────────────────────────────────────────

// My Space 내 시각적 서브그룹 (구분선 + 레이블)
export type SubGroup = 'work' | 'time-off' | 'pay' | 'growth' | 'etc'

// 조건부 표시 아이템 (useNavigation에서 런타임 필터링)
export type ConditionalItem = 'onboarding' | 'offboarding' | 'year-end'

export interface NavItem {
  key: string
  labelKey: string
  label: string
  href: string
  icon: LucideIcon
  module: string
  badge?: 'new' | 'beta'
  comingSoon?: boolean
  children?: NavItem[]
  countryFilter?: string[]
  subGroup?: SubGroup
  conditional?: ConditionalItem
}

export interface NavSection {
  key: string
  labelKey: string
  label: string
  icon: LucideIcon
  visibleTo: string[]
  items: NavItem[]
}

// ─── Role Groups (SSOT: src/lib/rbac/rbac-spec.ts) ──────────

const ALL_ROLES = [...ROLE_GROUPS.ALL_ROLES]
const MANAGER_UP = [...ROLE_GROUPS.MANAGER_UP]
const HR_UP = [...ROLE_GROUPS.HR_UP]

// ─── 10-Section Navigation ───────────────────────────────────

export const NAVIGATION: NavSection[] = [

  // ══ 1. HOME (홈) ═══════════════════════════════════════
  {
    key: 'home',
    labelKey: 'nav.home.label',
    label: '홈',
    icon: Home,
    visibleTo: ALL_ROLES,
    items: [
      {
        key: 'dashboard',
        labelKey: 'nav.home.dashboard',
        label: '대시보드',
        href: '/home',
        icon: LayoutDashboard,
        module: MODULE.EMPLOYEES,
      },
      {
        key: 'notifications',
        labelKey: 'nav.home.notifications',
        label: '알림',
        href: '/notifications',
        icon: Bell,
        module: MODULE.EMPLOYEES,
      },
      // 승인함 → 나의 업무 승인 탭으로 통합 (2026-04-07 One Hub)
      // 기존 /approvals/inbox는 /my/tasks?tab=approvals로 redirect
    ],
  },

  // ══ 2. MY SPACE (나의 공간) ════════════════════════════
  // 19 → 12 상시 + 3 조건부 (IA 리팩터링 2026-03-28)
  {
    key: 'my-space',
    labelKey: 'nav.mySpace.label',
    label: '나의 공간',
    icon: User,
    visibleTo: ALL_ROLES,
    items: [
      // ── 업무 ──────────────────────────────────────────
      {
        key: 'my-tasks',
        labelKey: 'nav.mySpace.myTasks',
        label: '나의 업무',
        href: '/my/tasks',
        icon: ListChecks,
        module: MODULE.EMPLOYEES,
        badge: 'new' as const,
        subGroup: 'work',
      },
      // ── 근태/휴가 ──────────────────────────────────────
      {
        key: 'my-attendance',
        labelKey: 'nav.mySpace.attendance',
        label: '출퇴근',
        href: '/attendance',
        icon: Clock,
        module: MODULE.ATTENDANCE,
        subGroup: 'time-off',
      },
      // Wave1 IA merge (2026-06-12 제안 확정): 휴가+휴직 단일 진입 — 휴직은 /leave 허브
      // 헤더에서 진입. /leave-of-absence 루트는 존속(딥링크 유효), rail 에서만 병합.
      {
        key: 'my-leave',
        labelKey: 'nav.mySpace.leaveLoa',
        label: '휴가/휴직',
        href: '/leave',
        icon: CalendarDays,
        module: MODULE.LEAVE,
        subGroup: 'time-off',
      },
      // ── 급여 ──────────────────────────────────────────
      {
        key: 'my-payslip',
        labelKey: 'nav.mySpace.payslip',
        label: '급여명세서',
        href: '/payroll/me',
        icon: Wallet,
        module: MODULE.PAYROLL,
        subGroup: 'pay',
      },
      {
        key: 'my-benefits',
        labelKey: 'nav.mySpace.benefits',
        label: '복리후생',
        href: '/my/benefits',
        icon: Gift,
        module: MODULE.BENEFITS,
        subGroup: 'pay',
      },
      // Wave1 IA 데모션 4 (2026-06-12 제안 확정): 연말정산(self)은 급여명세서(/payroll/me)
      // 허브 헤더에서 진입 — 루트(/my/year-end) 존속, rail 에서만 내림.
      // ── 성장 ──────────────────────────────────────────
      // 평가/성장 허브 (프로토 PerfGrowthWrapper): 목표·분기 리뷰·자기평가 통합.
      // 분기 리뷰(/performance/my-quarterly-review)·스킬 자기평가(/my/skills)는 허브 탭으로 데모션 —
      // 루트는 존속(직접 URL·딥링크 유효), rail 에서만 내림.
      {
        key: 'my-goals',
        labelKey: 'nav.mySpace.growthHub',
        label: '평가/성장',
        href: '/performance/growth',
        icon: Target,
        module: MODULE.PERFORMANCE,
        subGroup: 'growth',
      },
      {
        key: 'my-training',
        labelKey: 'nav.mySpace.training',
        label: '나의 교육',
        href: '/my/training',
        icon: Briefcase,
        module: MODULE.TRAINING,
        subGroup: 'growth',
      },
      {
        key: 'my-recognition',
        labelKey: 'nav.mySpace.recognition',
        label: '리코그니션',
        href: '/performance/recognition',
        icon: Heart,
        module: MODULE.PERFORMANCE,
        subGroup: 'growth',
      },
      // ── 기타 ──────────────────────────────────────────
      {
        key: 'my-documents',
        labelKey: 'nav.mySpace.documents',
        label: '문서/증명서',
        href: '/my/documents',
        icon: FileText,
        module: MODULE.EMPLOYEES,
        badge: 'new' as const,
        subGroup: 'etc',
      },
      {
        key: 'my-profile',
        labelKey: 'nav.mySpace.profile',
        label: '내 프로필',
        href: '/my/profile',
        icon: UserCircle,
        module: MODULE.EMPLOYEES,
        subGroup: 'etc',
      },
      // Wave1 IA 데모션 4 (2026-06-12 제안 확정): 나의 온보딩/퇴직처리는 홈 트래커 카드
      // (활성 플로우 시 노출)에서 진입 — 루트(/onboarding/me·/my/offboarding) 존속, rail 에서만 내림.
    ],
  },

  // ══ 3. TEAM (팀 관리) — MANAGER+ ══════════════════════
  // 7 → 5 (매니저 평가 제거, 팀 근태/휴가 통합)
  {
    key: 'team',
    labelKey: 'nav.team.label',
    label: '팀 관리',
    icon: Users,
    visibleTo: MANAGER_UP,
    items: [
      {
        key: 'team-hub',
        labelKey: 'nav.team.hub',
        label: '팀 현황',
        href: '/manager-hub',
        icon: BarChart3,
        module: MODULE.EMPLOYEES,
      },
      {
        key: 'team-time',
        labelKey: 'nav.team.time',
        label: '팀 근태/휴가',
        href: '/attendance/team',
        icon: Clock,
        module: MODULE.ATTENDANCE,
      },
      {
        // 런칭 감사 P1: PR #222가 백엔드 접근을 열었으나 nav 진입점이 HR_UP 그룹에만
        // 있어 MANAGER가 도달 불가했음. HR_ADMIN은 인사 관리 그룹과 중복 노출됨
        // (per-item role 필터 부재 — 의도적 수용, S335 Codex G1 P2).
        key: 'team-onboarding',
        labelKey: 'nav.team.onboarding',
        label: '팀 온보딩',
        href: '/onboarding',
        icon: ClipboardCheck,
        module: MODULE.ONBOARDING,
      },
      {
        key: 'team-goals-performance',
        labelKey: 'nav.team.goalsPerformance',
        label: '팀 목표/성과',
        href: '/performance/team-goals',
        icon: Target,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'team-one-on-one',
        labelKey: 'nav.team.oneOnOne',
        label: '1:1 미팅',
        href: '/performance/one-on-one',
        icon: MessageSquare,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'delegation-settings',
        labelKey: 'nav.team.delegation',
        label: '위임 설정',
        href: '/delegation/settings',
        icon: ShieldCheck,
        module: MODULE.LEAVE,
        badge: 'new' as const,
      },
    ],
  },

  // ══ 4. HR MANAGEMENT (인사 관리) — HR_ADMIN+ ══════════
  // 9 → 6 (구성원 디렉토리 제거, 휴가/휴직 통합, 퇴직면담 제거)
  {
    key: 'hr-mgmt',
    labelKey: 'nav.hrMgmt.label',
    label: '인사 관리',
    icon: Building2,
    visibleTo: HR_UP,
    items: [
      {
        key: 'employees',
        labelKey: 'nav.hrMgmt.employees',
        label: '직원 관리',
        href: '/employees',
        icon: Users,
        module: MODULE.EMPLOYEES,
      },
      {
        key: 'org',
        labelKey: 'nav.hrMgmt.org',
        label: '조직 관리',
        href: '/org',
        icon: Network,
        module: MODULE.ORG,
      },
      {
        key: 'attendance-admin',
        labelKey: 'nav.hrMgmt.attendanceAdmin',
        label: '근태 관리',
        href: '/attendance/admin',
        icon: Clock,
        module: MODULE.ATTENDANCE,
      },
      {
        key: 'leave-loa-admin',
        labelKey: 'nav.hrMgmt.leaveLoaAdmin',
        label: '휴가/휴직 관리',
        href: '/leave/admin',
        icon: CalendarDays,
        module: MODULE.LEAVE,
      },
      {
        key: 'onboarding-offboarding',
        labelKey: 'nav.hrMgmt.onboardingOffboarding',
        label: '온보딩/오프보딩',
        href: '/onboarding',
        icon: UserCheck,
        module: MODULE.ONBOARDING,
      },
      {
        key: 'discipline-rewards',
        labelKey: 'nav.hrMgmt.disciplineRewards',
        label: '징계/포상',
        href: '/discipline',
        icon: Gavel,
        module: MODULE.DISCIPLINE,
      },
      // Wave1 IA move (2026-06-12 제안 확정): 컴플라이언스 설정 → 인사 관리
      {
        key: 'compliance-hub',
        labelKey: 'nav.compliance.hub',
        label: '컴플라이언스',
        href: '/compliance',
        icon: Shield,
        module: MODULE.COMPLIANCE,
      },
    ],
  },

  // ══ 5. RECRUITMENT (채용) — HR_ADMIN+ ═════════════════
  // 4 → 5 (사내 채용 My Space에서 이동)
  {
    key: 'recruitment',
    labelKey: 'nav.recruitment.label',
    label: '채용',
    icon: UserPlus,
    visibleTo: HR_UP,
    items: [
      {
        key: 'recruitment-posts',
        labelKey: 'nav.recruitment.posts',
        label: '채용 공고',
        href: '/recruitment',
        icon: Briefcase,
        module: MODULE.RECRUITMENT,
      },
      {
        // 런칭 감사 P1: 채용 요청(requisition) 승인 워크플로 nav 진입점 부재.
        // 비-HR 결재자(부서장 등)는 /my/tasks 결재함 배너로 진입 (S335).
        key: 'recruitment-requisitions',
        labelKey: 'nav.recruitment.requisitions',
        label: '채용 요청',
        href: '/recruitment/requisitions',
        icon: FileText,
        module: MODULE.RECRUITMENT,
      },
      {
        key: 'recruitment-dashboard',
        labelKey: 'nav.recruitment.dashboard',
        label: '채용 대시보드',
        href: '/recruitment/dashboard',
        icon: BarChart3,
        module: MODULE.RECRUITMENT,
      },
      {
        key: 'recruitment-board',
        labelKey: 'nav.recruitment.board',
        label: '칸반 보드',
        href: '/recruitment/board',
        icon: LayoutGrid,
        module: MODULE.RECRUITMENT,
        badge: 'new' as const,
      },
      {
        key: 'talent-pool',
        labelKey: 'nav.recruitment.talentPool',
        label: '인재 풀',
        href: '/talent/succession',
        icon: Crown,
        module: MODULE.SUCCESSION,
      },
      {
        key: 'internal-jobs',
        labelKey: 'nav.recruitment.internalJobs',
        label: '사내 채용',
        href: '/my/internal-jobs',
        icon: Briefcase,
        module: MODULE.RECRUITMENT,
      },
    ],
  },

  // ══ 6. PERFORMANCE & COMPENSATION (성과/보상) — HR_ADMIN+ ══
  // 7 → 4 (목표/결과/동료평가 성과 허브 탭으로 흡수)
  {
    key: 'performance',
    labelKey: 'nav.performance.label',
    label: '성과/보상',
    icon: Target,
    visibleTo: HR_UP,
    items: [
      {
        key: 'performance-admin',
        labelKey: 'nav.performance.admin',
        label: '성과 관리',
        href: '/performance/admin',
        icon: Target,
        module: MODULE.PERFORMANCE,
      },
      // Wave1 IA 데모션 2 (2026-06-12 제안 확정): 분기 리뷰(admin)는 성과 관리 허브
      // (/performance/admin?tab=quarterly) 탭으로 — 루트 존속, rail 에서만 내림.
      {
        key: 'calibration',
        labelKey: 'nav.performance.calibration',
        label: '캘리브레이션',
        href: '/performance/calibration',
        icon: Scale,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'compensation',
        labelKey: 'nav.performance.compensation',
        label: '보상 관리',
        href: '/compensation',
        icon: Banknote,
        module: MODULE.COMPENSATION,
      },
      {
        key: 'off-cycle',
        labelKey: 'nav.performance.offCycle',
        label: '비정기 조정',
        href: '/compensation/off-cycle',
        icon: Sparkles,
        module: MODULE.COMPENSATION,
      },
      {
        key: 'benefits-admin',
        labelKey: 'nav.performance.benefits',
        label: '복리후생 관리',
        href: '/benefits',
        icon: Gift,
        module: MODULE.BENEFITS,
      },
    ],
  },

  // ══ 7. PAYROLL (급여) — HR_ADMIN+ ═════════════════════
  {
    key: 'payroll',
    labelKey: 'nav.payroll.label',
    label: '급여',
    icon: Wallet,
    visibleTo: HR_UP,
    items: [
      {
        key: 'payroll-admin',
        labelKey: 'nav.payroll.admin',
        label: '급여 대시보드',
        href: '/payroll',
        icon: LayoutDashboard,
        module: MODULE.PAYROLL,
      },
      // Wave1 IA 데모션 3 (2026-06-12 제안 확정): 근태 마감·이상 검토는 급여 대시보드
      // (/payroll) run-flow 버튼으로 — 루트 존속, rail 에서만 내림.
      {
        key: 'payroll-adjustments',
        labelKey: 'nav.payroll.adjustments',
        label: '수동 조정',
        href: '/payroll/adjustments',
        icon: Layers,
        module: MODULE.PAYROLL,
        badge: 'new' as const,
      },
      {
        key: 'payroll-global',
        labelKey: 'nav.payroll.global',
        label: '글로벌 급여',
        href: '/payroll/global',
        icon: Globe,
        module: MODULE.PAYROLL,
      },
      {
        key: 'payroll-simulation',
        labelKey: 'nav.payroll.simulation',
        label: '급여 시뮬레이션',
        href: '/payroll/simulation',
        icon: Calculator,
        module: MODULE.PAYROLL,
      },
      {
        key: 'payroll-bank-transfers',
        labelKey: 'nav.payroll.bankTransfers',
        label: '이체 내역',
        href: '/payroll/bank-transfers',
        icon: Banknote,
        module: MODULE.PAYROLL,
      },
      {
        key: 'year-end-settlement-hr',
        labelKey: 'nav.payroll.yearEnd',
        label: '연말정산',
        href: '/payroll/year-end',
        icon: FileText,
        module: MODULE.PAYROLL,
        countryFilter: ['KR'],
        badge: 'new' as const,
      },
    ],
  },

  // ══ 8. INSIGHTS (인사이트) — G-1 Unified Dashboards ═══
  {
    key: 'insights',
    labelKey: 'nav.insights.label',
    label: '인사이트',
    icon: BarChart3,
    visibleTo: MANAGER_UP,
    items: [
      {
        key: 'executive-summary',
        labelKey: 'nav.insights.executiveSummary',
        label: 'Executive Summary',
        href: '/dashboard',
        icon: LayoutDashboard,
        module: MODULE.ANALYTICS,
      },
      {
        key: 'workforce',
        labelKey: 'nav.insights.workforce',
        label: '인력 분석',
        href: '/analytics/workforce',
        icon: Users,
        module: MODULE.ANALYTICS,
      },
      {
        key: 'payroll-analytics',
        labelKey: 'nav.insights.payroll',
        label: '급여 분석',
        href: '/analytics/payroll',
        icon: Banknote,
        module: MODULE.ANALYTICS,
      },
      {
        key: 'performance-analytics',
        labelKey: 'nav.insights.performance',
        label: '성과 분석',
        href: '/analytics/performance',
        icon: Target,
        module: MODULE.ANALYTICS,
      },
      {
        key: 'attendance-analytics',
        labelKey: 'nav.insights.attendance',
        label: '근태/휴가 분석',
        href: '/analytics/attendance',
        icon: Clock,
        module: MODULE.ANALYTICS,
      },
      {
        key: 'turnover',
        labelKey: 'nav.insights.turnover',
        label: '이직 분석',
        href: '/analytics/turnover',
        icon: TrendingDown,
        module: MODULE.ANALYTICS,
      },
      {
        key: 'team-health',
        labelKey: 'nav.insights.teamHealth',
        label: '팀 건강',
        href: '/analytics/team-health',
        icon: Heart,
        module: MODULE.ANALYTICS,
      },
      {
        key: 'ai-report',
        labelKey: 'nav.insights.aiReport',
        label: 'AI 리포트',
        href: '/analytics/ai-report',
        icon: Sparkles,
        module: MODULE.ANALYTICS,
      },
    ],
  },

  // ══ 9. SETTINGS (설정) — HR_ADMIN+ ═══════════════════
  // Wave1 IA move (2026-06-12 제안 확정): 컴플라이언스 → 인사 관리 그룹으로 이동
  {
    key: 'settings',
    labelKey: 'nav.settings.label',
    label: '설정',
    icon: Settings,
    visibleTo: HR_UP,
    items: [
      {
        key: 'settings-hub',
        labelKey: 'nav.settings.hub',
        label: '설정',
        href: '/settings',
        icon: Settings,
        module: MODULE.SETTINGS,
      },
    ],
  },
]
