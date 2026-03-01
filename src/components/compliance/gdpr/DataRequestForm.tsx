'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface Employee {
  id: string
  name: string
  employee_no: string
}

interface DataRequest {
  id: string
  employee_name: string
  employee_no: string
  request_type: string
  status: string
  description: string
  deadline: string | null
  response_note: string | null
}

interface DataRequestFormProps {
  open: boolean
  request: DataRequest | null
  onClose: () => void
  onSaved: () => void
}

const REQUEST_TYPES = [
  { value: 'ACCESS', label: 'Right to Access' },
  { value: 'ERASURE', label: 'Right to Erasure' },
  { value: 'PORTABILITY', label: 'Data Portability' },
  { value: 'RECTIFICATION', label: 'Rectification' },
  { value: 'RESTRICTION', label: 'Restriction' },
  { value: 'OBJECTION', label: 'Objection' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
]

export default function DataRequestForm({ open, request, onClose, onSaved }: DataRequestFormProps) {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const isEdit = Boolean(request)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [form, setForm] = useState({
    employee_id: '',
    request_type: '',
    description: '',
    deadline: '',
    status: 'pending',
    response_note: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && !isEdit) {
      fetch('/api/v1/employees?page=1&limit=100')
        .then((res) => res.json())
        .then((json) => setEmployees(json.data ?? []))
        .catch(() => {})
    }
    if (request) {
      setForm({
        employee_id: '',
        request_type: request.request_type ?? '',
        description: request.description ?? '',
        deadline: request.deadline ? request.deadline.split('T')[0] : '',
        status: request.status ?? 'pending',
        response_note: request.response_note ?? '',
      })
    } else {
      setForm({ employee_id: '', request_type: '', description: '', deadline: '', status: 'pending', response_note: '' })
    }
  }, [open, request, isEdit])

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!isEdit && !form.employee_id) { setError(tc('required')); return }
    if (!form.request_type || !form.description) { setError(tc('required')); return }

    setSaving(true)
    setError('')
    try {
      const url = isEdit
        ? `/api/v1/compliance/gdpr/requests/${request!.id}`
        : '/api/v1/compliance/gdpr/requests'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed')
      onSaved()
    } catch {
      setError(tc('error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? tc('edit') : tc('new')} — {t('gdpr.requests')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Employee — only for new */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {tc('name')} <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.employee_id}
                onChange={(e) => handleChange('employee_id', e.target.value)}
              >
                <option value="">{tc('selectPlaceholder')}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employee_no})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Request Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('gdpr.requestType')} <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.request_type}
              onChange={(e) => handleChange('request_type', e.target.value)}
            >
              <option value="">{tc('selectPlaceholder')}</option>
              {REQUEST_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {tc('description')} <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              placeholder="Describe the data subject request..."
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('gdpr.deadline')}</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.deadline}
              onChange={(e) => handleChange('deadline', e.target.value)}
            />
          </div>

          {/* Status — only for edit */}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{tc('status')}</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Response Note — only for edit */}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('gdpr.responseNote')}</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
                placeholder="Response or resolution notes..."
                value={form.response_note}
                onChange={(e) => handleChange('response_note', e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
          >
            {saving ? tc('loading') : tc('save')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
