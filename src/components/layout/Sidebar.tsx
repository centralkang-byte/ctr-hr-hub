'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Sidebar Navigation
// bg-ctr-primary, 모듈별 그룹핑, 권한 필터링
// ═══════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  Gauge,
  ToggleLeft,
  Download,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { ko } from '@/lib/i18n/ko'
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
  label: string
  href: string
  icon: LucideIcon
}

interface NavGroup {
  label: string
  icon: LucideIcon
  module: string
  items: NavItem[]
}

interface SidebarProps {
  user: SessionUser
  onSignOut: () => void
}

// ─── Navigation Configuration ───────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    label: '인사관리',
    icon: Users,
    module: MODULE.EMPLOYEES,
    items: [
      { label: '사원목록', href: '/employees', icon: Users },
      { label: '내 프로필', href: '/employees/me', icon: UserCircle },
      { label: '조직도', href: '/org', icon: Network },
      { label: '직급/직책', href: '/org/grades', icon: Shield },
    ],
  },
  {
    label: '근태관리',
    icon: Clock,
    module: MODULE.ATTENDANCE,
    items: [
      { label: '내 근태', href: '/attendance', icon: Clock },
      { label: '팀 근태', href: '/attendance/team', icon: Users },
      { label: '전체 근태', href: '/attendance/admin', icon: BarChart3 },
    ],
  },
  {
    label: '휴가관리',
    icon: CalendarDays,
    module: MODULE.LEAVE,
    items: [
      { label: '내 휴가', href: '/leave', icon: CalendarDays },
      { label: '팀 휴가', href: '/leave/team', icon: Users },
      { label: '휴가 관리', href: '/leave/admin', icon: BarChart3 },
    ],
  },
  {
    label: '성과관리',
    icon: Target,
    module: MODULE.PERFORMANCE,
    items: [
      { label: '성과 대시보드', href: '/performance', icon: Target },
      { label: '목표관리', href: '/performance/goals', icon: ClipboardCheck },
      { label: '팀 목표', href: '/performance/team-goals', icon: Users },
      { label: '성과 결과', href: '/performance/results', icon: BarChart3 },
      { label: '1:1 미팅', href: '/performance/one-on-one', icon: Handshake },
      { label: '역량평가', href: '/performance/competency', icon: BarChart3 },
    ],
  },
  {
    label: '연봉/보상',
    icon: Banknote,
    module: MODULE.COMPENSATION,
    items: [
      { label: '연봉 조정', href: '/compensation', icon: Banknote },
    ],
  },
  {
    label: '분석',
    icon: BarChart3,
    module: MODULE.ANALYTICS,
    items: [
      { label: '전사 개요', href: '/analytics', icon: LayoutDashboard },
      { label: '인력 분석', href: '/analytics/workforce', icon: Users },
      { label: '이직 분석', href: '/analytics/turnover', icon: TrendingDown },
      { label: '성과 분석', href: '/analytics/performance', icon: Target },
      { label: '근태 분석', href: '/analytics/attendance', icon: Clock },
      { label: '채용 분석', href: '/analytics/recruitment', icon: Briefcase },
      { label: '보상 분석', href: '/analytics/compensation', icon: Banknote },
      { label: '팀 건강', href: '/analytics/team-health', icon: Heart },
      { label: '이탈 위험', href: '/analytics/attrition', icon: AlertTriangle },
      { label: 'AI 보고서', href: '/analytics/report', icon: Sparkles },
    ],
  },
  {
    label: '급여관리',
    icon: Wallet,
    module: MODULE.PAYROLL,
    items: [
      { label: '급여 정산', href: '/payroll', icon: Wallet },
      { label: '내 급여명세서', href: '/payroll/me', icon: FileText },
    ],
  },
  {
    label: '채용관리',
    icon: UserPlus,
    module: MODULE.RECRUITMENT,
    items: [
      { label: '채용공고', href: '/recruitment', icon: UserPlus },
      { label: '채용 대시보드', href: '/recruitment/dashboard', icon: BarChart3 },
    ],
  },
  {
    label: '징계·포상',
    icon: Gavel,
    module: MODULE.DISCIPLINE,
    items: [
      { label: '징계관리', href: '/discipline', icon: Gavel },
      { label: '포상관리', href: '/discipline/rewards', icon: Award },
    ],
  },
  {
    label: '온보딩',
    icon: UserCheck,
    module: MODULE.ONBOARDING,
    items: [
      { label: '온보딩 대시보드', href: '/onboarding', icon: UserCheck },
      { label: '내 온보딩', href: '/onboarding/me', icon: UserCircle },
      { label: '체크인', href: '/onboarding/checkin', icon: Smile },
      { label: '체크인 현황', href: '/onboarding/checkins', icon: ListChecks },
    ],
  },
  {
    label: '퇴직관리',
    icon: UserMinus,
    module: MODULE.OFFBOARDING,
    items: [
      { label: '퇴직 대시보드', href: '/offboarding', icon: UserMinus },
    ],
  },
  {
    label: '교육관리',
    icon: GraduationCap,
    module: MODULE.TRAINING,
    items: [
      { label: '교육과정', href: '/training', icon: GraduationCap },
      { label: '수강현황', href: '/training/enrollments', icon: ListChecks },
    ],
  },
  {
    label: '복리후생',
    icon: Gift,
    module: MODULE.BENEFITS,
    items: [
      { label: '복리후생정책', href: '/benefits', icon: Gift },
      { label: '신청현황', href: '/benefits/enrollments', icon: ListChecks },
    ],
  },
  {
    label: '후계자 관리',
    icon: Crown,
    module: MODULE.SUCCESSION,
    items: [
      { label: '핵심직책', href: '/succession', icon: Crown },
    ],
  },
  {
    label: '칭찬/인정',
    icon: Heart,
    module: MODULE.PERFORMANCE,
    items: [
      { label: '칭찬보내기', href: '/performance/recognition', icon: Heart },
      { label: '칭찬현황', href: '/performance/recognition/list', icon: ListChecks },
    ],
  },
  {
    label: '시스템설정',
    icon: Settings,
    module: MODULE.SETTINGS,
    items: [
      { label: '회사설정', href: '/settings', icon: Settings },
      { label: '권한관리', href: '/settings/roles', icon: Shield },
      { label: '근무스케줄', href: '/settings/work-schedules', icon: CalendarClock },
      { label: '공휴일', href: '/settings/holidays', icon: CalendarCheck },
      { label: '단말기', href: '/settings/terminals', icon: Monitor },
      { label: '휴가정책', href: '/settings/leave-policies', icon: CalendarDays },
      { label: '교대근무', href: '/settings/shift-roster', icon: Clock },
      { label: '온보딩 설정', href: '/settings/onboarding', icon: UserCheck },
      { label: '퇴직 체크리스트', href: '/settings/offboarding', icon: UserMinus },
      { label: '정보변경 요청', href: '/settings/profile-requests', icon: ClipboardCheck },
      { label: '평가 사이클', href: '/settings/performance-cycles', icon: Target },
      { label: '역량 라이브러리', href: '/settings/competencies', icon: Target },
      { label: '급여 밴드', href: '/settings/salary-bands', icon: Banknote },
      { label: '인상 매트릭스', href: '/settings/salary-matrix', icon: Banknote },
      { label: '알림 설정', href: '/settings/notifications', icon: Bell },
      { label: '브랜딩', href: '/settings/branding', icon: Palette },
      { label: '용어 설정', href: '/settings/terms', icon: Languages },
      { label: 'ENUM 관리', href: '/settings/enums', icon: List },
      { label: '커스텀 필드', href: '/settings/custom-fields', icon: FormInput },
      { label: '워크플로', href: '/settings/workflows', icon: GitBranch },
      { label: '이메일 템플릿', href: '/settings/email-templates', icon: Mail },
      { label: '평가 척도', href: '/settings/evaluation-scale', icon: Gauge },
      { label: '모듈 ON/OFF', href: '/settings/modules', icon: ToggleLeft },
      { label: '내보내기', href: '/settings/export-templates', icon: Download },
      { label: '대시보드 위젯', href: '/settings/dashboard-widgets', icon: LayoutGrid },
      { label: '감사로그', href: '/settings/audit-log', icon: FileText },
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

export function Sidebar({ user, onSignOut }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev)
  }, [])

  const filteredGroups = useMemo(() => {
    return NAV_GROUPS.filter((group) => canAccessModule(user, group.module))
  }, [user])

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
              <p className="truncate text-[10px] text-ctr-sidebar-text/60">{ko.auth.slogan}</p>
            </div>
          )}
        </div>

        <Separator className="bg-ctr-primary/15" />

        {/* ─── Navigation ─── */}
        <ScrollArea className="flex-1 py-2">
          <nav className="space-y-1 px-2">
            {filteredGroups.map((group) => (
              <div key={group.label} className="mb-3">
                {/* Group label */}
                {!collapsed && (
                  <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-ctr-sidebar-text/40">
                    {group.label}
                  </div>
                )}

                {/* Nav items */}
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/' && pathname.startsWith(item.href))

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
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  )

                  if (collapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          {item.label}
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
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
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
                aria-label={ko.auth.logout}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {ko.auth.logout}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}
