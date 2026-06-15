'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — KEDO Document Form Modal
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { WdDrawer, WdField, WdRow } from '@/components/shared/WdDrawer'
import { apiClient } from '@/lib/api'

const INPUT_CLS = 'w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus:outline-none'

interface KedoDocument {
  id: string
  employeeId: string
  documentType: string
  title: string
  content: string | null
  status: string
  signatureLevel: string | null
  expiresAt: string | null
  employee: { id: string; name: string; employeeNo: string }
}

interface Props {
  document: KedoDocument | null
  onClose: () => void
  onSuccess: () => void
}

export default function KedoDocumentForm({ document, onClose, onSuccess }: Props) {
  const editing = document !== null

  const [form, setForm] = useState({
    employeeId: document?.employeeId ?? '',
    documentType: document?.documentType ?? 'EMPLOYMENT_CONTRACT',
    title: document?.title ?? '',
    content: document?.content ?? '',
    signatureLevel: document?.signatureLevel ?? 'UNEP',
    expiresAt: document?.expiresAt ? document.expiresAt.slice(0, 10) : '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async () => {
    // WdDrawer primary는 form submit이 아니므로 native required가 강제되지 않음 → 명시적 검증
    if ((!editing && !form.employeeId.trim()) || !form.title.trim()) {
      setError('필수 항목이 누락되었습니다.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const payload = {
        ...form,
        content: form.content || undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      }

      if (editing) {
        await apiClient.put(`/api/v1/compliance/ru/kedo/${document.id}`, payload)
      } else {
        await apiClient.post('/api/v1/compliance/ru/kedo', payload)
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
      title={editing ? 'KEDO 문서 수정' : 'KEDO 문서 생성'}
      closeDisabled={saving}
      secondary={{ label: '취소', onClick: onClose, disabled: saving }}
      primary={{ label: saving ? '저장 중...' : editing ? '수정' : '생성', onClick: handleSubmit, disabled: saving }}
    >
      {/* Employee ID (only when creating) */}
      {!editing && (
        <WdField label="직원 ID" required htmlFor="kedo-employee-id">
          <input
            id="kedo-employee-id"
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

      {editing && (
        <div className="p-3 bg-background rounded-lg">
          <p className="text-sm font-medium text-foreground">{document.employee.name}</p>
          <p className="text-xs text-muted-foreground">{document.employee.employeeNo}</p>
        </div>
      )}

      {/* Document Type */}
      <WdField label="문서 유형" required htmlFor="kedo-document-type">
        <select
          id="kedo-document-type"
          name="documentType"
          value={form.documentType}
          onChange={handleChange}
          required
          disabled={editing}
          className={INPUT_CLS}
        >
          <option value="EMPLOYMENT_CONTRACT">근로계약서</option>
          <option value="SUPPLEMENTARY_AGREEMENT">부속합의서</option>
          <option value="TRANSFER_ORDER">이동명령</option>
          <option value="VACATION_ORDER">휴가명령</option>
          <option value="DISMISSAL_ORDER">해고명령</option>
          <option value="SALARY_CHANGE">급여변경</option>
          <option value="DISCIPLINARY_ORDER">징계명령</option>
        </select>
      </WdField>

      {/* Title */}
      <WdField label="제목" required htmlFor="kedo-title">
        <input
          id="kedo-title"
          type="text"
          name="title"
          value={form.title}
          onChange={handleChange}
          required
          placeholder={'문서 제목'}
          className={INPUT_CLS}
        />
      </WdField>

      {/* Signature Level & Expires At */}
      <WdRow>
        <WdField label="서명 수준" htmlFor="kedo-signature-level">
          <select
            id="kedo-signature-level"
            name="signatureLevel"
            value={form.signatureLevel}
            onChange={handleChange}
            className={INPUT_CLS}
          >
            <option value="PEP">PEP (간이)</option>
            <option value="UNEP">УНЭП (강화 비인증)</option>
            <option value="UKEP">УКЭП (강화 인증)</option>
          </select>
        </WdField>
        <WdField label="만료일" htmlFor="kedo-expires-at">
          <input
            id="kedo-expires-at"
            type="date"
            name="expiresAt"
            value={form.expiresAt}
            onChange={handleChange}
            className={INPUT_CLS}
          />
        </WdField>
      </WdRow>

      {/* Content */}
      <WdField label="문서 내용" htmlFor="kedo-content">
        <textarea
          id="kedo-content"
          name="content"
          value={form.content}
          onChange={handleChange}
          rows={4}
          placeholder={'문서 내용 (선택)'}
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
