// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Navigation Configuration (10-Section IA)
// HR 라이프사이클: People → Hire → Develop → Perform → Reward → Analyze
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
  Layers,
  Globe,
  Calculator,
  Upload,
  CheckCircle2,
  LogOut,
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

// ─── Role Groups ─────────────────────────────────────────────

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

const EXECUTIVE_UP = [
  ROLE.EXECUTIVE,
  ROLE.HR_ADMIN,
  ROLE.SUPER_ADMIN,
]

const HR_UP = [ROLE.HR_ADMIN, ROLE.SUPER_ADMIN]

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
      {
        key: 'approvals-inbox',
        labelKey: 'nav.home.approvalsInbox',
        label: '승인함',
        href: '/approvals/inbox',
        icon: CheckCircle2,
        module: MODULE.LEAVE,
        badge: 'new' as const,
      },
    ],
  },

  // ══ 2. MY SPACE (나의 공간) ════════════════════════════
  {
    key: 'my-space',
    labelKey: 'nav.mySpace.label',
    label: '나의 공간',
    icon: User,
    visibleTo: ALL_ROLES,
    items: [
      {
        key: 'my-tasks',
        labelKey: 'nav.mySpace.myTasks',
        label: '나의 업무',
        href: '/my/tasks',
        icon: ListChecks,
        module: MODULE.EMPLOYEES,
        badge: 'new' as const,
      },
      {
        key: 'my-profile',
        labelKey: 'nav.mySpace.profile',
        label: '내 프로필',
        href: '/my/profile',
        icon: UserCircle,
        module: MODULE.EMPLOYEES,
      },
      {
        key: 'my-attendance',
        labelKey: 'nav.mySpace.attendance',
        label: '출퇴근',
        href: '/attendance',
        icon: Clock,
        module: MODULE.ATTENDANCE,
      },
      {
        key: 'my-leave',
        labelKey: 'nav.mySpace.leave',
        label: '휴가 신청',
        href: '/leave',
        icon: CalendarDays,
        module: MODULE.LEAVE,
      },
      {
        key: 'my-payslip',
        labelKey: 'nav.mySpace.payslip',
        label: '급여명세서',
        href: '/payroll/me',
        icon: Wallet,
        module: MODULE.PAYROLL,
      },
      {
        key: 'my-goals',
        labelKey: 'nav.mySpace.goals',
        label: '목표/평가',
        href: '/performance',
        icon: Target,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'my-benefits',
        labelKey: 'nav.mySpace.benefits',
        label: '복리후생',
        href: '/my/benefits',
        icon: Gift,
        module: MODULE.BENEFITS,
      },
      {
        key: 'my-year-end',
        labelKey: 'nav.mySpace.yearEnd',
        label: '연말 정산',
        href: '/my/year-end',
        icon: FileText,
        module: MODULE.PAYROLL,
        countryFilter: ['KR'],
        badge: 'new' as const,
      },
      {
        key: 'my-onboarding',
        labelKey: 'nav.mySpace.myOnboarding',
        label: '나의 온보딩',
        href: '/onboarding/me',
        icon: UserCheck,
        module: MODULE.ONBOARDING,
      },
      {
        key: 'my-offboarding',
        labelKey: 'nav.mySpace.myOffboarding',
        label: '나의 퇴직처리',
        href: '/my/offboarding',
        icon: LogOut,
        module: MODULE.EMPLOYEES,
      },
    ],
  },

  // ══ 3. TEAM (팀 관리) — MANAGER+ ══════════════════════
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
        key: 'team-goals-performance',
        labelKey: 'nav.team.goalsPerformance',
        label: '팀 목표/성과',
        href: '/performance/team-goals',
        icon: Target,
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
        key: 'people-directory',
        labelKey: 'nav.hrMgmt.directory',
        label: '구성원 디렉토리',
        href: '/directory',
        icon: UserCheck,
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
        key: 'leave-admin',
        labelKey: 'nav.hrMgmt.leaveAdmin',
        label: '휴가 관리',
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
        key: 'exit-interview-stats',
        labelKey: 'nav.hrMgmt.exitInterviewStats',
        label: '퇴직 면담 분석',
        href: '/offboarding/exit-interviews',
        icon: BarChart3,
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
    ],
  },

  // ══ 5. RECRUITMENT (채용) — HR_ADMIN+ ═════════════════
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
    ],
  },

  // ══ 6. PERFORMANCE & COMPENSATION (성과/보상) — HR_ADMIN+ ══
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
      {
        key: 'performance-goals',
        labelKey: 'nav.performance.goals',
        label: '목표 관리',
        href: '/performance/goals',
        icon: ClipboardCheck,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'calibration',
        labelKey: 'nav.performance.calibration',
        label: '캘리브레이션',
        href: '/performance/calibration',
        icon: Scale,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'performance-results',
        labelKey: 'nav.performance.results',
        label: '성과 결과',
        href: '/performance/results',
        icon: BarChart3,
        module: MODULE.PERFORMANCE,
      },
      {
        key: 'peer-review',
        labelKey: 'nav.performance.peerReview',
        label: '동료 평가',
        href: '/performance/peer-review',
        icon: Users,
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
      {
        key: 'payroll-close-attendance',
        labelKey: 'nav.payroll.closeAttendance',
        label: '근태 마감',
        href: '/payroll/close-attendance',
        icon: Lock,
        module: MODULE.PAYROLL,
        badge: 'new' as const,
      },
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
        key: 'payroll-review',
        labelKey: 'nav.payroll.anomalyReview',
        label: '이상 검토',
        href: '/payroll/anomalies',
        icon: AlertTriangle,
        module: MODULE.PAYROLL,
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

  // ══ 9. COMPLIANCE (컴플라이언스) — HR_ADMIN+ ══════════
  {
    key: 'compliance',
    labelKey: 'nav.compliance.label',
    label: '컴플라이언스',
    icon: Shield,
    visibleTo: HR_UP,
    items: [
      {
        key: 'compliance-gdpr',
        labelKey: 'nav.compliance.gdpr',
        label: 'GDPR/개인정보',
        href: '/compliance/gdpr',
        icon: Shield,
        module: MODULE.COMPLIANCE,
      },
      {
        key: 'data-retention',
        labelKey: 'nav.compliance.dataRetention',
        label: '데이터 보관',
        href: '/compliance/data-retention',
        icon: Database,
        module: MODULE.COMPLIANCE,
      },
      {
        key: 'pii-audit',
        labelKey: 'nav.compliance.piiAudit',
        label: 'PII 감사',
        href: '/compliance/pii-audit',
        icon: Eye,
        module: MODULE.COMPLIANCE,
      },
      {
        key: 'dpia',
        labelKey: 'nav.compliance.dpia',
        label: 'DPIA',
        href: '/compliance/dpia',
        icon: FileSearch,
        module: MODULE.COMPLIANCE,
      },
      {
        key: 'compliance-kr',
        labelKey: 'nav.compliance.kr',
        label: '한국 컴플라이언스',
        href: '/compliance/kr',
        icon: ClipboardCheck,
        module: MODULE.COMPLIANCE,
        countryFilter: ['KR'],
      },
      {
        key: 'compliance-cn',
        labelKey: 'nav.compliance.cn',
        label: '중국 컴플라이언스',
        href: '/compliance/cn',
        icon: Scale,
        module: MODULE.COMPLIANCE,
        countryFilter: ['CN'],
      },
      {
        key: 'compliance-ru',
        labelKey: 'nav.compliance.ru',
        label: '러시아 컴플라이언스',
        href: '/compliance/ru',
        icon: FileText,
        module: MODULE.COMPLIANCE,
        countryFilter: ['RU'],
      },
    ],
  },

  // ══ 10. SETTINGS (설정) — HR_ADMIN+ ═══════════════════
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
