'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Profile Sidebar (P04)
// 구성원 상세 좌측 프로필 영역
// ═══════════════════════════════════════════════════════════

import { Mail, Phone, Calendar, Building2 } from 'lucide-react'
import { EmployeeCell } from '@/components/common/EmployeeCell'

// ─── Types ──────────────────────────────────────────────────

interface ProfileSidebarProps {
  name: string
  nameEn: string | null
  photoUrl: string | null
  department: string | null
  jobGrade: string | null
  email: string
  phone: string | null
  hireDate: Date | string | null
  status: string
  statusLabel: string
  tenureText: string
  company: string | null
  manager: {
    id: string
    name: string
    photoUrl: string | null
    department: string | null
    jobGrade: string | null
  } | null
  onManagerClick?: (id: string) => void
}

// ─── Helpers ────────────────────────────────────────────────

function formatDate(d: Date | string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR')
}

function getInitials(name: string): string {
  return name.slice(0, 2)
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-[#EDF1FE] text-[#2E7D32]',
  ON_LEAVE: 'bg-[#FFF3E0] text-[#E65100]',
  RESIGNED: 'bg-[#F5F5F5] text-[#666]',
  TERMINATED: 'bg-[#FFEBEE] text-[#C62828]',
}

// ─── Component ──────────────────────────────────────────────

export function ProfileSidebar({
  name,
  nameEn,
  photoUrl,
  department,
  jobGrade,
  email,
  phone,
  hireDate,
  status,
  statusLabel,
  tenureText,
  company,
  manager,
  onManagerClick,
}: ProfileSidebarProps) {
  return (
    <aside className="w-72 shrink-0 border-r border-[#E8E8E8] bg-white p-6 hidden lg:block">
      {/* Avatar + Name */}
      <div className="text-center mb-6">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            className="w-[72px] h-[72px] rounded-full object-cover mx-auto mb-3"
          />
        ) : (
          <div className="w-[72px] h-[72px] rounded-full bg-ctr-primary-light flex items-center justify-center mx-auto mb-3 text-xl font-semibold text-ctr-primary">
            {getInitials(name)}
          </div>
        )}
        <h2 className="text-lg font-bold text-[#1A1A1A] tracking-ctr">{name}</h2>
        {nameEn && <p className="text-xs text-[#999] mt-0.5">{nameEn}</p>}
        <p className="text-sm text-[#999] mt-0.5">
          {department ?? '-'}{jobGrade ? ` · ${jobGrade}` : ''}
        </p>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 mt-2 rounded-[4px] text-xs font-semibold ${STATUS_STYLES[status] ?? 'bg-[#F5F5F5] text-[#666]'}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Contact Info */}
      <div className="divide-y divide-[#F0F0F0]">
        <div className="py-4 space-y-3">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-[#999]" strokeWidth={1.5} />
            <span className="text-sm text-[#333] truncate">{email}</span>
          </div>
          {phone && (
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-[#999]" strokeWidth={1.5} />
              <span className="text-sm text-[#333]">{phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[#999]" strokeWidth={1.5} />
            <span className="text-sm text-[#333]">{formatDate(hireDate)} 입사</span>
          </div>
          {company && (
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-[#999]" strokeWidth={1.5} />
              <span className="text-sm text-[#333]">{company}</span>
            </div>
          )}
        </div>

        {/* Tenure */}
        <div className="py-4 space-y-3">
          <div>
            <p className="text-xs text-[#999] mb-1">근속기간</p>
            <p className="text-sm font-semibold text-[#1A1A1A]">{tenureText}</p>
          </div>
        </div>

        {/* Manager */}
        {manager && (
          <div className="py-4">
            <p className="text-xs text-[#999] mb-2">직속 상사</p>
            <EmployeeCell
              name={manager.name}
              photoUrl={manager.photoUrl}
              department={manager.department}
              jobGrade={manager.jobGrade}
              size="sm"
              onClick={() => onManagerClick?.(manager.id)}
            />
          </div>
        )}
      </div>
    </aside>
  )
}
