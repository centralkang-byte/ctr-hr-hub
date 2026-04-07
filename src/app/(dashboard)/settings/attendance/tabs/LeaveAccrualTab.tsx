'use client'

// ═══════════════════════════════════════════════════════════
// Tab 3: Leave Accrual — 휴가 부여 규칙
// API: GET /api/v1/leave/type-defs (with accrualRules)
//      GET /api/v1/leave/type-defs/[id]/accrual-rules
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Save, Info, ChevronDown, ChevronRight } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'

interface AccrualRule {
  minTenureMonths?: number
  maxTenureMonths?: number | null
  daysPerYear?: number
  daysPerMonth?: number
  bonusPerTwoYears?: number
  maxDays?: number
  type?: string
}

interface LeaveAccrualRuleRow {
  id: string
  leaveTypeDefId: string
  accrualType: string
  accrualBasis: string
  rules: AccrualRule[]
  carryOverType: string
  carryOverMaxDays: number | null
  carryOverExpiryMonths: number | null
  isActive: boolean
}

interface LeaveTypeDef {
  id: string
  code: string
  name: string
  companyId: string | null
  accrualRules?: LeaveAccrualRuleRow[]
}

interface LeaveAccrualTabProps {
  companyId: string | null
}

// Settings-connected: negative leave balance policy (ATTENDANCE/leave-accrual)
const DEFAULT_SETTINGS = {
  allowNegativeBalance: false,
  negativeBalanceLimit: -3,
}

export function LeaveAccrualTab({
  companyId }: LeaveAccrualTabProps) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const [loading, setLoading] = useState(true)
  const [typeDefs, setTypeDefs] = useState<LeaveTypeDef[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

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

  // Filter to types that have accrual rules
  const typesWithRules = typeDefs.filter(
    (td) => td.accrualRules && td.accrualRules.length > 0
  )

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{t('leaveAccrualTitle')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('leaveAccrualDesc')}
        </p>
      </div>

      {/* 마이너스 연차 설정 */}
      <SettingFieldWithOverride
        label={t('negativeLeave')}
        description={t('negativeLeaveDesc')}
        status="global"
        companySelected={!!companyId}
      >
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.allowNegativeBalance}
              onChange={(e) => setSettings((p) => ({ ...p, allowNegativeBalance: e.target.checked }))}
              className="h-4 w-4 rounded border-border text-primary"
            />
            <span className="text-foreground">{t('negativeLeaveAllow')}</span>
          </label>
          {settings.allowNegativeBalance && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-sm text-muted-foreground">{t('negativeLeaveLimit')}</span>
              <Input
                type="number"
                value={settings.negativeBalanceLimit}
                onChange={(e) => setSettings((p) => ({ ...p, negativeBalanceLimit: Number(e.target.value) }))}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">{t('dayUnit')}</span>
            </div>
          )}
        </div>
      </SettingFieldWithOverride>

      {/* 유형별 부여 규칙 accordion */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-foreground">{t('rulesPerType')}</h4>
        {typesWithRules.length > 0 ? (
          <div className="space-y-2">
            {typesWithRules.map((typeDef) => {
              const rule = typeDef.accrualRules?.[0]
              const isExpanded = expandedId === typeDef.id
              return (
                <div key={typeDef.id} className="rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : typeDef.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-mono tabular-nums text-xs text-primary">{typeDef.code}</span>
                    <span className="text-sm font-medium text-foreground">{typeDef.name}</span>
                    {rule && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {rule.accrualType === 'annual' ? t('accrualTypeAnnual') : rule.accrualType === 'monthly' ? t('accrualTypeMonthly') : t('accrualTypeManual')} · {rule.accrualBasis === 'hire_date_anniversary' ? t('basisHireDate') : t('basisFiscalYear')}
                      </span>
                    )}
                  </button>
                  {isExpanded && rule && (
                    <div className="border-t border-border px-4 py-4">
                      <AccrualRuleDetail rule={rule} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border py-8 text-center">
            <Info className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t('noAccrualRules')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('noAccrualRulesHint')}
            </p>
          </div>
        )}
      </div>

      {/* 유형이 없더라도 참고용 기본 설정 폼은 항상 표시 */}
      <SettingFieldWithOverride
        label={t('firstYearProration')}
        description={t('firstYearProrationDesc')}
        status="global"
        companySelected={!!companyId}
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            defaultChecked={true}
            className="h-4 w-4 rounded border-border text-primary"
          />
          <span className="text-foreground">{t('firstYearProrationEnabled')}</span>
        </label>
      </SettingFieldWithOverride>

      <div className="flex justify-end pt-4">
        <Button className={BUTTON_VARIANTS.primary}>
          <Save className="mr-2 h-4 w-4" />
          {tc('save')}
        </Button>
      </div>
    </div>
  )
}

// ─── Accrual Rule Detail ────────────────────────────────

function AccrualRuleDetail({ rule }: { rule: LeaveAccrualRuleRow }) {
  const t = useTranslations('settings')
  const tiers = Array.isArray(rule.rules) ? rule.rules : []

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-lg bg-muted px-3 py-2">
          <p className="text-xs text-muted-foreground">{t('accrualMethod')}</p>
          <p className="font-medium text-foreground">
            {rule.accrualType === 'annual' ? t('accrualTypeAnnualFull') : rule.accrualType === 'monthly' ? t('accrualTypeMonthlyFull') : t('accrualTypeManual')}
          </p>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <p className="text-xs text-muted-foreground">{t('basisPeriod')}</p>
          <p className="font-medium text-foreground">
            {rule.accrualBasis === 'hire_date_anniversary' ? t('basisHireDate') : t('basisFiscalYearFull')}
          </p>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <p className="text-xs text-muted-foreground">{t('carryOverPolicy')}</p>
          <p className="font-medium text-foreground">
            {rule.carryOverType === 'none'
              ? t('carryOverNone')
              : rule.carryOverType === 'limited'
                ? t('carryOverLimited', { days: rule.carryOverMaxDays ?? 0 })
                : t('carryOverFull')}
          </p>
        </div>
        {rule.carryOverExpiryMonths && (
          <div className="rounded-lg bg-muted px-3 py-2">
            <p className="text-xs text-muted-foreground">{t('carryOverExpiry')}</p>
            <p className="font-medium text-foreground">{t('carryOverExpiryMonths', { months: rule.carryOverExpiryMonths })}</p>
          </div>
        )}
      </div>

      {/* Tier table */}
      {tiers.length > 0 && (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{t('tenurePeriod')}</th>
                <th className={TABLE_STYLES.headerCellRight}>{t('grantDays')}</th>
                <th className={TABLE_STYLES.headerCellRight}>{t('bonusWeight')}</th>
                <th className={TABLE_STYLES.headerCellRight}>{t('upperLimit')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tiers.map((tier, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-foreground">
                    {tier.minTenureMonths !== undefined ? t('tenureMonths', { months: tier.minTenureMonths }) : '—'}
                    {' ~ '}
                    {tier.maxTenureMonths !== undefined && tier.maxTenureMonths !== null
                      ? t('tenureMonths', { months: tier.maxTenureMonths })
                      : t('unlimited')}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {tier.daysPerYear !== undefined
                      ? t('annualDays', { days: tier.daysPerYear })
                      : tier.daysPerMonth !== undefined
                        ? t('monthlyDays', { days: tier.daysPerMonth })
                        : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {tier.bonusPerTwoYears ? t('bonusPerTwoYears', { days: tier.bonusPerTwoYears }) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {tier.maxDays ? t('maxDays', { days: tier.maxDays }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
