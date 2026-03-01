'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Sidebar Navigation
// bg-ctr-primary, 모듈별 그룹핑, 권한 필터링
// ═══════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Users,
  Network,
  Clock,
  CalendarDays,
  CalendarCheck,
  CalendarClock,
  Target,
  Wallet,
  UserPlus,
  UserMinus,
  GraduationCap,
  Gift,
  Heart,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
  ListChecks,
  BarChart3,
  ClipboardCheck,
  Handshake,
  FileText,
  UserCircle,
  LogOut,
  Smile,
  UserCheck,
  Monitor,
  Gavel,
  Award,
  Banknote,
  AlertTriangle,
  TrendingDown,
  Briefcase,
  Sparkles,
  LayoutDashboard,
  Bell,
  Crown,
  Palette,
  Languages,
  List,
  FormInput,
  GitBranch,
  Mail,
  MessageSquare,
  Gauge,
  ToggleLeft,
  Download,
  LayoutGrid,
  Eye,
  FileSearch,
  Database,
  Scale,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { Permission, SessionUser } from '@/types'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// ─── Types ──────────────────────────────────────────────────

interface NavItem {
  labelKey: string
  href: string
  icon: LucideIcon
  countryFilter?: string[]
}

interface NavGroup {
  labelKey: string
  icon: LucideIcon
  module: string
  items: NavItem[]
}

interface SidebarProps {
  user: SessionUser
  onSignOut: () => void
  countryCode?: string
}

