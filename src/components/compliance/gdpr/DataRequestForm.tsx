'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { WdDrawer, WdField } from '@/components/shared/WdDrawer'

const INPUT_CLS = 'w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus:outline-none'

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

export default function DataRequestForm({ open, request, onClose, onSaved }: DataRequestFormProps) {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const REQUEST_TYPES = [
    { value: 'ACCESS', label: t('gdpr.requestAccess') },
    { value: 'ERASURE', label: t('gdpr.requestErasure') },
    { value: 'PORTABILITY', label: t('gdpr.requestPortability') },
    { value: 'RECTIFICATION', label: t('gdpr.requestRectification') },
    { value: 'RESTRICTION', label: t('gdpr.requestRestriction') },
    { value: 'OBJECTION', label: t('gdpr.requestObjection') },
  ]

  const STATUS_OPTIONS = [
    { value: 'pending', label: t('gdpr.statusPending') },
    { value: 'in_progress', label: t('gdpr.statusInProgress') },
    { value: 'completed', label: t('gdpr.statusCompleted') },
    { value: 'rejected', label: t('gdpr.statusRejected') },
  ]

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
    <WdDrawer
      open={open}
      onClose={onClose}
      title={`${isEdit ? tc('edit') : tc('new')} — ${t('gdpr.requests')}`}
      closeDisabled={saving}
      secondary={{ label: tc('cancel'), onClick: onClose, disabled: saving }}
      primary={{ label: saving ? tc('loading') : tc('save'), onClick: handleSubmit, disabled: saving }}
    >
      {/* Employee — only for new */}
      {!isEdit && (
        <WdField label={tc('name')} required htmlFor="datareq-employee">
          <select
            id="datareq-employee"
            className={INPUT_CLS}
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
        </WdField>
      )}

      {/* Request Type */}
      <WdField label={t('gdpr.requestType')} required htmlFor="datareq-request-type">
        <select
          id="datareq-request-type"
          className={INPUT_CLS}
          value={form.request_type}
          onChange={(e) => handleChange('request_type', e.target.value)}
        >
          <option value="">{tc('selectPlaceholder')}</option>
          {REQUEST_TYPES.map((rt) => (
            <option key={rt.value} value={rt.value}>{rt.label}</option>
          ))}
        </select>
      </WdField>

      {/* Description */}
      <WdField label={tc('description')} required htmlFor="datareq-description">
        <textarea
          id="datareq-description"
          className={`${INPUT_CLS} resize-none`}
          rows={3}
          placeholder="Describe the data subject request..."
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </WdField>

      {/* Deadline */}
      <WdField label={t('gdpr.deadline')} htmlFor="datareq-deadline">
        <input
          id="datareq-deadline"
          type="date"
          className={INPUT_CLS}
          value={form.deadline}
          onChange={(e) => handleChange('deadline', e.target.value)}
        />
      </WdField>

      {/* Status — only for edit */}
      {isEdit && (
        <WdField label={tc('status')} htmlFor="datareq-status">
          <select
            id="datareq-status"
            className={INPUT_CLS}
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </WdField>
      )}

      {/* Response Note — only for edit */}
      {isEdit && (
        <WdField label={t('gdpr.responseNote')} htmlFor="datareq-response-note">
          <textarea
            id="datareq-response-note"
            className={`${INPUT_CLS} resize-none`}
            rows={3}
            placeholder="Response or resolution notes..."
            value={form.response_note}
            onChange={(e) => handleChange('response_note', e.target.value)}
          />
        </WdField>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </WdDrawer>
  )
}
