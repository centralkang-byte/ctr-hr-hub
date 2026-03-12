'use client'

import { useState } from 'react'
import { Plus, Trash2, GripVertical, ChevronDown } from 'lucide-react'
import type { ApprovalFlowData, ApprovalFlowStepData, ApproverRole } from '@/types/settings'

const APPROVER_ROLES: { value: ApproverRole; label: string }[] = [
  { value: 'direct_manager', label: '직속 팀장' },
  { value: 'dept_head', label: '부서장' },
  { value: 'hr_admin', label: 'HR 담당' },
  { value: 'finance', label: '경영관리' },
  { value: 'ceo', label: '대표이사' },
]

interface ApprovalFlowEditorProps {
  flow: ApprovalFlowData
  onChange: (flow: ApprovalFlowData) => void
  disabled?: boolean
}

export function ApprovalFlowEditor({ flow, onChange, disabled = false }: ApprovalFlowEditorProps) {
  const updateStep = (index: number, updates: Partial<ApprovalFlowStepData>) => {
    const newSteps = flow.steps.map((s, i) =>
      i === index ? { ...s, ...updates } : s
    )
    onChange({ ...flow, steps: newSteps })
  }

  const addStep = () => {
    const newStep: ApprovalFlowStepData = {
      id: `new-${Date.now()}`,
      flowId: flow.id,
      stepOrder: flow.steps.length + 1,
      approverType: 'role',
      approverRole: 'hr_admin',
      approverUserId: null,
      isRequired: true,
      autoApproveDays: null,
      createdAt: new Date(),
    }
    onChange({ ...flow, steps: [...flow.steps, newStep] })
  }

  const removeStep = (index: number) => {
    const newSteps = flow.steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, stepOrder: i + 1 }))
    onChange({ ...flow, steps: newSteps })
  }

  return (
    <div className="space-y-3">
      {flow.steps.map((step, index) => (
        <div
          key={step.id}
          className="flex items-center gap-3 rounded-xl border border-[#E8E8E8] bg-white px-4 py-3"
        >
          {/* 순서 */}
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#00C853] text-xs font-bold text-white">
            {index + 1}
          </div>

          <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab text-[#CCC]" />

          {/* 역할 선택 */}
          <div className="relative flex-1">
            <select
              value={step.approverRole ?? ''}
              onChange={(e) => updateStep(index, { approverRole: e.target.value as ApproverRole })}
              disabled={disabled}
              className="w-full appearance-none rounded-lg border border-[#D4D4D4] bg-white px-3 py-2 text-sm text-[#333] focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA] disabled:text-[#999]"
            >
              {APPROVER_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
          </div>

          {/* 자동승인 일수 */}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              placeholder={tCommon('placeholderAutoApproveDays')}
              value={step.autoApproveDays ?? ''}
              onChange={(e) => updateStep(index, {
                autoApproveDays: e.target.value ? parseInt(e.target.value) : null
              })}
              disabled={disabled}
              className="w-24 rounded-lg border border-[#D4D4D4] px-2 py-2 text-sm text-[#333] placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
            />
            <span className="text-xs text-[#999]">일 후 자동</span>
          </div>

          {/* 삭제 */}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeStep(index)}
              className="flex-shrink-0 rounded-lg p-1.5 text-[#999] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}

      {!disabled && (
        <button
          type="button"
          onClick={addStep}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#D4D4D4] py-2.5 text-sm text-[#666] hover:border-[#00C853] hover:text-[#00C853]"
        >
          <Plus className="h-4 w-4" />
          단계 추가
        </button>
      )}
    </div>
  )
}
