'use client'

// ═══════════════════════════════════════════════════════════
// Tab 3: Leave Accrual — 휴가 부여 규칙
// API: GET /api/v1/leave/type-defs (with accrualRules)
//      GET /api/v1/leave/type-defs/[id]/accrual-rules
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
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

export function LeaveAccrualTab({ companyId }: LeaveAccrualTabProps) {
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
        <Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" />
      </div>
    )
  }

  // Filter to types that have accrual rules
  const typesWithRules = typeDefs.filter(
    (t) => t.accrualRules && t.accrualRules.length > 0
  )

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1C1D21]">휴가 부여 규칙</h3>
        <p className="text-sm text-[#8181A5]">
          휴가 유형별 부여 방식, 근속 가산, 이월 정책 설정
        </p>
      </div>

      {/* 마이너스 연차 설정 */}
      <SettingFieldWithOverride
        label="마이너스 연차"
        description="잔여 연차가 0일 미만으로 내려갈 수 있도록 허용"
        status="global"
        companySelected={!!companyId}
      >
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.allowNegativeBalance}
              onChange={(e) => setSettings((p) => ({ ...p, allowNegativeBalance: e.target.checked }))}
              className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]"
            />
            <span className="text-[#1C1D21]">마이너스 연차 허용</span>
          </label>
          {settings.allowNegativeBalance && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-sm text-[#8181A5]">최대 마이너스 한도:</span>
              <Input
                type="number"
                value={settings.negativeBalanceLimit}
                onChange={(e) => setSettings((p) => ({ ...p, negativeBalanceLimit: Number(e.target.value) }))}
                className="w-20"
              />
              <span className="text-sm text-[#8181A5]">일</span>
            </div>
          )}
        </div>
      </SettingFieldWithOverride>

      {/* 유형별 부여 규칙 accordion */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-[#1C1D21]">유형별 부여 규칙</h4>
        {typesWithRules.length > 0 ? (
          <div className="space-y-2">
            {typesWithRules.map((typeDef) => {
              const rule = typeDef.accrualRules?.[0]
              const isExpanded = expandedId === typeDef.id
              return (
                <div key={typeDef.id} className="rounded-xl border border-[#F0F0F3]">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : typeDef.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#F5F5FA]"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-[#8181A5]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#8181A5]" />
                    )}
                    <span className="font-mono text-xs text-[#5E81F4]">{typeDef.code}</span>
                    <span className="text-sm font-medium text-[#1C1D21]">{typeDef.name}</span>
                    {rule && (
                      <span className="ml-auto text-xs text-[#8181A5]">
                        {rule.accrualType === 'annual' ? '연간 부여' : rule.accrualType === 'monthly' ? '월별 부여' : '수동 부여'} · {rule.accrualBasis === 'hire_date_anniversary' ? '입사일 기준' : '회계연도 기준'}
                      </span>
                    )}
                  </button>
                  {isExpanded && rule && (
                    <div className="border-t border-[#F0F0F3] px-4 py-4">
                      <AccrualRuleDetail rule={rule} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#F0F0F3] py-8 text-center">
            <Info className="mx-auto mb-2 h-6 w-6 text-[#8181A5]" />
            <p className="text-sm text-[#8181A5]">
              부여 규칙이 설정된 휴가 유형이 없습니다
            </p>
            <p className="mt-1 text-xs text-[#8181A5]">
              휴가 유형 탭에서 유형을 추가한 후 부여 규칙을 설정하세요
            </p>
          </div>
        )}
      </div>

      {/* 유형이 없더라도 참고용 기본 설정 폼은 항상 표시 */}
      <SettingFieldWithOverride
        label="입사 첫해 비례 부여"
        description="입사일이 연도 중간인 경우 비례 계산하여 부여"
        status="global"
        companySelected={!!companyId}
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            defaultChecked={true}
            className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]"
          />
          <span className="text-[#1C1D21]">비례 부여 활성화</span>
        </label>
      </SettingFieldWithOverride>

      <div className="flex justify-end pt-4">
        <Button className={BUTTON_VARIANTS.primary}>
          <Save className="mr-2 h-4 w-4" />
          저장
        </Button>
      </div>
    </div>
  )
}

// ─── Accrual Rule Detail ────────────────────────────────

function AccrualRuleDetail({ rule }: { rule: LeaveAccrualRuleRow }) {
  const tiers = Array.isArray(rule.rules) ? rule.rules : []

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-lg bg-[#F5F5FA] px-3 py-2">
          <p className="text-xs text-[#8181A5]">부여 방식</p>
          <p className="font-medium text-[#1C1D21]">
            {rule.accrualType === 'annual' ? '연간 일괄 부여' : rule.accrualType === 'monthly' ? '월별 적립' : '수동 부여'}
          </p>
        </div>
        <div className="rounded-lg bg-[#F5F5FA] px-3 py-2">
          <p className="text-xs text-[#8181A5]">기준 기간</p>
          <p className="font-medium text-[#1C1D21]">
            {rule.accrualBasis === 'hire_date_anniversary' ? '입사일 기준' : '회계연도 (1/1)'}
          </p>
        </div>
        <div className="rounded-lg bg-[#F5F5FA] px-3 py-2">
          <p className="text-xs text-[#8181A5]">이월 정책</p>
          <p className="font-medium text-[#1C1D21]">
            {rule.carryOverType === 'none'
              ? '이월 불가'
              : rule.carryOverType === 'limited'
                ? `최대 ${rule.carryOverMaxDays}일 이월`
                : '전액 이월'}
          </p>
        </div>
        {rule.carryOverExpiryMonths && (
          <div className="rounded-lg bg-[#F5F5FA] px-3 py-2">
            <p className="text-xs text-[#8181A5]">이월 소멸</p>
            <p className="font-medium text-[#1C1D21]">{rule.carryOverExpiryMonths}개월 후 소멸</p>
          </div>
        )}
      </div>

      {/* Tier table */}
      {tiers.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full text-sm">
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>근속 기간</th>
                <th className={TABLE_STYLES.headerCellRight}>부여일수</th>
                <th className={TABLE_STYLES.headerCellRight}>가산</th>
                <th className={TABLE_STYLES.headerCellRight}>상한</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F3]">
              {tiers.map((tier, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-[#1C1D21]">
                    {tier.minTenureMonths !== undefined ? `${tier.minTenureMonths}개월` : '—'}
                    {' ~ '}
                    {tier.maxTenureMonths !== undefined && tier.maxTenureMonths !== null
                      ? `${tier.maxTenureMonths}개월`
                      : '무제한'}
                  </td>
                  <td className="px-3 py-2 text-right text-[#1C1D21]">
                    {tier.daysPerYear !== undefined
                      ? `연 ${tier.daysPerYear}일`
                      : tier.daysPerMonth !== undefined
                        ? `월 ${tier.daysPerMonth}일`
                        : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-[#8181A5]">
                    {tier.bonusPerTwoYears ? `2년마다 +${tier.bonusPerTwoYears}일` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-[#8181A5]">
                    {tier.maxDays ? `최대 ${tier.maxDays}일` : '—'}
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
