'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Competency Level Editor (B3-1)
// 역량 숙련도 레벨 편집기
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface Level {
  id?: string
  level: number
  label: string
  description: string | null
}

interface Props {
  competencyId: string
  competencyName: string
  initialLevels: Level[]
  onSaved: () => void
}

export default function CompetencyLevelEditor({
  competencyId,
  competencyName,
  initialLevels,
  onSaved,
}: Props) {
  const [levels, setLevels] = useState<Level[]>(
    [...initialLevels].sort((a, b) => a.level - b.level),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLevels([...initialLevels].sort((a, b) => a.level - b.level))
  }, [initialLevels])

  const updateLabel = (idx: number, value: string) => {
    setLevels((prev) => prev.map((l, i) => (i === idx ? { ...l, label: value } : l)))
  }

  const updateDesc = (idx: number, value: string) => {
    setLevels((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, description: value || null } : l)),
    )
  }

  const addLevel = () => {
    const nextLevel = levels.length > 0 ? Math.max(...levels.map((l) => l.level)) + 1 : 1
    setLevels((prev) => [...prev, { level: nextLevel, label: '', description: null }])
  }

  const removeLevel = (idx: number) => {
    setLevels((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (levels.some((l) => !l.label.trim())) {
      return alert('레벨 라벨을 입력하세요.')
    }
    setSaving(true)
    try {
      await apiClient.put(`/api/v1/competencies/${competencyId}/levels`, {
        levels: levels.map((l) => ({
          level: l.level,
          label: l.label,
          description: l.description,
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
        <h4 className="text-sm font-semibold text-[#1A1A1A]">{competencyName} — 숙련도 레벨</h4>
        <button
          onClick={addLevel}
          className="flex items-center gap-1 text-xs text-[#00C853] hover:text-[#00A844] font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          레벨 추가
        </button>
      </div>

      <div className="divide-y divide-[#F5F5F5]">
        {levels.length === 0 && (
          <div className="px-4 py-4 text-xs text-[#999] text-center">레벨이 없습니다.</div>
        )}
        {levels.map((lvl, idx) => (
          <div key={idx} className="px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#555] w-16 shrink-0">
                Level {lvl.level}
              </span>
              <input
                value={lvl.label}
                onChange={(e) => updateLabel(idx, e.target.value)}
                placeholder="레벨 라벨 (예: 기초)"
                className="flex-1 px-2.5 py-1.5 border border-[#D4D4D4] rounded-lg text-xs focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#999]"
              />
              <button
                onClick={() => removeLevel(idx)}
                className="p-1 rounded hover:bg-[#FEE2E2] text-[#999] hover:text-[#DC2626] transition-colors shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <textarea
              value={lvl.description ?? ''}
              onChange={(e) => updateDesc(idx, e.target.value)}
              rows={2}
              placeholder="이 레벨의 기대 행동 설명 (선택)"
              className="w-full ml-[72px] px-2.5 py-1.5 border border-[#E8E8E8] rounded-lg text-xs text-[#666] focus:ring-1 focus:ring-[#00C853]/10 resize-none placeholder:text-[#999]"
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
