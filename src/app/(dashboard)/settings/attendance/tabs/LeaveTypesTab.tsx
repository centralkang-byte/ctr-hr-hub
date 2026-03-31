'use client'

// ═══════════════════════════════════════════════════════════
// Tab 2: Leave Types — 휴가 유형 관리 ⭐ Most complex tab
// API: GET /api/v1/leave/type-defs (existing)
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Loader2, Plus, Briefcase, X } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
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
  // Phase 1-2 규정 필드
  category: string | null
  subcategory: string | null
  countingMethod: string
  includesHolidays: boolean
  isSplittable: boolean
  splitDeadlineDays: number | null
  maxPerYear: number | null
  paidDaysPerYear: number | null
  condolenceAmount: number | null
  _count?: { yearBalances: number }
}

// 카테고리 한글 레이블
const CATEGORY_LABELS: Record<string, string> = {
  annual: '연차',
  family_event: '경조',
  maternity: '출산/육아',
  health: '건강',
  military: '병역',
  other: '기타',
}

const COUNTING_METHOD_LABELS: Record<string, string> = {
  business_day: '영업일',
  calendar_day: '역일',
}

const SUBCATEGORY_LABELS: Record<string, string> = {
  celebration: '경사',
  condolence: '조사',
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
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
          <h3 className="text-base font-semibold text-foreground">{'휴가 유형'}</h3>
          <p className="text-sm text-muted-foreground">
            글로벌 표준 유형 {globalTypes.length}개{companyTypes.length > 0 ? ` + 법인 커스텀 ${companyTypes.length}개` : ''}
          </p>
        </div>
        <Button className={BUTTON_VARIANTS.primary}>
          <Plus className="mr-2 h-4 w-4" />
          {'유형 추가'}
        </Button>
      </div>

      {/* Table */}
      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>{'코드'}</th>
              <th className={TABLE_STYLES.headerCell}>{'유형'}</th>
              <th className={TABLE_STYLES.headerCell}>{'카테고리'}</th>
              <th className={TABLE_STYLES.headerCell}>{'일수 산정'}</th>
              <th className={TABLE_STYLES.headerCell}>{'유급'}</th>
              <th className={TABLE_STYLES.headerCell}>{'반차'}</th>
              <th className={TABLE_STYLES.headerCell}>{'최대 연속일'}</th>
              <th className={TABLE_STYLES.headerCell}>{'범위'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {typeDefs.map((type) => (
              <tr
                key={type.id}
                onClick={() => setSelectedType(type)}
                className={TABLE_STYLES.rowClickable}
              >
                <td className="px-4 py-3 text-sm font-mono tabular-nums text-primary">{type.code}</td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-foreground">{type.name}</div>
                  {type.nameEn && <div className="text-xs text-muted-foreground">{type.nameEn}</div>}
                </td>
                <td className="px-4 py-3 text-center">
                  {type.category ? (
                    <span className="inline-flex rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-700">
                      {CATEGORY_LABELS[type.category] ?? type.category}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-center text-sm text-foreground">
                  {COUNTING_METHOD_LABELS[type.countingMethod] ?? type.countingMethod}
                </td>
                <td className="px-4 py-3 text-center">
                  <BoolBadge value={type.isPaid} trueLabel="유급" falseLabel="무급" />
                </td>
                <td className="px-4 py-3 text-center">
                  <BoolBadge value={type.allowHalfDay} />
                </td>
                <td className="px-4 py-3 text-center text-sm text-foreground">
                  {type.maxConsecutiveDays ? `${type.maxConsecutiveDays}일` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    !type.companyId
                      ? 'bg-primary/5 text-primary'
                      : 'bg-orange-500/10 text-orange-600'
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
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{'등록된 휴가 유형이 없습니다'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
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
      value ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'
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
      <div className="relative w-full max-w-md bg-card p-6 shadow-lg animate-in slide-in-from-right duration-200">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{'휴가 유형 상세'}</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 기본 정보 */}
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

          {/* 규정 상세 */}
          <div className="border-t border-border pt-4">
            <h4 className="mb-3 text-sm font-semibold text-foreground">{'규정 상세'}</h4>
            <div className="space-y-3">
              <DetailRow
                label="카테고리"
                value={type.category ? (CATEGORY_LABELS[type.category] ?? type.category) : '미지정'}
              />
              {type.subcategory && (
                <DetailRow
                  label="세부분류"
                  value={SUBCATEGORY_LABELS[type.subcategory] ?? type.subcategory}
                />
              )}
              <DetailRow
                label="일수 산정"
                value={COUNTING_METHOD_LABELS[type.countingMethod] ?? type.countingMethod}
              />
              <DetailRow
                label="공휴일 포함"
                value={type.includesHolidays ? '포함 (통산)' : '미포함'}
              />
              <DetailRow
                label="분할 사용"
                value={type.isSplittable ? '가능' : '불가'}
              />
              {type.splitDeadlineDays != null && (
                <DetailRow label="분할 사용 기한" value={`${type.splitDeadlineDays}일 이내`} />
              )}
              {type.maxPerYear != null && (
                <DetailRow label="연간 최대 횟수" value={`${type.maxPerYear}회`} />
              )}
              {type.paidDaysPerYear != null && (
                <DetailRow label="유급 일수" value={`${type.paidDaysPerYear}일`} />
              )}
              {type.condolenceAmount != null && (
                <DetailRow
                  label="경조금"
                  value={`${type.condolenceAmount.toLocaleString()}원`}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}
