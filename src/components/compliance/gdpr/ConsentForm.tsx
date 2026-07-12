'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { WdDrawer, WdField } from '@/components/shared/WdDrawer'
import { CONSENT_PURPOSES, CONSENT_PURPOSE_LABELS, readApiError } from './gdpr-labels'

const INPUT_CLS = 'w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus:outline-none'

interface Employee {
  id: string
  name: string
  employeeNo: string | null
}

interface ConsentFormProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}



export default function ConsentForm({ open, onClose, onSaved }: ConsentFormProps) {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const [employees, setEmployees] = useState<Employee[]>([])
  const [form, setForm] = useState({
    employeeId: '',
    purpose: '',
    legalBasis: '',
    expiresAt: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      fetch('/api/v1/employees?page=1&limit=100')
        .then((res) => res.json())
        .then((json) => setEmployees(json.data ?? []))
        .catch(() => {})
    }
  }, [open])

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.employeeId || !form.purpose || !form.legalBasis) {
      setError(tc('required'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/v1/compliance/gdpr/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: form.employeeId,
          purpose: form.purpose,
          legalBasis: form.legalBasis,
          // date input(YYYY-MM-DD) → zod datetime 요구라 ISO 로 변환, 미입력 시 생략
          ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt).toISOString() } : {}),
        }),
      })
      if (!res.ok) {
        setError(await readApiError(res, tc('error')))
        return
      }
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
      title={t('gdpr.consentForm')}
      closeDisabled={saving}
      secondary={{ label: tc('cancel'), onClick: onClose, disabled: saving }}
      primary={{ label: saving ? tc('loading') : tc('save'), onClick: handleSubmit, disabled: saving }}
    >
      <WdField label={tc('name')} required htmlFor="consent-employee">
        <select
          id="consent-employee"
          className={INPUT_CLS}
          value={form.employeeId}
          onChange={(e) => handleChange('employeeId', e.target.value)}
        >
          <option value="">{tc('selectPlaceholder')}</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name} ({emp.employeeNo ?? '-'})
            </option>
          ))}
        </select>
      </WdField>

      <WdField label={t('gdpr.purpose')} required htmlFor="consent-purpose">
        <select
          id="consent-purpose"
          className={INPUT_CLS}
          value={form.purpose}
          onChange={(e) => handleChange('purpose', e.target.value)}
        >
          <option value="">{tc('selectPlaceholder')}</option>
          {CONSENT_PURPOSES.map((p) => (
            <option key={p} value={p}>
              {CONSENT_PURPOSE_LABELS[p]}
            </option>
          ))}
        </select>
      </WdField>

      <WdField label={t('gdpr.legalBasis')} required htmlFor="consent-legal-basis">
        <textarea
          id="consent-legal-basis"
          className={`${INPUT_CLS} resize-none`}
          rows={3}
          placeholder="e.g., Art. 6(1)(b) – Contractual necessity"
          value={form.legalBasis}
          onChange={(e) => handleChange('legalBasis', e.target.value)}
        />
      </WdField>

      <WdField label={t('gdpr.expiresAt')} htmlFor="consent-expires-at">
        <input
          id="consent-expires-at"
          type="date"
          className={INPUT_CLS}
          value={form.expiresAt}
          onChange={(e) => handleChange('expiresAt', e.target.value)}
        />
      </WdField>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </WdDrawer>
  )
}
