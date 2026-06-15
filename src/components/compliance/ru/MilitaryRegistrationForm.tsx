'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Military Registration Form Modal
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { WdDrawer, WdField, WdRow } from '@/components/shared/WdDrawer'
import { apiClient } from '@/lib/api'

const INPUT_CLS = 'w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus:outline-none'

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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    // WdDrawer primary는 form submit이 아니므로 native required가 강제되지 않음 → 명시적 검증
    if (!editing && !form.employeeId.trim()) {
      setError('필수 항목이 누락되었습니다.')
      return
    }
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
    <WdDrawer
      open
      onClose={onClose}
      title={editing ? '군복무 기록 수정' : '군복무 기록 등록'}
      closeDisabled={saving}
      secondary={{ label: '취소', onClick: onClose, disabled: saving }}
      primary={{
        label: saving ? '저장 중...' : editing ? '수정' : '등록',
        onClick: handleSubmit,
        disabled: saving,
      }}
    >
      {/* Employee ID (only when creating) */}
      {!editing && (
        <WdField label="직원 ID" required htmlFor="military-employee-id">
          <input
            id="military-employee-id"
            type="text"
            name="employeeId"
            value={form.employeeId}
            onChange={handleChange}
            required
            placeholder={'직원 UUID 입력'}
            className={INPUT_CLS}
          />
        </WdField>
      )}

      {/* Show current employee info when editing */}
      {editing && (
        <div className="p-3 bg-background rounded-lg">
          <p className="text-sm font-medium text-foreground">{registration.employee.name}</p>
          <p className="text-xs text-muted-foreground">
            {registration.employee.employeeNo} · {registration.employee.department?.name ?? '-'}
          </p>
        </div>
      )}

      {/* Category & Fitness */}
      <WdRow>
        <WdField label="복무 구분" required htmlFor="military-category">
          <select
            id="military-category"
            name="category"
            value={form.category}
            onChange={handleChange}
            required
            className={INPUT_CLS}
          >
            <option value="OFFICER">장교</option>
            <option value="SOLDIER">병사</option>
            <option value="RESERVIST">예비역</option>
            <option value="EXEMPT">면제</option>
          </select>
        </WdField>
        <WdField label="적합도" required htmlFor="military-fitness-category">
          <select
            id="military-fitness-category"
            name="fitnessCategory"
            value={form.fitnessCategory}
            onChange={handleChange}
            required
            className={INPUT_CLS}
          >
            <option value="FIT_A">적합 A</option>
            <option value="FIT_B">적합 B</option>
            <option value="FIT_C">적합 C</option>
            <option value="FIT_D">적합 D</option>
            <option value="UNFIT">부적합</option>
          </select>
        </WdField>
      </WdRow>

      {/* Rank & Specialty */}
      <WdRow>
        <WdField label="계급" htmlFor="military-rank">
          <input
            id="military-rank"
            type="text"
            name="rank"
            value={form.rank}
            onChange={handleChange}
            placeholder="예: 상사"
            className={INPUT_CLS}
          />
        </WdField>
        <WdField label="군사특기" htmlFor="military-specialty-code">
          <input
            id="military-specialty-code"
            type="text"
            name="specialtyCode"
            value={form.specialtyCode}
            onChange={handleChange}
            placeholder="예: 106A"
            className={INPUT_CLS}
          />
        </WdField>
      </WdRow>

      {/* Military Office */}
      <WdField label="군사기관" htmlFor="military-office">
        <input
          id="military-office"
          type="text"
          name="militaryOffice"
          value={form.militaryOffice}
          onChange={handleChange}
          placeholder="담당 군사기관명"
          className={INPUT_CLS}
        />
      </WdField>

      {/* Dates */}
      <WdRow>
        <WdField label="등록일" htmlFor="military-registration-date">
          <input
            id="military-registration-date"
            type="date"
            name="registrationDate"
            value={form.registrationDate}
            onChange={handleChange}
            className={INPUT_CLS}
          />
        </WdField>
        <WdField label="해제일" htmlFor="military-deregistration-date">
          <input
            id="military-deregistration-date"
            type="date"
            name="deregistrationDate"
            value={form.deregistrationDate}
            onChange={handleChange}
            className={INPUT_CLS}
          />
        </WdField>
      </WdRow>

      {/* Notes */}
      <WdField label="비고" htmlFor="military-notes">
        <textarea
          id="military-notes"
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={3}
          placeholder={'추가 메모'}
          className={`${INPUT_CLS} resize-none`}
        />
      </WdField>

      {/* Error */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}
    </WdDrawer>
  )
}