// ─── Navigation Configuration ───────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'hrManagement',
    icon: Users,
    module: MODULE.EMPLOYEES,
    items: [
      { labelKey: 'employeeList', href: '/employees', icon: Users },
      { labelKey: 'myProfile', href: '/employees/me', icon: UserCircle },
      { labelKey: 'orgChart', href: '/org', icon: Network },
      { labelKey: 'grades', href: '/org/grades', icon: Shield },
    ],
  },
  {
    labelKey: 'attendanceManagement',
    icon: Clock,
    module: MODULE.ATTENDANCE,
    items: [
      { labelKey: 'myAttendance', href: '/attendance', icon: Clock },
      { labelKey: 'teamAttendance', href: '/attendance/team', icon: Users },
      { labelKey: 'allAttendance', href: '/attendance/admin', icon: BarChart3 },
    ],
  },
  {
    labelKey: 'leaveManagement',
    icon: CalendarDays,
    module: MODULE.LEAVE,
    items: [
      { labelKey: 'myLeave', href: '/leave', icon: CalendarDays },
      { labelKey: 'teamLeave', href: '/leave/team', icon: Users },
      { labelKey: 'leaveAdmin', href: '/leave/admin', icon: BarChart3 },
    ],
  },
  {
    labelKey: 'performanceManagement',
    icon: Target,
    module: MODULE.PERFORMANCE,
    items: [
      { labelKey: 'performanceDashboard', href: '/performance', icon: Target },
      { labelKey: 'goalManagement', href: '/performance/goals', icon: ClipboardCheck },
      { labelKey: 'teamGoals', href: '/performance/team-goals', icon: Users },
      { labelKey: 'performanceResults', href: '/performance/results', icon: BarChart3 },
      { labelKey: 'oneOnOne', href: '/performance/one-on-one', icon: Handshake },
      { labelKey: 'competencyEval', href: '/performance/competency', icon: BarChart3 },
    ],
  },
  {
    labelKey: 'compensationSalary',
    icon: Banknote,
    module: MODULE.COMPENSATION,
    items: [
      { labelKey: 'salaryAdjustment', href: '/compensation', icon: Banknote },
    ],
  },
  {
    labelKey: 'analyticsSection',
    icon: BarChart3,
    module: MODULE.ANALYTICS,
    items: [
      { labelKey: 'companyOverview', href: '/analytics', icon: LayoutDashboard },
      { labelKey: 'workforceAnalysis', href: '/analytics/workforce', icon: Users },
      { labelKey: 'turnoverAnalysis', href: '/analytics/turnover', icon: TrendingDown },
      { labelKey: 'performanceAnalysis', href: '/analytics/performance', icon: Target },
      { labelKey: 'attendanceAnalysis', href: '/analytics/attendance', icon: Clock },
      { labelKey: 'recruitmentAnalysis', href: '/analytics/recruitment', icon: Briefcase },
      { labelKey: 'compensationAnalysis', href: '/analytics/compensation', icon: Banknote },
      { labelKey: 'teamHealth', href: '/analytics/team-health', icon: Heart },
      { labelKey: 'attritionRisk', href: '/analytics/attrition', icon: AlertTriangle },
      { labelKey: 'aiReport', href: '/analytics/report', icon: Sparkles },
    ],
  },
  {
    labelKey: 'payrollManagement',
    icon: Wallet,
    module: MODULE.PAYROLL,
    items: [
      { labelKey: 'payrollProcessing', href: '/payroll', icon: Wallet },
      { labelKey: 'myPayStub', href: '/payroll/me', icon: FileText },
    ],
  },
  {
    labelKey: 'recruitmentManagement',
    icon: UserPlus,
    module: MODULE.RECRUITMENT,
    items: [
      { labelKey: 'jobPostings', href: '/recruitment', icon: UserPlus },
      { labelKey: 'recruitmentDashboard', href: '/recruitment/dashboard', icon: BarChart3 },
    ],
  },
  {
    labelKey: 'disciplineRewards',
    icon: Gavel,
    module: MODULE.DISCIPLINE,
    items: [
      { labelKey: 'disciplineManagement', href: '/discipline', icon: Gavel },
      { labelKey: 'rewardManagement', href: '/discipline/rewards', icon: Award },
    ],
  },
  {
    labelKey: 'onboarding',
    icon: UserCheck,
    module: MODULE.ONBOARDING,
    items: [
      { labelKey: 'onboardingDashboard', href: '/onboarding', icon: UserCheck },
      { labelKey: 'myOnboarding', href: '/onboarding/me', icon: UserCircle },
      { labelKey: 'checkin', href: '/onboarding/checkin', icon: Smile },
      { labelKey: 'checkinStatus', href: '/onboarding/checkins', icon: ListChecks },
    ],
  },
  {
    labelKey: 'offboarding',
    icon: UserMinus,
    module: MODULE.OFFBOARDING,
    items: [
      { labelKey: 'offboardingDashboard', href: '/offboarding', icon: UserMinus },
    ],
  },
  {
    labelKey: 'trainingManagement',
    icon: GraduationCap,
    module: MODULE.TRAINING,
    items: [
      { labelKey: 'courses', href: '/training', icon: GraduationCap },
      { labelKey: 'enrollmentStatus', href: '/training/enrollments', icon: ListChecks },
    ],
  },
  {
    labelKey: 'benefitsWelfare',
    icon: Gift,
    module: MODULE.BENEFITS,
    items: [
      { labelKey: 'benefitsPolicy', href: '/benefits', icon: Gift },
      { labelKey: 'enrollmentApplications', href: '/benefits/enrollments', icon: ListChecks },
    ],
  },
  {
    labelKey: 'managerHub',
    icon: BarChart3,
    module: MODULE.EMPLOYEES,
    items: [
      { labelKey: 'teamInsights', href: '/manager-hub', icon: BarChart3 },
    ],
  },
  {
    labelKey: 'successionPlanning',
    icon: Crown,
    module: MODULE.SUCCESSION,
    items: [
      { labelKey: 'keyPositions', href: '/succession', icon: Crown },
    ],
  },
  {
    labelKey: 'recognition',
    icon: Heart,
    module: MODULE.PERFORMANCE,
    items: [
      { labelKey: 'sendRecognition', href: '/performance/recognition', icon: Heart },
      { labelKey: 'recognitionStatus', href: '/performance/recognition/list', icon: ListChecks },
    ],
  },
  {
    labelKey: 'compliance',
    icon: ShieldCheck,
    module: MODULE.COMPLIANCE,
    items: [
      { labelKey: 'gdprPrivacy', href: '/compliance/gdpr', icon: Shield },
      { labelKey: 'dataRetention', href: '/compliance/data-retention', icon: Database },
      { labelKey: 'piiAudit', href: '/compliance/pii-audit', icon: Eye },
      { labelKey: 'dpia', href: '/compliance/dpia', icon: FileSearch },
      { labelKey: 'ruCompliance', href: '/compliance/ru', icon: FileText, countryFilter: ['RU'] },
      { labelKey: 'cnCompliance', href: '/compliance/cn', icon: Scale, countryFilter: ['CN'] },
      { labelKey: 'krCompliance', href: '/compliance/kr', icon: ClipboardCheck, countryFilter: ['KR'] },
    ],
  },
  {
    labelKey: 'systemSettings',
    icon: Settings,
    module: MODULE.SETTINGS,
    items: [
      { labelKey: 'companySettings', href: '/settings', icon: Settings },
      { labelKey: 'roleManagement', href: '/settings/roles', icon: Shield },
      { labelKey: 'workSchedule', href: '/settings/work-schedules', icon: CalendarClock },
      { labelKey: 'holidays', href: '/settings/holidays', icon: CalendarCheck },
      { labelKey: 'terminals', href: '/settings/terminals', icon: Monitor },
      { labelKey: 'leavePolicy', href: '/settings/leave-policies', icon: CalendarDays },
      { labelKey: 'shiftRoster', href: '/settings/shift-roster', icon: Clock },
      { labelKey: 'onboardingSettings', href: '/settings/onboarding', icon: UserCheck },
      { labelKey: 'offboardingChecklist', href: '/settings/offboarding', icon: UserMinus },
      { labelKey: 'profileRequests', href: '/settings/profile-requests', icon: ClipboardCheck },
      { labelKey: 'performanceCycles', href: '/settings/performance-cycles', icon: Target },
      { labelKey: 'competencyLibrary', href: '/settings/competencies', icon: Target },
      { labelKey: 'salaryBands', href: '/settings/salary-bands', icon: Banknote },
      { labelKey: 'raiseMatrix', href: '/settings/salary-matrix', icon: Banknote },
      { labelKey: 'notificationSettings', href: '/settings/notifications', icon: Bell },
      { labelKey: 'branding', href: '/settings/branding', icon: Palette },
      { labelKey: 'termSettings', href: '/settings/terms', icon: Languages },
      { labelKey: 'enumManagement', href: '/settings/enums', icon: List },
      { labelKey: 'customFields', href: '/settings/custom-fields', icon: FormInput },
      { labelKey: 'workflows', href: '/settings/workflows', icon: GitBranch },
      { labelKey: 'emailTemplates', href: '/settings/email-templates', icon: Mail },
      { labelKey: 'evaluationScale', href: '/settings/evaluation-scale', icon: Gauge },
      { labelKey: 'moduleOnOff', href: '/settings/modules', icon: ToggleLeft },
      { labelKey: 'exportTemplates', href: '/settings/export-templates', icon: Download },
      { labelKey: 'dashboardWidgets', href: '/settings/dashboard-widgets', icon: LayoutGrid },
      { labelKey: 'hrDocuments', href: '/settings/hr-documents', icon: FileText },
      { labelKey: 'teamsIntegration', href: '/settings/teams', icon: MessageSquare },
      { labelKey: 'auditLog', href: '/settings/audit-log', icon: FileText },
    ],
  },
]

