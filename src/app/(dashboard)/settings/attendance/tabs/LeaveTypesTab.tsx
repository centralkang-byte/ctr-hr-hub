'use client'

// ═══════════════════════════════════════════════════════════
// Tab 2: Leave Types — 휴가 유형 관리 ⭐ Most complex tab
// API: GET /api/v1/leave/type-defs (existing)
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Loader2, Plus, Briefcase, X } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface LeaveTypeDef {
  id: string
  companyId: string | null
  code: string
  name: string
  nameEn: string | null
  isPaid: boolean
  allowHalfDay: boolean
  requiresProof: boolean
  maxConsecutiveDays: number | null
  minAdvanceDays: number | null
  isActive: boolean
  displayOrder: number
  _count?: { yearBalances: number }
}

interface LeaveTypesTabProps {
  companyId: string | null
}

export function LeaveTypesTab({
  companyId }: LeaveTypesTabProps) {
  const t = useTranslations('settings')
  const [typeDefs, setTypeDefs] = useState<LeaveTypeDef[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<LeaveTypeDef | null>(null)

  useEffect(() => {
    setLoading(true)
    const params = companyId ? `?companyId=${companyId}` : ''
    apiClient.get<LeaveTypeDef[]>(`/api/v1/leave/type-defs${params}`)
      .then((res) => {
        const data = res.data
        setTypeDefs(Array.isArray(data) ? data : [])
      })
      .catch(() => setTypeDefs([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" />
      </div>
    )
  }

  // Split by global (companyId = null) vs company-specific
  const globalTypes = typeDefs.filter((t) => !t.companyId)
  const companyTypes = typeDefs.filter((t) => t.companyId)

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">{'휴가 유형'}</h3>
          <p className="text-sm text-[#8181A5]">
            글로벌 표준 유형 {globalTypes.length}개{companyTypes.length > 0 ? ` + 법인 커스텀 ${companyTypes.length}개` : ''}
          </p>
        </div>
        <Button className={BUTTON_VARIANTS.primary}>
          <Plus className="mr-2 h-4 w-4" />
          {'유형 추가'}
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
        <table className="w-full">
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>{'코멘트'}</th>
              <th className={TABLE_STYLES.headerCell}>{'유형'}</th>
              <th className={TABLE_STYLES.headerCell}>{'유급'}</th>
              <th className={TABLE_STYLES.headerCell}>{'반차'}</th>
              <th className={TABLE_STYLES.headerCell}>{'증빙'}</th>
              <th className={TABLE_STYLES.headerCell}>{'최대 연속일'}</th>
              <th className={TABLE_STYLES.headerCell}>{'사전 신청'}</th>
              <th className={TABLE_STYLES.headerCell}>{'범위'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F3]">
            {typeDefs.map((type) => (
              <tr
                key={type.id}
                onClick={() => setSelectedType(type)}
                className={TABLE_STYLES.rowClickable}
              >
                <td className="px-4 py-3 text-sm font-mono text-[#5E81F4]">{type.code}</td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-[#1C1D21]">{type.name}</div>
                  {type.nameEn && <div className="text-xs text-[#8181A5]">{type.nameEn}</div>}
                </td>
                <td className="px-4 py-3 text-center">
                  <BoolBadge value={type.isPaid} trueLabel="유급" falseLabel="무급" />
                </td>
                <td className="px-4 py-3 text-center">
                  <BoolBadge value={type.allowHalfDay} />
                </td>
                <td className="px-4 py-3 text-center">
                  <BoolBadge value={type.requiresProof} trueLabel="필수" falseLabel="불필요" />
                </td>
                <td className="px-4 py-3 text-center text-sm text-[#1C1D21]">
                  {type.maxConsecutiveDays ? `${type.maxConsecutiveDays}일` : '—'}
                </td>
                <td className="px-4 py-3 text-center text-sm text-[#1C1D21]">
                  {type.minAdvanceDays ? `${type.minAdvanceDays}일 전` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    !type.companyId
                      ? 'bg-primary/5 text-primary'
                      : 'bg-orange-50 text-orange-600'
                  }`}>
                    {!type.companyId ? '글로벌' : '법인'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {typeDefs.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#F0F0F3] py-12 text-center">
          <Briefcase className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" />
          <p className="text-sm font-medium text-[#1C1D21]">{'등록된 휴가 유형이 없습니다'}</p>
          <p className="mt-1 text-xs text-[#8181A5]">
            {'시드 데이터를 실행하거나 유형을 직접 추가하세요'}
          </p>
        </div>
      )}

      {/* Detail side panel */}
      {selectedType && (
        <LeaveTypeDetailPanel type={selectedType} onClose={() => setSelectedType(null)} />
      )}
    </div>
  )
}

// ─── Helper: Bool Badge ──────────────────────────────────

function BoolBadge({
  value,
  trueLabel = 'O',
  falseLabel = 'X',
}: {
  value: boolean
  trueLabel?: string
  falseLabel?: string
}) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
      value ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
    }`}>
      {value ? trueLabel : falseLabel}
    </span>
  )
}

// ─── Detail Panel ────────────────────────────────────────

function LeaveTypeDetailPanel({
  type,
  onClose,
}: {
  type: LeaveTypeDef
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white p-6 shadow-xl animate-in slide-in-from-right duration-200">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#1C1D21]">{'휴가 유형 상세'}</h3>
          <button type="button" onClick={onClose} className="text-[#8181A5] hover:text-[#1C1D21]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <DetailRow label="코드" value={type.code} />
          <DetailRow label="유형명" value={type.name} />
          {type.nameEn && <DetailRow label="영문명" value={type.nameEn} />}
          <DetailRow label="유급/무급" value={type.isPaid ? '유급' : '무급'} />
          <DetailRow label="반차 허용" value={type.allowHalfDay ? '허용' : '불허'} />
          <DetailRow label="증빙 필수" value={type.requiresProof ? '필수' : '불필요'} />
          <DetailRow label="최대 연속일" value={type.maxConsecutiveDays ? `${type.maxConsecutiveDays}일` : '제한 없음'} />
          <DetailRow label="최소 사전 신청" value={type.minAdvanceDays ? `${type.minAdvanceDays}일 전` : '당일 가능'} />
          <DetailRow label="범위" value={!type.companyId ? '글로벌' : '법인 커스텀'} />
          <DetailRow label="표시 순서" value={String(type.displayOrder)} />
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#F0F0F3] px-4 py-3">
      <span className="text-sm text-[#8181A5]">{label}</span>
      <span className="text-sm font-medium text-[#1C1D21]">{value}</span>
    </div>
  )
}
