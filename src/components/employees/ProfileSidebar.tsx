'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Profile Sidebar (P04)
// 구성원 상세 좌측 프로필 영역
// ═══════════════════════════════════════════════════════════

import Image from 'next/image'
import { Mail, Phone, Calendar, MapPin, Shield, AlertCircle } from 'lucide-react'
import { EmployeeCell } from '@/components/common/EmployeeCell'
import PayBandChart from '@/components/compensation/PayBandChart'

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
  /** 급여 밴드 데이터 (Tier 2 — canViewGrade 게이트) */
  compensationData?: {
    currentSalary: number
    bandMin: number
    bandMid: number
    bandMax: number
  } | null
  /** compensation 데이터 로딩 중 여부 (CLS 방어용 skeleton) */
  compensationLoading?: boolean
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
  compensationData,
  compensationLoading,
}: ProfileSidebarProps) {
  const ringClass = STATUS_RING[status] ?? ''
  const subtitle = [title, position].filter(Boolean).join(' · ')

  return (
    <>
    {/* Mobile compact header — visible below lg */}
    <div className="flex items-center gap-3 rounded-2xl bg-card shadow-sm p-4 lg:hidden">
      <div className={`relative shrink-0 rounded-full ${ringClass} ring-offset-2`} title={statusLabel}>
        {photoUrl ? (
          <Image src={photoUrl} alt={name} width={40} height={40} unoptimized className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-ctr-primary-light flex items-center justify-center text-sm font-semibold text-ctr-primary">
            {getInitials(name)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground truncate">{name}</p>
        {subtitle && <p className="text-xs text-primary truncate">{subtitle}</p>}
        <p className="text-xs text-muted-foreground truncate">{[company, team].filter(Boolean).join(' · ')}</p>
      </div>
    </div>

    <aside className="w-72 shrink-0 border-r border-border bg-card p-6 hidden lg:block">
      {/* Avatar + Name */}
      <div className="text-center mb-6">
        <div
          className={`relative inline-block rounded-full ${ringClass} ring-offset-2 mb-3`}
          title={statusLabel}
        >
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={name}
              width={72}
              height={72}
              unoptimized
              className="w-[72px] h-[72px] rounded-full object-cover"
            />
          ) : (
            <div className="w-[72px] h-[72px] rounded-full bg-ctr-primary-light flex items-center justify-center text-xl font-semibold text-ctr-primary">
              {getInitials(name)}
            </div>
          )}
        </div>
        <h2 className="text-lg font-bold text-foreground tracking-ctr">{name}</h2>
        {nameEn && <p className="text-xs text-[#999] mt-0.5">{nameEn}</p>}
        {subtitle && <p className="text-sm text-[#666] mt-1">{subtitle}</p>}
      </div>

      <div className="divide-y divide-border">
        {/* 조직 정보 */}
        {(company || division || team || locationName) && (
          <div className="py-4 space-y-1.5 text-sm">
            {company && <p className="font-medium text-foreground">{company}</p>}
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
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield size={15} className="text-[#999] shrink-0" strokeWidth={1.5} />
                  <span className="text-xs text-[#999]">직급</span>
                  <span className="text-sm text-[#333] font-medium">{grade}</span>
                </div>
                {/* 급여 밴드 compact — CLS 방어: skeleton → chart */}
                {compensationLoading && (
                  <div className="h-2 bg-muted rounded-full animate-pulse" />
                )}
                {!compensationLoading && compensationData && (
                  <PayBandChart
                    compact
                    currentSalary={compensationData.currentSalary}
                    minSalary={compensationData.bandMin}
                    midSalary={compensationData.bandMid}
                    maxSalary={compensationData.bandMax}
                  />
                )}
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
    </>
  )
}
