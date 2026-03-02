// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Navigation Configuration (7-Section IA)
// 기존 17개 flat NavGroup → 7개 역할 기반 섹션
// ═══════════════════════════════════════════════════════════

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
  CalendarCheck,
  CalendarClock,
  UserPlus,
  UserMinus,
  GraduationCap,
  Wallet,
  Gavel,
  Award,
  Banknote,
  Crown,
  Shield,
  ShieldCheck,
  Heart,
  FileText,
  Monitor,
  Scale,
  Database,
  Eye,
  FileSearch,
  Sparkles,
  AlertTriangle,
  TrendingDown,
  Briefcase,
  LayoutDashboard,
  Bell,
  Palette,
  Languages,
  List,
  FormInput,
  GitBranch,
  Mail,
  Gauge,
  ToggleLeft,
  Download,
  LayoutGrid,
  ListChecks,
  Smile,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import { MODULE, ROLE } from '@/lib/constants'

// ─── Types ──────────────────────────────────────────────────

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
}

export interface NavSection {
  key: string
  labelKey: string
  label: string
  icon: LucideIcon
  visibleTo: string[]
  items: NavItem[]
}

// ─── All Roles shorthand ────────────────────────────────────

const ALL_ROLES = [
  ROLE.EMPLOYEE,
  ROLE.MANAGER,
  ROLE.EXECUTIVE,
  ROLE.HR_ADMIN,
  ROLE.SUPER_ADMIN,
]

const MANAGER_UP = [
  ROLE.MANAGER,
  ROLE.EXECUTIVE,
  ROLE.HR_ADMIN,
  ROLE.SUPER_ADMIN,
]

const HR_UP = [ROLE.HR_ADMIN, ROLE.SUPER_ADMIN]

// ─── 7-Section Navigation ───────────────────────────────────

