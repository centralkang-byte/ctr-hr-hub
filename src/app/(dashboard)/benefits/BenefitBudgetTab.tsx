'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import { Loader2, AlertTriangle, Pencil, Check } from 'lucide-react'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface BenefitBudget {
  id: string
  companyId: string
  year: number
  category: string
  totalBudget: number
  usedAmount: number
}

const CATEGORY_LABELS: Record<string, string> = {
  family: '경조금', health: '건강', education: '교육', lifestyle: '생활', financial: '금융',
}

const CATEGORY_COLORS: Record<string, string> = {
  family: '#00C853',
  health: '#059669',
  education: '#4338CA',
  lifestyle: '#F59E0B',
  financial: '#EC4899',
}

export function BenefitBudgetTab({ user }: { user: SessionUser }) {
  const [budgets, setBudgets] = useState<BenefitBudget[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Suppress unused variable warning - user prop reserved for future RBAC use
  void user

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<BenefitBudget[]>('/api/v1/benefit-budgets', { year: String(year) })
      setBudgets(res.data ?? [])
    } catch {
      setError('예산 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { void load() }, [load])

  const handleSave = async (budget: BenefitBudget) => {
    if (!editValue || isNaN(Number(editValue))) return
    setSaving(true)
    try {
      await apiClient.put('/api/v1/benefit-budgets', {
        year: budget.year,
        category: budget.category,
        totalBudget: Number(editValue),
      })
      setEditingId(null)
      await load()
    } catch {
      setError('예산 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const formatAmount = (amount: number, isKRW: boolean) =>
    isKRW ? `₩${(amount / 10000).toFixed(0)}만` : `$${amount.toLocaleString()}`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-[#333]">기준 연도</label>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-1.5 border border-[#D4D4D4] rounded-lg text-sm"
        >
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-[#FEE2E2] rounded-lg text-sm text-[#B91C1C]">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-[#00C853]" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E8E8] p-8 text-center text-[#999] text-sm">
          예산 데이터가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {budgets.map((budget) => {
            const pct = budget.totalBudget > 0
              ? Math.min(100, Math.round((budget.usedAmount / budget.totalBudget) * 100))
              : 0
            const isWarning = pct >= 80
            const color = CATEGORY_COLORS[budget.category] ?? '#00C853'
            // Detect currency from budget — KRW if total > 100000 (heuristic for KRW vs USD)
            const isKRW = budget.totalBudget > 100000

            return (
              <div key={budget.id} className="bg-white rounded-xl border border-[#E8E8E8] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <h3 className="text-base font-semibold text-[#1A1A1A]">
                      {CATEGORY_LABELS[budget.category] ?? budget.category}
                    </h3>
                    {isWarning && (
                      <span className="text-xs px-2 py-0.5 bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D] rounded-full">
                        80% 초과 ⚠️
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingId === budget.id ? (
                      <>
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-32 px-2 py-1 border border-[#D4D4D4] rounded text-sm"
                        />
                        <button
                          onClick={() => void handleSave(budget)}
                          disabled={saving}
                          className={`p-1.5 ${BUTTON_VARIANTS.primary} rounded`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setEditingId(budget.id); setEditValue(String(budget.totalBudget)) }}
                        className="p-1.5 hover:bg-[#F5F5F5] rounded text-[#999]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="w-full bg-[#F5F5F5] rounded-full h-3 mb-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: isWarning ? '#F59E0B' : color }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[#666]">
                  <span>사용: {formatAmount(budget.usedAmount, isKRW)}</span>
                  <span className="font-medium">{pct}%</span>
                  <span>총: {formatAmount(budget.totalBudget, isKRW)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
