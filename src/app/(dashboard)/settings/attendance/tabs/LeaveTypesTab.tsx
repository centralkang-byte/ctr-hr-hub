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

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  annual: 'leaveTypes.categories.annual',
  family_event: 'leaveTypes.categories.family_event',
  maternity: 'leaveTypes.categories.maternity',
  health: 'leaveTypes.categories.health',
  military: 'leaveTypes.categories.military',
  other: 'leaveTypes.categories.other',
}

const COUNTING_METHOD_LABEL_KEYS: Record<string, string> = {
  business_day: 'leaveTypes.countingMethods.business_day',
  calendar_day: 'leaveTypes.countingMethods.calendar_day',
}

const SUBCATEGORY_LABEL_KEYS: Record<string, string> = {
  celebration: 'leaveTypes.subcategories.celebration',
  condolence: 'leaveTypes.subcategories.condolence',
}

interface LeaveTypesTabProps {
  companyId: string | null
}

export function LeaveTypesTab({
  companyId }: LeaveTypesTabProps) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
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
  const globalTypes = typeDefs.filter((td) => !td.companyId)
  const companyTypes = typeDefs.filter((td) => td.companyId)

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('leaveTypes.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('leaveTypes.globalCount', { global: globalTypes.length })}{companyTypes.length > 0 ? t('leaveTypes.companyCount', { company: companyTypes.length }) : ''}
          </p>
        </div>
        <Button className={BUTTON_VARIANTS.primary}>
          <Plus className="mr-2 h-4 w-4" />
          {t('leaveTypes.addNew')}
        </Button>
      </div>

      {/* Table */}
      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>{t('leaveTypes.colCode')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('leaveTypes.colType')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('leaveTypes.colCategory')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('leaveTypes.colCountingMethod')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('leaveTypes.colPaid')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('leaveTypes.colHalfDay')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('leaveTypes.colMaxConsecutive')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('leaveTypes.colScope')}</th>
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
                      {t(CATEGORY_LABEL_KEYS[type.category] ?? type.category)}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-center text-sm text-foreground">
                  {t(COUNTING_METHOD_LABEL_KEYS[type.countingMethod] ?? type.countingMethod)}
                </td>
                <td className="px-4 py-3 text-center">
                  <BoolBadge value={type.isPaid} trueLabel={t('leaveTypes.paid')} falseLabel={t('leaveTypes.unpaid')} />
                </td>
                <td className="px-4 py-3 text-center">
                  <BoolBadge value={type.allowHalfDay} />
                </td>
                <td className="px-4 py-3 text-center text-sm text-foreground">
                  {type.maxConsecutiveDays ? t('leaveTypes.daysUnit', { count: type.maxConsecutiveDays }) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    !type.companyId
                      ? 'bg-primary/5 text-primary'
                      : 'bg-orange-500/10 text-orange-600'
                  }`}>
                    {!type.companyId ? tc('global') : tc('company')}
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
          <p className="text-sm font-medium text-foreground">{t('leaveTypes.emptyTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('leaveTypes.emptyDesc')}
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
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card p-6 shadow-lg animate-in slide-in-from-right duration-200">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{t('leaveTypes.detailTitle')}</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <DetailRow label={t('leaveTypes.labelCode')} value={type.code} />
          <DetailRow label={t('leaveTypes.labelTypeName')} value={type.name} />
          {type.nameEn && <DetailRow label={t('leaveTypes.labelNameEn')} value={type.nameEn} />}
          <DetailRow label={t('leaveTypes.labelPaidUnpaid')} value={type.isPaid ? t('leaveTypes.paid') : t('leaveTypes.unpaid')} />
          <DetailRow label={t('leaveTypes.labelHalfDay')} value={type.allowHalfDay ? t('leaveTypes.allowed') : t('leaveTypes.notAllowed')} />
          <DetailRow label={t('leaveTypes.labelRequiresProof')} value={type.requiresProof ? t('leaveTypes.required') : t('leaveTypes.notRequired')} />
          <DetailRow label={t('leaveTypes.labelMaxConsecutive')} value={type.maxConsecutiveDays ? t('leaveTypes.daysUnit', { count: type.maxConsecutiveDays }) : t('leaveTypes.noLimit')} />
          <DetailRow label={t('leaveTypes.labelMinAdvance')} value={type.minAdvanceDays ? t('leaveTypes.daysAdvance', { count: type.minAdvanceDays }) : t('leaveTypes.sameDayOk')} />
          <DetailRow label={t('leaveTypes.labelScope')} value={!type.companyId ? tc('global') : t('leaveTypes.companyCustom')} />
          <DetailRow label={t('leaveTypes.labelDisplayOrder')} value={String(type.displayOrder)} />

          {/* 규정 상세 */}
          <div className="border-t border-border pt-4">
            <h4 className="mb-3 text-sm font-semibold text-foreground">{t('leaveTypes.regulationDetail')}</h4>
            <div className="space-y-3">
              <DetailRow
                label={t('leaveTypes.labelCategory')}
                value={type.category ? t(CATEGORY_LABEL_KEYS[type.category] ?? type.category) : '—'}
              />
              {type.subcategory && (
                <DetailRow
                  label={t('leaveTypes.labelSubcategory')}
                  value={t(SUBCATEGORY_LABEL_KEYS[type.subcategory] ?? type.subcategory)}
                />
              )}
              <DetailRow
                label={t('leaveTypes.labelCountingMethod')}
                value={t(COUNTING_METHOD_LABEL_KEYS[type.countingMethod] ?? type.countingMethod)}
              />
              <DetailRow
                label={t('leaveTypes.labelIncludesHolidays')}
                value={type.includesHolidays ? t('leaveTypes.includesHolidays') : t('leaveTypes.excludesHolidays')}
              />
              <DetailRow
                label={t('leaveTypes.labelSplittable')}
                value={type.isSplittable ? t('leaveTypes.splittableYes') : t('leaveTypes.splittableNo')}
              />
              {type.splitDeadlineDays != null && (
                <DetailRow label={t('leaveTypes.labelSplitDeadline')} value={t('leaveTypes.daysWithin', { count: type.splitDeadlineDays })} />
              )}
              {type.maxPerYear != null && (
                <DetailRow label={t('leaveTypes.labelMaxPerYear')} value={t('leaveTypes.timesUnit', { count: type.maxPerYear })} />
              )}
              {type.paidDaysPerYear != null && (
                <DetailRow label={t('leaveTypes.labelPaidDays')} value={t('leaveTypes.daysUnit', { count: type.paidDaysPerYear })} />
              )}
              {type.condolenceAmount != null && (
                <DetailRow
                  label={t('leaveTypes.labelCondolence')}
                  value={t('leaveTypes.wonUnit', { amount: type.condolenceAmount.toLocaleString() })}
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
