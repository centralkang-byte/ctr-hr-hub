'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { WdDrawer, WdField } from '@/components/shared/WdDrawer'
import { apiClient } from '@/lib/api'
import type { DataRequest } from './DataRequestsTab'

const INPUT_CLS = 'w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus:outline-none'

interface Employee {
  id: string
  name: string
  employeeNo: string
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
    { value: 'GDPR_PENDING', label: t('gdpr.statusPending') },
    { value: 'IN_PROGRESS', label: t('gdpr.statusInProgress') },
    { value: 'COMPLETED', label: t('gdpr.statusCompleted') },
    { value: 'REJECTED', label: t('gdpr.statusRejected') },
    { value: 'EXPIRED', label: t('gdpr.statusExpired') },
  ]

  const isEdit = Boolean(request)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [form, setForm] = useState({
    employeeId: '',
    requestType: '',
    description: '',
    status: 'GDPR_PENDING',
    responseNote: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && !isEdit) {
      apiClient.getList<Employee>('/api/v1/employees', { page: 1, limit: 100 })
        .then((res) => setEmployees(res.data ?? []))
        .catch(() => setEmployees([]))
    }
    if (request) {
      setForm({
        employeeId: '',
        requestType: request.requestType ?? '',
        description: request.description ?? '',
        status: request.status ?? 'GDPR_PENDING',
        responseNote: request.responseNote ?? '',
      })
    } else {
      setForm({ employeeId: '', requestType: '', description: '', status: 'GDPR_PENDING', responseNote: '' })
    }
    setError('')
  }, [open, request, isEdit])

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!isEdit && !form.employeeId) { setError(tc('required')); return }
    if (!isEdit && !form.requestType) { setError(tc('required')); return }

    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        // responseNote는 비운 채 저장하면 기존 메모를 지워야 하므로 빈 문자열도 항상 전송
        await apiClient.put(`/api/v1/compliance/gdpr/requests/${request!.id}`, {
          status: form.status,
          responseNote: form.responseNote,
        })
      } else {
        await apiClient.post('/api/v1/compliance/gdpr/requests', {
          employeeId: form.employeeId,
          requestType: form.requestType,
          ...(form.description ? { description: form.description } : {}),
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : tc('error'))
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
      primary={{ label: saving ? tc('loading') : tc('save'), onClick: () => void handleSubmit(), disabled: saving }}
    >
      {/* Employee — only for new */}
      {!isEdit && (
        <WdField label={tc('name')} required htmlFor="datareq-employee">
          <select
            id="datareq-employee"
            className={INPUT_CLS}
            value={form.employeeId}
            onChange={(e) => handleChange('employeeId', e.target.value)}
          >
            <option value="">{tc('selectPlaceholder')}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.employeeNo})
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
          value={form.requestType}
          onChange={(e) => handleChange('requestType', e.target.value)}
          disabled={isEdit}
        >
          <option value="">{tc('selectPlaceholder')}</option>
          {REQUEST_TYPES.map((rt) => (
            <option key={rt.value} value={rt.value}>{rt.label}</option>
          ))}
        </select>
      </WdField>

      {/* Description — only editable on create */}
      <WdField label={tc('description')} htmlFor="datareq-description">
        <textarea
          id="datareq-description"
          className={`${INPUT_CLS} resize-none`}
          rows={3}
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          readOnly={isEdit}
        />
      </WdField>

      {/* Deadline: 서버가 접수일 기준 자동 산정 — 생성 시 안내, 수정 시 read-only 표시 */}
      {isEdit ? (
        <WdField label={t('gdpr.deadline')} htmlFor="datareq-deadline">
          <input
            id="datareq-deadline"
            type="text"
            className={`${INPUT_CLS} read-only:bg-background`}
            value={request?.deadline ? new Date(request.deadline).toLocaleDateString() : '-'}
            readOnly
          />
        </WdField>
      ) : (
        <p className="text-xs text-muted-foreground">{t('gdpr.deadlineAutoNote')}</p>
      )}

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
            value={form.responseNote}
            onChange={(e) => handleChange('responseNote', e.target.value)}
          />
        </WdField>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </WdDrawer>
  )
}
