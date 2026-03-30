'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Military Registration Form Modal
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface MilitaryRegistration {
  id: string
  employeeId: string
  category: string
  rank: string | null
  specialtyCode: string | null
  fitnessCategory: string
  militaryOffice: string | null
  registrationDate: string | null
  deregistrationDate: string | null
  notes: string | null
  employee: {
    id: string
    name: string
    employeeNo: string
    department: { id: string; name: string } | null
  }
}

interface Props {
  registration: MilitaryRegistration | null
  onClose: () => void
  onSuccess: () => void
}

const isEditing = (reg: MilitaryRegistration | null): reg is MilitaryRegistration =>
  reg !== null

export default function MilitaryRegistrationForm({ registration, onClose, onSuccess }: Props) {
  const editing = isEditing(registration)

  const [form, setForm] = useState({
    employeeId: registration?.employeeId ?? '',
    category: registration?.category ?? 'RESERVIST',
    rank: registration?.rank ?? '',
    specialtyCode: registration?.specialtyCode ?? '',
    fitnessCategory: registration?.fitnessCategory ?? 'FIT_B',
    militaryOffice: registration?.militaryOffice ?? '',
    registrationDate: registration?.registrationDate
      ? registration.registrationDate.slice(0, 10)
      : '',
    deregistrationDate: registration?.deregistrationDate
      ? registration.deregistrationDate.slice(0, 10)
      : '',
    notes: registration?.notes ?? '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const payload = {
        ...form,
        registrationDate: form.registrationDate
          ? new Date(form.registrationDate).toISOString()
          : undefined,
        deregistrationDate: form.deregistrationDate
          ? new Date(form.deregistrationDate).toISOString()
          : null,
        rank: form.rank || undefined,
        specialtyCode: form.specialtyCode || undefined,
        militaryOffice: form.militaryOffice || undefined,
        notes: form.notes || undefined,
      }

      if (editing) {
        await apiClient.put(
          `/api/v1/compliance/ru/military/${registration.employeeId}`,
          payload,
        )
      } else {
        await apiClient.post('/api/v1/compliance/ru/military', payload)
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? '군복무 기록 수정' : '군복무 기록 등록'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee ID (only when creating) */}
          {!editing && (
            <div>
              <label className="text-sm font-medium text-[#333] block mb-1">
                직원 ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="employeeId"
                value={form.employeeId}
                onChange={handleChange}
                required
                placeholder={'직원 UUID 입력'}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-[#999]"
              />
            </div>
          )}

          {/* Show current employee info when editing */}
          {editing && (
            <div className="p-3 bg-background rounded-lg">
              <p className="text-sm font-medium text-foreground">{registration.employee.name}</p>
              <p className="text-xs text-[#666]">
                {registration.employee.employeeNo} · {registration.employee.department?.name ?? '-'}
              </p>
            </div>
          )}

          {/* Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[#333] block mb-1">
                복무 구분 <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
              >
                <option value="OFFICER">장교</option>
                <option value="SOLDIER">병사</option>
                <option value="RESERVIST">예비역</option>
                <option value="EXEMPT">면제</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#333] block mb-1">
                적합도 <span className="text-red-500">*</span>
              </label>
              <select
                name="fitnessCategory"
                value={form.fitnessCategory}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
              >
                <option value="FIT_A">적합 A</option>
                <option value="FIT_B">적합 B</option>
                <option value="FIT_C">적합 C</option>
                <option value="FIT_D">적합 D</option>
                <option value="UNFIT">부적합</option>
              </select>
            </div>
          </div>

          {/* Rank & Specialty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[#333] block mb-1">계급</label>
              <input
                type="text"
                name="rank"
                value={form.rank}
                onChange={handleChange}
                placeholder="예: 상사"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-[#999]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#333] block mb-1">군사특기</label>
              <input
                type="text"
                name="specialtyCode"
                value={form.specialtyCode}
                onChange={handleChange}
                placeholder="예: 106A"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-[#999]"
              />
            </div>
          </div>

          {/* Military Office */}
          <div>
            <label className="text-sm font-medium text-[#333] block mb-1">군사기관</label>
            <input
              type="text"
              name="militaryOffice"
              value={form.militaryOffice}
              onChange={handleChange}
              placeholder="담당 군사기관명"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-[#999]"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[#333] block mb-1">등록일</label>
              <input
                type="date"
                name="registrationDate"
                value={form.registrationDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#333] block mb-1">해제일</label>
              <input
                type="date"
                name="deregistrationDate"
                value={form.deregistrationDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-[#333] block mb-1">비고</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder={'추가 메모'}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-[#999] resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-100 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="bg-white border border-border hover:bg-background text-[#333] px-4 py-2 rounded-lg font-medium text-sm"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50`}
            >
              {saving ? '저장 중...' : editing ? '수정' : '등록'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
