'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { WdDrawer, WdField } from '@/components/shared/WdDrawer'
import { apiClient } from '@/lib/api'
import type { Dpia } from './DpiaTabContent'

const INPUT_CLS = 'w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus:outline-none'

interface DpiaFormProps {
  open: boolean
  dpia: Dpia | null
  onClose: () => void
  onSaved: () => void
}

export default function DpiaForm({ open, dpia, onClose, onSaved }: DpiaFormProps) {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const RISK_LEVELS = [
    { value: 'LOW', label: t('gdpr.riskLow') },
    { value: 'MEDIUM', label: t('gdpr.riskMedium') },
    { value: 'HIGH', label: t('gdpr.riskHigh') },
    { value: 'CRITICAL', label: t('gdpr.riskCritical') },
  ]

  const STATUS_OPTIONS = [
    { value: 'DPIA_DRAFT', label: t('gdpr.statusDraft') },
    { value: 'IN_REVIEW', label: t('gdpr.statusInReview') },
    { value: 'APPROVED', label: t('gdpr.statusApproved') },
    { value: 'REJECTED', label: t('gdpr.statusRejected') },
  ]

  const isEdit = Boolean(dpia)

  const [form, setForm] = useState({
    title: '',
    description: '',
    processingScope: '',
    riskLevel: 'MEDIUM',
    mitigations: '',
    status: 'DPIA_DRAFT',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (dpia) {
      setForm({
        title: dpia.title ?? '',
        description: dpia.description ?? '',
        processingScope: dpia.processingScope ?? '',
        riskLevel: dpia.riskLevel ?? 'MEDIUM',
        mitigations: dpia.mitigations ?? '',
        status: dpia.status ?? 'DPIA_DRAFT',
      })
    } else {
      setForm({ title: '', description: '', processingScope: '', riskLevel: 'MEDIUM', mitigations: '', status: 'DPIA_DRAFT' })
    }
    setError('')
  }, [open, dpia])

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.title || !form.processingScope) {
      setError(tc('required'))
      return
    }
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        // 수정 시엔 비운 optional 필드(설명·완화조치)도 항상 전송해 기존 값을 지울 수 있게 함
        await apiClient.put(`/api/v1/compliance/gdpr/dpia/${dpia!.id}`, {
          title: form.title,
          description: form.description,
          processingScope: form.processingScope,
          riskLevel: form.riskLevel,
          mitigations: form.mitigations,
          status: form.status,
        })
      } else {
        await apiClient.post('/api/v1/compliance/gdpr/dpia', {
          title: form.title,
          ...(form.description ? { description: form.description } : {}),
          processingScope: form.processingScope,
          riskLevel: form.riskLevel,
          ...(form.mitigations ? { mitigations: form.mitigations } : {}),
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
      title={`${isEdit ? tc('edit') : tc('create')} — ${t('gdpr.dpia')}`}
      closeDisabled={saving}
      secondary={{ label: tc('cancel'), onClick: onClose, disabled: saving }}
      primary={{ label: saving ? tc('loading') : tc('save'), onClick: () => void handleSubmit(), disabled: saving }}
    >
      <WdField label={tc('title')} required htmlFor="dpia-title">
        <input
          id="dpia-title"
          type="text"
          className={INPUT_CLS}
          value={form.title}
          onChange={(e) => handleChange('title', e.target.value)}
        />
      </WdField>

      <WdField label={tc('description')} htmlFor="dpia-description">
        <textarea
          id="dpia-description"
          className={`${INPUT_CLS} resize-none`}
          rows={3}
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </WdField>

      <WdField label={t('gdpr.processingScope')} required htmlFor="dpia-processing-scope">
        <textarea
          id="dpia-processing-scope"
          className={`${INPUT_CLS} resize-none`}
          rows={4}
          value={form.processingScope}
          onChange={(e) => handleChange('processingScope', e.target.value)}
        />
      </WdField>

      <WdField label={t('gdpr.riskLevel')}>
        <div role="group" aria-label={t('gdpr.riskLevel')} className="grid grid-cols-4 gap-2">
          {RISK_LEVELS.map((rl) => (
            <button
              key={rl.value}
              type="button"
              onClick={() => handleChange('riskLevel', rl.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                form.riskLevel === rl.value
                  ? rl.value === 'LOW' ? 'bg-emerald-600 text-white border-emerald-600'
                  : rl.value === 'MEDIUM' ? 'bg-amber-500/100 text-white border-amber-500'
                  : rl.value === 'HIGH' ? 'bg-orange-500/100 text-white border-orange-500'
                  : 'bg-red-600 text-white border-red-600'
                  : 'bg-card text-muted-foreground border-border hover:bg-background'
              }`}
            >
              {rl.label}
            </button>
          ))}
        </div>
      </WdField>

      <WdField label={t('gdpr.mitigations')} htmlFor="dpia-mitigations">
        <textarea
          id="dpia-mitigations"
          className={`${INPUT_CLS} resize-none`}
          rows={4}
          value={form.mitigations}
          onChange={(e) => handleChange('mitigations', e.target.value)}
        />
      </WdField>

      {isEdit && (
        <WdField label={tc('status')} htmlFor="dpia-status">
          <select
            id="dpia-status"
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

      {error && <p className="text-sm text-destructive">{error}</p>}
    </WdDrawer>
  )
}
