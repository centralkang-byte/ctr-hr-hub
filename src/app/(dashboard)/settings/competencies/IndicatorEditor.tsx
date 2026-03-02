'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Indicator Editor (B3-1)
// 역량 행동지표 편집기 (추가/삭제/순서변경)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface Indicator {
  id?: string
  indicatorText: string
  indicatorTextEn: string | null
  displayOrder: number
  isActive: boolean
}

interface Props {
  competencyId: string
  competencyName: string
  initialIndicators: Indicator[]
  onSaved: () => void
}

export default function IndicatorEditor({
  competencyId,
  competencyName,
  initialIndicators,
  onSaved,
}: Props) {
  const [indicators, setIndicators] = useState<Indicator[]>(
    [...initialIndicators].sort((a, b) => a.displayOrder - b.displayOrder),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setIndicators([...initialIndicators].sort((a, b) => a.displayOrder - b.displayOrder))
  }, [initialIndicators])

  const update = (idx: number, field: 'indicatorText' | 'indicatorTextEn', value: string) => {
    setIndicators((prev) =>
      prev.map((ind, i) => (i === idx ? { ...ind, [field]: value || null } : ind)),
    )
  }

  const moveUp = (idx: number) => {
    if (idx === 0) return
    setIndicators((prev) => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next.map((ind, i) => ({ ...ind, displayOrder: i + 1 }))
    })
  }

  const moveDown = (idx: number) => {
    if (idx === indicators.length - 1) return
    setIndicators((prev) => {
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next.map((ind, i) => ({ ...ind, displayOrder: i + 1 }))
    })
  }

  const addNew = () => {
    setIndicators((prev) => [
      ...prev,
      {
        indicatorText: '',
        indicatorTextEn: null,
        displayOrder: prev.length + 1,
        isActive: true,
      },
    ])
  }

  const remove = (idx: number) => {
    setIndicators((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((ind, i) => ({ ...ind, displayOrder: i + 1 })),
    )
  }

  const handleSave = async () => {
    if (indicators.some((ind) => !ind.indicatorText.trim())) {
      return alert('빈 행동지표가 있습니다. 내용을 입력하거나 삭제하세요.')
    }
    setSaving(true)
    try {
      await apiClient.put(`/api/v1/competencies/${competencyId}/indicators`, {
        indicators: indicators.map((ind, idx) => ({
          indicatorText: ind.indicatorText,
          indicatorTextEn: ind.indicatorTextEn,
          displayOrder: idx + 1,
          isActive: ind.isActive,
        })),
      })
      onSaved()
    } catch {
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#E8E8E8] bg-white">
      <div className="px-4 py-3 border-b border-[#E8E8E8] flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#1A1A1A]">{competencyName} — 행동지표</h4>
        <button
          onClick={addNew}
          className="flex items-center gap-1 text-xs text-[#00C853] hover:text-[#00A844] font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          추가
        </button>
      </div>

      <div className="divide-y divide-[#F5F5F5]">
        {indicators.length === 0 && (
          <div className="px-4 py-4 text-xs text-[#999] text-center">
            행동지표가 없습니다. 추가 버튼을 눌러 지표를 입력하세요.
          </div>
        )}
        {indicators.map((ind, idx) => (
          <div key={idx} className="px-4 py-3 space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-xs text-[#999] mt-2.5 w-5 shrink-0 text-right">
                {idx + 1}.
              </span>
              <textarea
                value={ind.indicatorText}
                onChange={(e) => update(idx, 'indicatorText', e.target.value)}
                rows={2}
                placeholder="행동지표를 입력하세요"
                className="flex-1 px-2.5 py-1.5 border border-[#D4D4D4] rounded-lg text-xs focus:ring-2 focus:ring-[#00C853]/10 resize-none placeholder:text-[#999]"
              />
              <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="p-1 rounded hover:bg-[#F5F5F5] disabled:opacity-30 transition-colors"
                >
                  <ArrowUp className="w-3 h-3 text-[#666]" />
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === indicators.length - 1}
                  className="p-1 rounded hover:bg-[#F5F5F5] disabled:opacity-30 transition-colors"
                >
                  <ArrowDown className="w-3 h-3 text-[#666]" />
                </button>
                <button
                  onClick={() => remove(idx)}
                  className="p-1 rounded hover:bg-[#FEE2E2] text-[#999] hover:text-[#DC2626] transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <input
              value={ind.indicatorTextEn ?? ''}
              onChange={(e) => update(idx, 'indicatorTextEn', e.target.value)}
              placeholder="English translation (optional)"
              className="w-full ml-7 px-2.5 py-1 border border-[#E8E8E8] rounded-lg text-xs text-[#666] focus:ring-1 focus:ring-[#00C853]/10 placeholder:text-[#999]"
            />
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-[#E8E8E8]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          저장
        </button>
      </div>
    </div>
  )
}
