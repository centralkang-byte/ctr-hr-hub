'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Save, Info, RotateCcw } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { TABLE_STYLES } from '@/lib/styles'

interface NontaxableLimit {
  code: string
  label: string
  limit: number
  note: string
}

const STATIC_DEFAULTS: NontaxableLimit[] = [
  { code: 'MEAL', label: '식대', limit: 200_000, note: '소득세법 제12조' },
  { code: 'TRANSPORT', label: '교통비 (자가운전보조금)', limit: 200_000, note: '소득세법 시행령 제12조' },
  { code: 'CHILDCARE', label: '자녀보육수당', limit: 100_000, note: '6세 이하 자녀' },
  { code: 'RESEARCH', label: '연구활동비', limit: 200_000, note: '기업부설연구소' },
  { code: 'OVERTIME_EXEMPT', label: '생산직 야간근로수당', limit: 2_400_000, note: '연 240만원 한도' },
]

interface Props { companyId: string | null }

export function TaxFreeTab({ companyId }: Props) {
  const [limits, setLimits] = useState<NontaxableLimit[]>(() => structuredClone(STATIC_DEFAULTS))
  const [original, setOriginal] = useState<NontaxableLimit[]>(() => structuredClone(STATIC_DEFAULTS))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOverridden, setIsOverridden] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const qs = companyId ? `?key=kr-nontaxable-limits&companyId=${companyId}` : '?key=kr-nontaxable-limits'
      const res = await apiClient.get(`/api/v1/process-settings/payroll${qs}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (res as any)?.data ?? res ?? []
      const setting = Array.isArray(items) ? items[0] : null

      if (setting?.settingValue) {
        const sv = setting.settingValue as Record<string, number>
        setIsOverridden(!!setting.isOverridden)
        // Merge API values into the default structure
        const merged = STATIC_DEFAULTS.map((d) => ({
          ...d,
          limit: sv[d.code.toLowerCase()] ?? sv[d.code] ?? d.limit,
        }))
        setLimits(structuredClone(merged))
        setOriginal(structuredClone(merged))
      } else {
        setLimits(structuredClone(STATIC_DEFAULTS))
        setOriginal(structuredClone(STATIC_DEFAULTS))
        setIsOverridden(false)
      }
    } catch {
      // Fallback to static defaults
      setLimits(structuredClone(STATIC_DEFAULTS))
      setOriginal(structuredClone(STATIC_DEFAULTS))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const value: Record<string, number | number | string> = { effectiveYear: 2025 }
      for (const l of limits) {
        value[l.code.toLowerCase()] = l.limit
      }
      await apiClient.put('/api/v1/process-settings/payroll', {
        key: 'kr-nontaxable-limits',
        value,
        companyId: companyId ?? undefined,
        description: '한국 비과세 한도 (소득세법 §12 ②)',
      })
      toast({ title: '저장되었습니다', description: '비과세 한도가 업데이트되었습니다.' })
      setOriginal(structuredClone(limits))
    } catch {
      toast({ title: '저장 실패', description: '다시 시도해 주세요.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleRevert = () => {
    setLimits(structuredClone(original))
    toast({ title: '변경을 취소했습니다' })
  }

  const hasChanges = JSON.stringify(limits) !== JSON.stringify(original)

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">비과세 한도</h3>
          <p className="text-sm text-[#8181A5]">항목별 비과세 한도액 (2025 기준)</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">법인 오버라이드</span>
        )}
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-[#5E81F4]/20 bg-[#5E81F4]/5 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#5E81F4]" />
        <p className="text-xs text-[#8181A5]">세법 개정 시 관리자가 직접 한도액을 수정할 수 있습니다. 변경 사항은 급여 계산에 즉시 반영됩니다.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
        <table className="w-full"><thead><tr className={TABLE_STYLES.header}>
          <th className={TABLE_STYLES.headerCell}>코드</th>
          <th className={TABLE_STYLES.headerCell}>항목</th>
          <th className={TABLE_STYLES.headerCellRight}>한도액 (월)</th>
          <th className={TABLE_STYLES.headerCell}>근거</th>
        </tr></thead><tbody className="divide-y divide-[#F0F0F3]">{limits.map((l, i) => (
          <tr key={l.code} className={TABLE_STYLES.row}>
            <td className="px-4 py-3 text-sm font-medium text-[#5E81F4]">{l.code}</td>
            <td className={TABLE_STYLES.cell}>{l.label}</td>
            <td className="px-4 py-3 text-right">
              <Input
                type="number"
                value={l.limit}
                onChange={(e) => {
                  const next = structuredClone(limits)
                  next[i].limit = Number(e.target.value)
                  setLimits(next)
                }}
                className="ml-auto w-32 text-right"
              />
            </td>
            <td className={TABLE_STYLES.cellMuted}>{l.note}</td>
          </tr>
        ))}</tbody></table>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={handleRevert} disabled={!hasChanges}>
          <RotateCcw className="mr-2 h-4 w-4" />되돌리기
        </Button>
        <Button className="bg-[#5E81F4] text-white hover:bg-[#4A6FE0]" onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}저장
        </Button>
      </div>
    </div>
  )
}