export const NAVIGATION: NavSection[] = [
  // ── 1. 홈 ──────────────────────────────────────────────
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
    ],
  },

  // ── 2. 나의 공간 ──────────────────────────────────────
  {
    key: 'my-space',
    labelKey: 'nav.mySpace.label',
    label: '나의 공간',
    icon: User,
    visibleTo: ALL_ROLES,
    items: [
      {
        key: 'my-profile',
        labelKey: 'nav.mySpace.profile',
        label: '내 프로필',
        href: '/employees/me',
        icon: UserCircle,
        module: MODULE.EMPLOYEES,
      },
      {
        key: 'my-attendance',
        labelKey: 'nav.mySpace.attendance',
        label: '출퇴근/근태',
        href: '/attendance',
        icon: Clock,
        module: MODULE.ATTENDANCE,
      },
      {
        key: 'my-leave',
        labelKey: 'nav.mySpace.leave',
        label: '휴가',
        href: '/leave',
        icon: CalendarDays,
        module: MODULE.LEAVE,
      },
      {
        key: 'my-goals',
        labelKey: 'nav.mySpace.goals',
        label: '내 목표/평가',
        href: '/performance',
        icon: Target,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'my-payslip',
        labelKey: 'nav.mySpace.payslip',
        label: '내 급여명세서',
        href: '/payroll/me',
        icon: FileText,
        module: MODULE.PAYROLL,
      },
      {
        key: 'my-benefits',
        labelKey: 'nav.mySpace.benefits',
        label: '복리후생',
        href: '/benefits',
        icon: Gift,
        module: MODULE.BENEFITS,
      },
      {
        key: 'my-onboarding',
        labelKey: 'nav.mySpace.onboarding',
        label: '내 온보딩',
        href: '/onboarding/me',
        icon: UserCheck,
        module: MODULE.ONBOARDING,
      },
      {
        key: 'my-feedback',
        labelKey: 'nav.mySpace.feedback',
        label: '1:1/피드백',
        href: '/performance/one-on-one',
        icon: MessageSquare,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'self-eval',
        labelKey: 'nav.mySpace.selfEval',
        label: '자기평가',
        href: '/performance/self-eval',
        icon: ClipboardCheck,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'my-recognition',
        labelKey: 'nav.mySpace.recognition',
        label: '칭찬/인정',
        href: '/performance/recognition',
        icon: Heart,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'my-training',
        labelKey: 'nav.mySpace.training',
        label: '내 교육',
        href: '/training/enrollments',
        icon: GraduationCap,
        module: MODULE.TRAINING,
      },
    ],
  },

  // ── 3. 팀 관리 ────────────────────────────────────────
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
        key: 'team-attendance',
        labelKey: 'nav.team.attendance',
        label: '팀 근태',
        href: '/attendance/team',
        icon: Clock,
        module: MODULE.ATTENDANCE,
      },
      {
        key: 'team-leave',
        labelKey: 'nav.team.leave',
        label: '팀 휴가',
        href: '/leave/team',
        icon: CalendarDays,
        module: MODULE.LEAVE,
      },
      {
        key: 'team-goals',
        labelKey: 'nav.team.goals',
        label: '팀 목표',
        href: '/performance/team-goals',
        icon: Target,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'team-results',
        labelKey: 'nav.team.results',
        label: '팀 성과',
        href: '/performance/team-results',
        icon: BarChart3,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'manager-eval',
        labelKey: 'nav.team.managerEval',
        label: '매니저 평가',
        href: '/performance/manager-eval',
        icon: ClipboardCheck,
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
    ],
  },

  // ── 4. 인사 운영 ──────────────────────────────────────
  {
    key: 'hr-ops',
    labelKey: 'nav.hrOps.label',
    label: '인사 운영',
    icon: Building2,
    visibleTo: HR_UP,
    items: [
      {
        key: 'employees',
        labelKey: 'nav.hrOps.employees',
        label: '직원 관리',
        href: '/employees',
        icon: Users,
        module: MODULE.EMPLOYEES,
      },
      {
        key: 'org',
        labelKey: 'nav.hrOps.org',
        label: '조직 관리',
        href: '/org',
        icon: Network,
        module: MODULE.ORG,
      },
      {
        key: 'attendance-admin',
        labelKey: 'nav.hrOps.attendanceAdmin',
        label: '근태 관리',
        href: '/attendance/admin',
        icon: Clock,
        module: MODULE.ATTENDANCE,
      },
      {
        key: 'leave-admin',
        labelKey: 'nav.hrOps.leaveAdmin',
        label: '휴가 관리',
        href: '/leave/admin',
        icon: CalendarDays,
        module: MODULE.LEAVE,
      },
      {
        key: 'onboarding-admin',
        labelKey: 'nav.hrOps.onboarding',
        label: '온보딩',
        href: '/onboarding',
        icon: UserCheck,
        module: MODULE.ONBOARDING,
      },
      {
        key: 'onboarding-checkin',
        labelKey: 'nav.hrOps.checkin',
        label: '체크인',
        href: '/onboarding/checkin',
        icon: Smile,
        module: MODULE.ONBOARDING,
      },
      {
        key: 'onboarding-checkins',
        labelKey: 'nav.hrOps.checkinStatus',
        label: '체크인 현황',
        href: '/onboarding/checkins',
        icon: ListChecks,
        module: MODULE.ONBOARDING,
      },
      {
        key: 'offboarding',
        labelKey: 'nav.hrOps.offboarding',
        label: '퇴직관리',
        href: '/offboarding',
        icon: UserMinus,
        module: MODULE.OFFBOARDING,
      },
      {
        key: 'payroll',
        labelKey: 'nav.hrOps.payroll',
        label: '급여 관리',
        href: '/payroll',
        icon: Wallet,
        module: MODULE.PAYROLL,
      },
      {
        key: 'discipline',
        labelKey: 'nav.hrOps.discipline',
        label: '징계관리',
        href: '/discipline',
        icon: Gavel,
        module: MODULE.DISCIPLINE,
      },
      {
        key: 'rewards',
        labelKey: 'nav.hrOps.rewards',
        label: '포상관리',
        href: '/discipline/rewards',
        icon: Award,
        module: MODULE.DISCIPLINE,
      },
    ],
  },

  // ── 5. 인재 관리 ──────────────────────────────────────
  {
    key: 'talent',
    labelKey: 'nav.talent.label',
    label: '인재 관리',
    icon: UserCheck,
    visibleTo: HR_UP,
    items: [
      {
        key: 'recruitment',
        labelKey: 'nav.talent.recruitment',
        label: '채용 (ATS)',
        href: '/recruitment',
        icon: UserPlus,
        module: MODULE.RECRUITMENT,
      },
      {
        key: 'recruitment-dashboard',
        labelKey: 'nav.talent.recruitmentDashboard',
        label: '채용 대시보드',
        href: '/recruitment/dashboard',
        icon: BarChart3,
        module: MODULE.RECRUITMENT,
      },
      {
        key: 'performance-admin',
        labelKey: 'nav.talent.performance',
        label: '성과 관리',
        href: '/performance/admin',
        icon: Target,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'performance-goals',
        labelKey: 'nav.talent.goals',
        label: '목표관리',
        href: '/performance/goals',
        icon: ClipboardCheck,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'calibration',
        labelKey: 'nav.talent.calibration',
        label: '캘리브레이션',
        href: '/performance/calibration',
        icon: Scale,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'performance-results',
        labelKey: 'nav.talent.performanceResults',
        label: '성과 결과',
        href: '/performance/results',
        icon: BarChart3,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'peer-review',
        labelKey: 'nav.talent.peerReview',
        label: '동료 평가',
        href: '/performance/peer-review',
        icon: Users,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'pulse-survey',
        labelKey: 'nav.talent.pulse',
        label: '펄스 서베이',
        href: '/performance/pulse',
        icon: BarChart3,
        module: MODULE.PULSE,
      },
      {
        key: 'compensation',
        labelKey: 'nav.talent.compensation',
        label: '보상 관리',
        href: '/compensation',
        icon: Banknote,
        module: MODULE.COMPENSATION,
      },
      {
        key: 'benefits-admin',
        labelKey: 'nav.talent.benefits',
        label: '복리후생 관리',
        href: '/benefits',
        icon: Gift,
        module: MODULE.BENEFITS,
      },
      {
        key: 'training',
        labelKey: 'nav.talent.training',
        label: '교육/개발',
        href: '/training',
        icon: GraduationCap,
        module: MODULE.TRAINING,
      },
      {
        key: 'succession',
        labelKey: 'nav.talent.succession',
        label: '승계 계획',
        href: '/succession',
        icon: Crown,
        module: MODULE.SUCCESSION,
      },
    ],
  },

  // ── 6. 인사이트 ───────────────────────────────────────
  {
    key: 'insights',
    labelKey: 'nav.insights.label',
    label: '인사이트',
    icon: BarChart3,
    visibleTo: MANAGER_UP, // MANAGER/EXECUTIVE see partial, HR_ADMIN/SUPER_ADMIN see all
    items: [
      {
        key: 'analytics-overview',
        labelKey: 'nav.insights.overview',
        label: '전사 개요',
        href: '/analytics',
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
        key: 'turnover',
        labelKey: 'nav.insights.turnover',
        label: '이직 분석',
        href: '/analytics/turnover',
        icon: TrendingDown,
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
        label: '근태 분석',
        href: '/analytics/attendance',
        icon: Clock,
        module: MODULE.ANALYTICS,
      },
      {
        key: 'recruitment-analytics',
        labelKey: 'nav.insights.recruitment',
        label: '채용 분석',
        href: '/analytics/recruitment',
        icon: Briefcase,
        module: MODULE.ANALYTICS,
      },
      {
        key: 'compensation-analytics',
        labelKey: 'nav.insights.compensation',
        label: '보상 분석',
        href: '/analytics/compensation',
        icon: Banknote,
        module: MODULE.ANALYTICS,
      },
      {
        key: 'gender-pay-gap',
        labelKey: 'nav.insights.genderPayGap',
        label: '성별 임금 격차',
        href: '/analytics/gender-pay-gap',
        icon: Scale,
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
        key: 'attrition-risk',
        labelKey: 'nav.insights.attrition',
        label: '이탈 위험',
        href: '/analytics/attrition',
        icon: AlertTriangle,
        module: MODULE.ANALYTICS,
      },
      {
        key: 'ai-report',
        labelKey: 'nav.insights.aiReport',
        label: 'AI 보고서',
        href: '/analytics/report',
        icon: Sparkles,
        module: MODULE.ANALYTICS,
      },
      {
        key: 'compliance-gdpr',
        labelKey: 'nav.insights.gdpr',
        label: 'GDPR/개인정보',
        href: '/compliance/gdpr',
        icon: Shield,
        module: MODULE.COMPLIANCE,
      },
      {
        key: 'data-retention',
        labelKey: 'nav.insights.dataRetention',
        label: '데이터 보관',
        href: '/compliance/data-retention',
        icon: Database,
        module: MODULE.COMPLIANCE,
      },
      {
        key: 'pii-audit',
        labelKey: 'nav.insights.piiAudit',
        label: 'PII 감사',
        href: '/compliance/pii-audit',
        icon: Eye,
        module: MODULE.COMPLIANCE,
      },
      {
        key: 'dpia',
        labelKey: 'nav.insights.dpia',
        label: 'DPIA',
        href: '/compliance/dpia',
        icon: FileSearch,
        module: MODULE.COMPLIANCE,
      },
      {
        key: 'compliance-ru',
        labelKey: 'nav.insights.ruCompliance',
        label: '러시아 컴플라이언스',
        href: '/compliance/ru',
        icon: FileText,
        module: MODULE.COMPLIANCE,
        countryFilter: ['RU'],
      },
      {
        key: 'compliance-cn',
        labelKey: 'nav.insights.cnCompliance',
        label: '중국 컴플라이언스',
        href: '/compliance/cn',
        icon: Scale,
        module: MODULE.COMPLIANCE,
        countryFilter: ['CN'],
      },
      {
        key: 'compliance-kr',
        labelKey: 'nav.insights.krCompliance',
        label: '한국 컴플라이언스',
        href: '/compliance/kr',
        icon: ClipboardCheck,
        module: MODULE.COMPLIANCE,
        countryFilter: ['KR'],
      },
    ],
  },

  // ── 7. 설정 ───────────────────────────────────────────
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