// ─── Permission check helper ────────────────────────────────

function canAccessModule(
  user: SessionUser,
  module: string,
): boolean {
  if (user.role === ROLE.SUPER_ADMIN) return true

  // Settings module: HR_ADMIN+ only
  if (module === MODULE.SETTINGS) {
    return user.role === ROLE.HR_ADMIN
  }

  return user.permissions.some(
    (p: Permission) => p.module === module && p.action === ACTION.VIEW,
  )
}

// ─── Component ──────────────────────────────────────────────

export function Sidebar({ user, onSignOut, countryCode }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const t = useTranslations('menu')
  const tAuth = useTranslations('auth')

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev)
  }, [])

  const filteredGroups = useMemo(() => {
    return NAV_GROUPS
      .filter((group) => canAccessModule(user, group.module))
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!item.countryFilter) return true
          if (!countryCode) return true
          return item.countryFilter.includes(countryCode)
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [user, countryCode])

  const userInitial = user.name.charAt(0).toUpperCase()

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-screen flex-col bg-ctr-sidebar text-ctr-sidebar-text transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* ─── Logo / Brand Area ─── */}
        <div className={cn('flex items-center gap-3 px-4 py-5', collapsed && 'justify-center px-2')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ctr-primary/15 font-bold text-ctr-primary">
            C
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold tracking-tight text-ctr-primary">CTR HR Hub</h1>
              <p className="truncate text-[10px] text-ctr-sidebar-text/60">{tAuth('slogan')}</p>
            </div>
          )}
        </div>

        <Separator className="bg-ctr-primary/15" />

        {/* ─── Navigation ─── */}
        <ScrollArea className="flex-1 py-2">
          <nav className="space-y-1 px-2">
            {filteredGroups.map((group) => (
              <div key={group.labelKey} className="mb-3">
                {/* Group label */}
                {!collapsed && (
                  <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-ctr-sidebar-text/40">
                    {t(group.labelKey)}
                  </div>
                )}

                {/* Nav items */}
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/' && pathname.startsWith(item.href))

                  const label = t(item.labelKey)

                  const linkContent = (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                        'hover:bg-ctr-primary/15',
                        isActive && 'bg-ctr-primary/10',
                        collapsed && 'justify-center px-0',
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </Link>
                  )

                  if (collapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          {label}
                        </TooltipContent>
                      </Tooltip>
                    )
                  }

                  return linkContent
                })}
              </div>
            ))}
          </nav>
        </ScrollArea>

        <Separator className="bg-ctr-primary/15" />

        {/* ─── Collapse Toggle ─── */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center justify-center py-2 hover:bg-ctr-primary/15"
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        <Separator className="bg-ctr-primary/15" />

        {/* ─── User Profile Section ─── */}
        <div
          className={cn(
            'flex items-center gap-3 px-3 py-3',
            collapsed && 'flex-col gap-1 px-1',
          )}
        >
          <Avatar className="h-8 w-8 shrink-0 border border-ctr-primary/20">
            <AvatarFallback className="bg-ctr-primary/15 text-xs text-ctr-primary">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user.name}</p>
              <p className="truncate text-[10px] text-ctr-sidebar-text/50">{user.role}</p>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onSignOut}
                className="shrink-0 rounded p-1 hover:bg-ctr-primary/15"
                aria-label={tAuth('logout')}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {tAuth('logout')}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}
