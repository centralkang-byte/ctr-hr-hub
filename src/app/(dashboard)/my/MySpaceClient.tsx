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

// ─── Quick Links ────────────────────────────────────────────

const QUICK_LINKS = [
  { label: '내 프로필', href: '/my/profile', icon: User, color: 'bg-[#EEF2FF] text-[#4338CA]' },
  { label: '휴가 신청', href: '/my/leave', icon: CalendarDays, color: 'bg-[#E0E7FF] text-[#4338CA]' },
  { label: '내 성과', href: '/performance', icon: Target, color: 'bg-[#FEF3C7] text-[#B45309]' },
  { label: '교육 신청', href: '/my/training', icon: BookOpen, color: 'bg-[#FEE2E2] text-[#B91C1C]' },
  { label: '사내 공고', href: '/my/internal-jobs', icon: Briefcase, color: 'bg-[#F0FDF4] text-[#16A34A]' },
  { label: '연말 정산', href: '/my/year-end', icon: FileText, color: 'bg-[#F5F3FF] text-[#7C3AED]' },
]

// ─── Main Component ─────────────────────────────────────────

export function MySpaceClient({ employee, leaveBalances, pendingChangeRequests }: MySpaceClientProps) {
  const asgn = employee.assignments[0]
  const annualLeave = leaveBalances.find((l) => l.policy.leaveType === 'ANNUAL')

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">나의 공간</h1>
        <p className="text-sm text-[#666] mt-1">안녕하세요, {employee.name}님!</p>
      </div>

      {/* Profile Summary */}
      <div className={`${CARD_STYLES.kpi} flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#4F46E5] flex items-center justify-center text-white text-xl font-bold">
            {employee.name.slice(0, 1)}
          </div>
          <div>
            <p className="text-lg font-bold text-[#1A1A1A]">{employee.name}</p>
            <p className="text-sm text-[#666]">{asgn?.department?.name ?? '-'} · {asgn?.jobGrade?.name ?? '-'}</p>
            <p className="text-xs text-[#999] mt-0.5">{asgn?.company?.name ?? '-'} · 재직 {getYearsOfService(employee.hireDate)}</p>
          </div>
        </div>
        <Link
          href="/my/profile"
          className="flex items-center gap-1 text-sm text-[#4F46E5] hover:underline"
        >
          프로필 편집 <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-[#666] mb-1">연차 잔여</p>
          <p className="text-2xl font-bold text-[#1A1A1A]">
            {annualLeave ? (Number(annualLeave.grantedDays) - Number(annualLeave.usedDays)).toFixed(1) : '-'}
          </p>
          <p className="text-xs text-[#999] mt-1">일</p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-[#666] mb-1">사용 연차</p>
          <p className="text-2xl font-bold text-[#1A1A1A]">
            {annualLeave ? Number(annualLeave.usedDays).toFixed(1) : '-'}
          </p>
          <p className="text-xs text-[#999] mt-1">일</p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-[#666] mb-1">대기 중 변경 요청</p>
          <p className="text-2xl font-bold text-[#1A1A1A]">{pendingChangeRequests}</p>
          <p className="text-xs text-[#999] mt-1">건</p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-[#666] mb-1">재직 기간</p>
          <p className="text-lg font-bold text-[#1A1A1A]">{getYearsOfService(employee.hireDate)}</p>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-base font-semibold text-[#1A1A1A] mb-3">바로가기</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${CARD_STYLES.kpi} flex items-center gap-3 hover:border-[#4F46E5] hover:shadow-sm transition-all`}
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
              <Clock className="w-4 h-4 text-[#4F46E5]" />
              <h2 className="text-base font-semibold text-[#1A1A1A]">휴가 잔여 현황</h2>
            </div>
            <Link href="/my/leave" className="text-sm text-[#4F46E5] hover:underline">자세히</Link>
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
                    <div className="h-full bg-[#4F46E5] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-sm text-[#555] w-16 text-right shrink-0">
                    {remaining.toFixed(1)} / {granted.toFixed(1)}일
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
          <Bell className="w-4 h-4 text-[#4F46E5]" />
          <h2 className="text-base font-semibold text-[#1A1A1A]">최근 알림</h2>
        </div>
        <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />
      </div>
    </div>
  )
}
