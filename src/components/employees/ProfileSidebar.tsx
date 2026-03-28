'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Profile Sidebar (P04)
// 구성원 상세 좌측 프로필 영역
// ═══════════════════════════════════════════════════════════

import { Mail, Phone, Calendar, MapPin, Shield, AlertCircle } from 'lucide-react'
import { EmployeeCell } from '@/components/common/EmployeeCell'

// ─── Types ──────────────────────────────────────────────────

interface ProfileSidebarProps {
  name: string
  nameEn: string | null
  photoUrl: string | null
  title: string | null        // 호칭 (EmployeeTitle.name) — Tier 1
  position: string | null     // 직위 (Position.titleKo) — Tier 1
  company: string | null
  division: string | null     // 본부 (level-2 dept ancestor)
  team: string | null         // 팀명 (direct dept)
  locationName: string | null
  email: string
  phone: string | null
  birthDate: Date | string | null
  hireDate: Date | string | null
  tenureText: string
  status: string
  statusLabel: string
  // Tier 2 — 본인 + HR_ADMIN/SUPER_ADMIN + 직속 상사
  canViewGrade: boolean
  grade: string | null
  canViewSensitive: boolean
  emergencyContact: string | null
  emergencyContactPhone: string | null
  manager: {
    id: string
    name: string
    photoUrl: string | null
    title: string | null
    department: string | null
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

const STATUS_RING: Record<string, string> = {
  ACTIVE: 'ring-2 ring-green-500',
  ON_LEAVE: 'ring-2 ring-orange-400',
  RESIGNED: 'ring-2 ring-gray-400',
  TERMINATED: '',
}

// ─── Component ──────────────────────────────────────────────

export function ProfileSidebar({
  name,
  nameEn,
  photoUrl,
  title,
  position,
  company,
  division,
  team,
  locationName,
  email,
  phone,
  birthDate,
  hireDate,
  tenureText,
  status,
  statusLabel,
  canViewGrade,
  grade,
  canViewSensitive,
  emergencyContact,
  emergencyContactPhone,
  manager,
  onManagerClick,
}: ProfileSidebarProps) {
  const ringClass = STATUS_RING[status] ?? ''
  const subtitle = [title, position].filter(Boolean).join(' · ')

  return (
    <aside className="w-72 shrink-0 border-r border-[#E8E8E8] bg-white p-6 hidden lg:block">
      {/* Avatar + Name */}
      <div className="text-center mb-6">
        <div
          className={`relative inline-block rounded-full ${ringClass} ring-offset-2 mb-3`}
          title={statusLabel}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="w-[72px] h-[72px] rounded-full object-cover"
            />
          ) : (
            <div className="w-[72px] h-[72px] rounded-full bg-ctr-primary-light flex items-center justify-center text-xl font-semibold text-ctr-primary">
              {getInitials(name)}
            </div>
          )}
        </div>
        <h2 className="text-lg font-bold text-[#1A1A1A] tracking-ctr">{name}</h2>
        {nameEn && <p className="text-xs text-[#999] mt-0.5">{nameEn}</p>}
        {subtitle && <p className="text-sm text-[#666] mt-1">{subtitle}</p>}
      </div>

      <div className="divide-y divide-[#F0F0F0]">
        {/* 조직 정보 */}
        {(company || division || team || locationName) && (
          <div className="py-4 space-y-1.5 text-sm">
            {company && <p className="font-medium text-[#1A1A1A]">{company}</p>}
            {(division || team) && (
              <p className="text-[#555]">
                {[division, team].filter(Boolean).join(' / ')}
              </p>
            )}
            {locationName && (
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-[#999] shrink-0" strokeWidth={1.5} />
                <span className="text-[#555]">{locationName}</span>
              </div>
            )}
          </div>
        )}

        {/* 연락처 + 기본 정보 */}
        <div className="py-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <Mail size={15} className="text-[#999] shrink-0" strokeWidth={1.5} />
            <span className="text-sm text-[#333] truncate">{email}</span>
          </div>
          {phone && (
            <div className="flex items-center gap-2">
              <Phone size={15} className="text-[#999] shrink-0" strokeWidth={1.5} />
              <span className="text-sm text-[#333]">{phone}</span>
            </div>
          )}
          {birthDate && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-[#999] w-14 shrink-0 pt-0.5">생년월일</span>
              <span className="text-sm text-[#333]">{formatDate(birthDate)}</span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Calendar size={15} className="text-[#999] shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <span className="text-sm text-[#333]">{formatDate(hireDate)} 입사</span>
              <span className="text-xs text-[#999] ml-1">· {tenureText}</span>
            </div>
          </div>
        </div>

        {/* Tier 2: 직급 + 비상연락처 */}
        {(canViewGrade && grade) || (canViewSensitive && (emergencyContact || emergencyContactPhone)) ? (
          <div className="py-4 space-y-2.5">
            {canViewGrade && grade && (
              <div className="flex items-center gap-2">
                <Shield size={15} className="text-[#999] shrink-0" strokeWidth={1.5} />
                <span className="text-xs text-[#999]">직급</span>
                <span className="text-sm text-[#333] font-medium">{grade}</span>
              </div>
            )}
            {canViewSensitive && (emergencyContact || emergencyContactPhone) && (
              <div className="flex items-start gap-2">
                <AlertCircle size={15} className="text-[#999] shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-xs text-[#999] mb-0.5">비상연락처</p>
                  {emergencyContact && <p className="text-sm text-[#333]">{emergencyContact}</p>}
                  {emergencyContactPhone && <p className="text-sm text-[#333]">{emergencyContactPhone}</p>}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* 직속 상사 */}
        {manager && (
          <div className="py-4">
            <p className="text-xs text-[#999] mb-2">직속 상사</p>
            <EmployeeCell
              name={manager.name}
              photoUrl={manager.photoUrl}
              department={manager.department}
              jobTitle={manager.title}
              size="sm"
              onClick={() => onManagerClick?.(manager.id)}
            />
          </div>
        )}
      </div>
    </aside>
  )
}
