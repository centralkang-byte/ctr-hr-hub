'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save, Settings } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface CalibRule {
  id?: string
  emsBlock: string
  recommendedPct: number
  minPct: number | null
  maxPct: number | null
}

const DEFAULT_BLOCKS = [
  { emsBlock: '1A', label: '1A (저성과/저역량)' },
  { emsBlock: '2A', label: '2A (중성과/저역량)' },
  { emsBlock: '3A', label: '3A (고성과/저역량)' },
  { emsBlock: '1B', label: '1B (저성과/중역량)' },
  { emsBlock: '2B', label: '2B (중성과/중역량)' },
  { emsBlock: '3B', label: '3B (고성과/중역량)' },
  { emsBlock: '1C', label: '1C (저성과/고역량)' },
  { emsBlock: '2C', label: '2C (중성과/고역량)' },
  { emsBlock: '3C', label: '3C (고성과/고역량)' },
]

// ─── Component ────────────────────────────────────────────

export default function CalibrationSettingsClient({ user }: { user: SessionUser }) {
  const tc = useTranslations('common')

  const [rules, setRules] = useState<CalibRule[]>(
    DEFAULT_BLOCKS.map((b) => ({
      emsBlock: b.emsBlock,
      recommendedPct: 0,
      minPct: null,
      maxPct: null,
    })),
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<CalibRule[]>('/api/v1/performance/calibration/rules')
      if (res.data.length > 0) {
        // Merge with defaults
        const merged = DEFAULT_BLOCKS.map((b) => {
          const existing = res.data.find((r) => r.emsBlock === b.emsBlock)
          return existing ?? { emsBlock: b.emsBlock, recommendedPct: 0, minPct: null, maxPct: null }
        })
        setRules(merged)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiClient.post('/api/v1/performance/calibration/rules', {
        rules: rules.map((r) => ({
          emsBlock: r.emsBlock,
          recommendedPct: r.recommendedPct,
          minPct: r.minPct,
          maxPct: r.maxPct,
        })),
      })
      alert('저장되었습니다.')
    } catch {
      alert('저장에 실패했습니다.')
    } finally { setSaving(false) }
  }

  const updateRule = (index: number, field: keyof CalibRule, value: number | null) => {
    setRules((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64 text-[#666]">{tc('loading')}...</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#666]" />
            캘리브레이션 설정
          </h1>
          <p className="text-sm text-[#666] mt-1">EMS 블록별 인원 비율 가이드라인을 설정합니다</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* Rules table */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#FAFAFA] text-xs text-[#666] font-medium uppercase tracking-wider">
              <th className="px-4 py-3 text-left">EMS 블록</th>
              <th className="px-4 py-3 text-center">권장 비율 (%)</th>
              <th className="px-4 py-3 text-center">최소 비율 (%)</th>
              <th className="px-4 py-3 text-center">최대 비율 (%)</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, idx) => {
              const blockInfo = DEFAULT_BLOCKS.find((b) => b.emsBlock === rule.emsBlock)
              return (
                <tr key={rule.emsBlock} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-[#1A1A1A]">{blockInfo?.label ?? rule.emsBlock}</span>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0} max={100} step={1}
                      value={rule.recommendedPct}
                      onChange={(e) => updateRule(idx, 'recommendedPct', Number(e.target.value))}
                      className="w-20 mx-auto block px-2 py-1.5 border border-[#D4D4D4] rounded-lg text-sm text-center focus:ring-2 focus:ring-[#00C853]/10"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0} max={100} step={1}
                      value={rule.minPct ?? ''}
                      onChange={(e) => updateRule(idx, 'minPct', e.target.value ? Number(e.target.value) : null)}
                      placeholder="-"
                      className="w-20 mx-auto block px-2 py-1.5 border border-[#D4D4D4] rounded-lg text-sm text-center focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#999]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0} max={100} step={1}
                      value={rule.maxPct ?? ''}
                      onChange={(e) => updateRule(idx, 'maxPct', e.target.value ? Number(e.target.value) : null)}
                      placeholder="-"
                      className="w-20 mx-auto block px-2 py-1.5 border border-[#D4D4D4] rounded-lg text-sm text-center focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#999]"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] p-5">
        <p className="text-sm text-[#666]">
          <strong className="text-[#333]">참고:</strong> 권장 비율은 캘리브레이션 시 가이드라인으로 사용됩니다.
          최소/최대 비율을 설정하면 캘리브레이션 세션에서 범위를 벗어난 경우 경고가 표시됩니다.
        </p>
      </div>
    </div>
  )
}
