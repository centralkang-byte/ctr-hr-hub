'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — KEDO Document Form Modal
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'KEDO 문서 수정' : 'KEDO 문서 생성'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee ID (only when creating) */}
          {!editing && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                직원 ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="employeeId"
                value={form.employeeId}
                onChange={handleChange}
                required
                placeholder="직원 UUID 입력"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
              />
            </div>
          )}

          {editing && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-900">{document.employee.name}</p>
              <p className="text-xs text-slate-500">{document.employee.employeeNo}</p>
            </div>
          )}

          {/* Document Type */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              문서 유형 <span className="text-red-500">*</span>
            </label>
            <select
              name="documentType"
              value={form.documentType}
              onChange={handleChange}
              required
              disabled={editing}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              <option value="EMPLOYMENT_CONTRACT">근로계약서</option>
              <option value="SUPPLEMENTARY_AGREEMENT">부속합의서</option>
              <option value="TRANSFER_ORDER">이동명령</option>
              <option value="VACATION_ORDER">휴가명령</option>
              <option value="DISMISSAL_ORDER">해고명령</option>
              <option value="SALARY_CHANGE">급여변경</option>
              <option value="DISCIPLINARY_ORDER">징계명령</option>
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              placeholder="문서 제목"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
            />
          </div>

          {/* Signature Level & Expires At */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">서명 수준</label>
              <select
                name="signatureLevel"
                value={form.signatureLevel}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="PEP">PEP (간이)</option>
                <option value="UNEP">УНЭП (강화 비인증)</option>
                <option value="UKEP">УКЭП (강화 인증)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">만료일</label>
              <input
                type="date"
                name="expiresAt"
                value={form.expiresAt}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">문서 내용</label>
            <textarea
              name="content"
              value={form.content}
              onChange={handleChange}
              rows={4}
              placeholder="문서 내용 (선택)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              {saving ? '저장 중...' : editing ? '수정' : '생성'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
