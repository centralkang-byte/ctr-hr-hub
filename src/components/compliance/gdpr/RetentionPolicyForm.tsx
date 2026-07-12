'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { WdDrawer, WdField } from '@/components/shared/WdDrawer'
import {
  RETENTION_CATEGORIES,
  RETENTION_CATEGORY_LABELS,
  readApiError,
} from './gdpr-labels'

const INPUT_CLS = 'w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus:outline-none'

interface RetentionPolicy {
  id: string
  category: string
  retentionMonths: number
  description: string | null
  autoDelete: boolean
  anonymize: boolean
}

interface RetentionPolicyFormProps {
  open: boolean
  policy: RetentionPolicy | null
  onClose: () => void
  onSaved: () => void
}

export default function RetentionPolicyForm({ open, policy, onClose, onSaved }: RetentionPolicyFormProps) {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const isEdit = Boolean(policy)

  // 백엔드 계약(camelCase, retentionPolicyCreateSchema)과 1:1 — anonymize 기본값도 서버와 동일(true)
  const [form, setForm] = useState({
    category: '',
    retentionMonths: 36,
    description: '',
    autoDelete: false,
    anonymize: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (policy) {
      setForm({
        category: policy.category ?? '',
        retentionMonths: policy.retentionMonths ?? 36,
        description: policy.description ?? '',
        autoDelete: policy.autoDelete ?? false,
        anonymize: policy.anonymize ?? true,
      })
    } else {
      setForm({ category: '', retentionMonths: 36, description: '', autoDelete: false, anonymize: true })
    }
    setError('')
  }, [open, policy])

  const handleChange = (field: string, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.category || !form.retentionMonths || form.retentionMonths < 1 || form.retentionMonths > 600) {
      setError(tc('required'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const url = isEdit
        ? `/api/v1/compliance/gdpr/retention/${policy!.id}`
        : '/api/v1/compliance/gdpr/retention'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category,
          retentionMonths: form.retentionMonths,
          description: form.description || undefined,
          autoDelete: form.autoDelete,
          anonymize: form.anonymize,
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
      title={`${isEdit ? tc('edit') : tc('create')} — ${t('gdpr.retention')}`}
      closeDisabled={saving}
      secondary={{ label: tc('cancel'), onClick: onClose, disabled: saving }}
      primary={{ label: saving ? tc('loading') : tc('save'), onClick: handleSubmit, disabled: saving }}
    >
      {/* Category — 백엔드 enum 9종 (편집 시 카테고리는 unique 키라 변경 잠금) */}
      <WdField label={tc('category')} required htmlFor="retention-category">
        <select
          id="retention-category"
          className={INPUT_CLS}
          value={form.category}
          disabled={isEdit}
          onChange={(e) => handleChange('category', e.target.value)}
        >
          <option value="">{tc('selectPlaceholder')}</option>
          {RETENTION_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{RETENTION_CATEGORY_LABELS[cat]}</option>
          ))}
        </select>
      </WdField>

      {/* Retention Months */}
      <WdField label={t('gdpr.retentionMonths')} required htmlFor="retention-months">
        <input
          id="retention-months"
          type="number"
          min={1}
          max={600}
          className={INPUT_CLS}
          value={form.retentionMonths}
          onChange={(e) => handleChange('retentionMonths', parseInt(e.target.value) || 0)}
        />
        <p className="text-xs text-muted-foreground mt-1">e.g., 36 = 3 years, 84 = 7 years</p>
      </WdField>

      {/* Description */}
      <WdField label={tc('description')} htmlFor="retention-description">
        <textarea
          id="retention-description"
          className={`${INPUT_CLS} resize-none`}
          rows={3}
          placeholder="Policy description and legal basis..."
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </WdField>

      {/* Toggles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-background rounded-lg">
          <div>
            <p className="text-sm font-medium text-foreground">{t('gdpr.autoDelete')}</p>
            <p className="text-xs text-muted-foreground">Automatically delete data after retention period</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('autoDelete', !form.autoDelete)}
            className={`relative w-10 h-5 rounded-full transition-colors ${form.autoDelete ? 'bg-primary' : 'bg-border'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-card rounded-full shadow transition-transform ${form.autoDelete ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between p-3 bg-background rounded-lg">
          <div>
            <p className="text-sm font-medium text-foreground">{t('gdpr.anonymize')}</p>
            <p className="text-xs text-muted-foreground">Anonymize instead of deleting</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('anonymize', !form.anonymize)}
            className={`relative w-10 h-5 rounded-full transition-colors ${form.anonymize ? 'bg-primary' : 'bg-border'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-card rounded-full shadow transition-transform ${form.anonymize ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </WdDrawer>
  )
}
