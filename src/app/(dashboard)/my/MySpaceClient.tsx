'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import Link from 'next/link'
import {
  User, CalendarDays, BookOpen, Briefcase, Bell, Clock,
  ChevronRight, Target, FileText
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { CARD_STYLES } from '@/lib/styles'
import { EmployeeCell } from '@/components/common/EmployeeCell'
import { extractPrimaryAssignment } from '@/lib/employee/extract-primary-assignment'

// ─── Types ──────────────────────────────────────────────────

interface Assignment {
  department: { name: string } | null
  jobGrade: { name: string; code: string } | null
  company: { name: string; code: string } | null
}

interface EmployeeData {
  id: string
  name: string
  employeeNo: string
  hireDate: Date
  assignments: Assignment[]
}

interface LeaveBalance {
  id: string
  grantedDays: unknown
  usedDays: unknown
  policy: { name: string; leaveType: string }
}

interface MySpaceClientProps {
  user: SessionUser
  employee: EmployeeData
  leaveBalances: LeaveBalance[]
  pendingChangeRequests: number
}

// ─── Helpers ────────────────────────────────────────────────

function getYearsOfService(hireDate: Date): string {
  const now = new Date()
  const hire = new Date(hireDate)
  const years = now.getFullYear() - hire.getFullYear()
  const months = now.getMonth() - hire.getMonth()
  const totalMonths = years * 12 + months
  if (totalMonths < 12) return `${totalMonths}개월`
  return `${Math.floor(totalMonths / 12)}년 ${totalMonths % 12}개월`
}

// ─── Quick Links defined inside component to access t() ───

// ─── Main Component ─────────────────────────────────────────

export function MySpaceClient({ employee, leaveBalances, pendingChangeRequests }: MySpaceClientProps) {
  const t = useTranslations('mySpace')
  const asgn = extractPrimaryAssignment(employee.assignments as unknown as Record<string, unknown>[]) as Assignment | undefined
  const annualLeave = leaveBalances.find((l) => l.policy.leaveType === 'ANNUAL')

  const QUICK_LINKS = [
    { label: t('quickLink.myProfile'), href: '/my/profile', icon: User, color: 'bg-[#EDF1FE] text-[#4B6DE0]' },
    { label: t('quickLink.leaveRequest'), href: '/my/leave', icon: CalendarDays, color: 'bg-[#E0E7FF] text-[#4B6DE0]' },
    { label: t('quickLink.myPerformance'), href: '/performance', icon: Target, color: 'bg-[#FEF3C7] text-[#B45309]' },
    { label: t('quickLink.trainingApply'), href: '/my/training', icon: BookOpen, color: 'bg-[#FEE2E2] text-[#B91C1C]' },
    { label: t('quickLink.internalJob'), href: '/my/internal-jobs', icon: Briefcase, color: 'bg-[#F0FDF4] text-[#16A34A]' },
    { label: t('quickLink.yearEnd'), href: '/my/year-end', icon: FileText, color: 'bg-[#F5F3FF] text-[#7C3AED]' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('pageTitle')}</h1>
        <p className="text-sm text-[#666] mt-1">{t('greeting', { name: employee.name })}</p>
      </div>

      {/* Profile Summary */}
      <div className={`${CARD_STYLES.kpi} flex items-center justify-between`}>
        <EmployeeCell
          size="lg"
          employee={{
            id: employee.id,
            name: employee.name,
            department: asgn?.department?.name,
            jobGrade: asgn?.jobGrade?.name,
            companyName: asgn?.company?.name,
          }}
          trailing={
            <>
              <p className="text-xs text-[#999] mt-0.5">{t('yearsOfService', { period: getYearsOfService(employee.hireDate) })}</p>
              <Link
                href="/my/profile"
                className="flex items-center gap-1 text-sm text-[#5E81F4] hover:underline mt-1"
              >
                {t('editProfile')} <ChevronRight className="w-4 h-4" />
              </Link>
            </>
          }
        />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-[#666] mb-1">{t('kpi.leaveRemaining')}</p>
          <p className="text-2xl font-bold text-[#1A1A1A]">
            {annualLeave ? (Number(annualLeave.grantedDays) - Number(annualLeave.usedDays)).toFixed(1) : '-'}
          </p>
          <p className="text-xs text-[#999] mt-1">{t('unitDay')}</p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-[#666] mb-1">{t('kpi.leaveUsed')}</p>
          <p className="text-2xl font-bold text-[#1A1A1A]">
            {annualLeave ? Number(annualLeave.usedDays).toFixed(1) : '-'}
          </p>
          <p className="text-xs text-[#999] mt-1">{t('unitDay')}</p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-[#666] mb-1">{t('kpi.pendingRequests')}</p>
          <p className="text-2xl font-bold text-[#1A1A1A]">{pendingChangeRequests}</p>
          <p className="text-xs text-[#999] mt-1">{t('unitCase')}</p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-[#666] mb-1">{t('kpi.tenure')}</p>
          <p className="text-lg font-bold text-[#1A1A1A]">{getYearsOfService(employee.hireDate)}</p>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-base font-semibold text-[#1A1A1A] mb-3">{t('quickLinksTitle')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${CARD_STYLES.kpi} flex items-center gap-3 hover:border-[#5E81F4] hover:shadow-sm transition-all`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${link.color}`}>
                <link.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-[#1A1A1A]">{link.label}</span>
              <ChevronRight className="w-4 h-4 text-[#999] ml-auto" />
            </Link>
          ))}
        </div>
      </div>

      {/* Leave Balances */}
      {leaveBalances.length > 0 && (
        <div className={CARD_STYLES.padded}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#5E81F4]" />
              <h2 className="text-base font-semibold text-[#1A1A1A]">{t('leaveBalanceTitle')}</h2>
            </div>
            <Link href="/my/leave" className="text-sm text-[#5E81F4] hover:underline">{t('viewDetail')}</Link>
          </div>
          <div className="space-y-2">
            {leaveBalances.slice(0, 5).map((lb) => {
              const granted = Number(lb.grantedDays)
              const used = Number(lb.usedDays)
              const remaining = granted - used
              const pct = granted > 0 ? Math.round((used / granted) * 100) : 0
              return (
                <div key={lb.id} className="flex items-center gap-3">
                  <p className="text-sm text-[#333] w-28 shrink-0">{lb.policy.name}</p>
                  <div className="flex-1 h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                    <div className="h-full bg-[#5E81F4] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-sm text-[#555] w-16 text-right shrink-0">
                    {remaining.toFixed(1)} / {granted.toFixed(1)}{t('unitDay')}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notifications placeholder */}
      <div className={CARD_STYLES.padded}>
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-[#5E81F4]" />
          <h2 className="text-base font-semibold text-[#1A1A1A]">{t('recentNotifications')}</h2>
        </div>
        <EmptyState title={t('emptyTitle')} description={t('emptyDesc')} />
      </div>
    </div>
  )
}
