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
import { BUTTON_VARIANTS } from '@/lib/styles'

interface Dpia {
  id: string
  title: string
  description: string
  processing_scope: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  mitigations: string
  status: string
}

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
    { value: 'low', label: t('gdpr.riskLow') },
    { value: 'medium', label: t('gdpr.riskMedium') },
    { value: 'high', label: t('gdpr.riskHigh') },
    { value: 'critical', label: t('gdpr.riskCritical') },
  ]

  const STATUS_OPTIONS = [
    { value: 'draft', label: t('gdpr.statusDraft') },
    { value: 'in_review', label: t('gdpr.statusInReview') },
    { value: 'approved', label: t('gdpr.statusApproved') },
    { value: 'rejected', label: t('gdpr.statusRejected') },
  ]

  const isEdit = Boolean(dpia)

  const [form, setForm] = useState({
    title: '',
    description: '',
    processing_scope: '',
    risk_level: 'medium',
    mitigations: '',
    status: 'draft',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (dpia) {
      setForm({
        title: dpia.title ?? '',
        description: dpia.description ?? '',
        processing_scope: dpia.processing_scope ?? '',
        risk_level: dpia.risk_level ?? 'medium',
        mitigations: dpia.mitigations ?? '',
        status: dpia.status ?? 'draft',
      })
    } else {
      setForm({ title: '', description: '', processing_scope: '', risk_level: 'medium', mitigations: '', status: 'draft' })
    }
    setError('')
  }, [open, dpia])

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.title || !form.processing_scope) {
      setError(tc('required'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const url = isEdit
        ? `/api/v1/compliance/gdpr/dpia/${dpia!.id}`
        : '/api/v1/compliance/gdpr/dpia'
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? tc('edit') : tc('create')} — {t('gdpr.dpia')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">
              {tc('name')} / Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary"
              placeholder="e.g., Employee Biometric Attendance System DPIA"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">{tc('description')}</label>
            <textarea
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary resize-none"
              rows={3}
              placeholder="Describe the data processing activity..."
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>

          {/* Processing Scope */}
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">
              {t('gdpr.processingScope')} <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary resize-none"
              rows={4}
              placeholder="Describe what personal data is processed, how, and by whom..."
              value={form.processing_scope}
              onChange={(e) => handleChange('processing_scope', e.target.value)}
            />
          </div>

          {/* Risk Level */}
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">{t('gdpr.riskLevel')}</label>
            <div className="grid grid-cols-4 gap-2">
              {RISK_LEVELS.map((rl) => (
                <button
                  key={rl.value}
                  type="button"
                  onClick={() => handleChange('risk_level', rl.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.risk_level === rl.value
                      ? rl.value === 'low' ? 'bg-emerald-600 text-white border-emerald-600'
                      : rl.value === 'medium' ? 'bg-amber-500 text-white border-amber-500'
                      : rl.value === 'high' ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-red-600 text-white border-red-600'
                      : 'bg-card text-[#555] border-border hover:bg-background'
                  }`}
                >
                  {rl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mitigations */}
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">{t('gdpr.mitigations')}</label>
            <textarea
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary resize-none"
              rows={4}
              placeholder="Describe risk mitigation measures..."
              value={form.mitigations}
              onChange={(e) => handleChange('mitigations', e.target.value)}
            />
          </div>

          {/* Status */}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">{tc('status')}</label>
              <select
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary"
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            className="bg-card border border-border hover:bg-background text-[#333] px-4 py-2 rounded-lg font-medium text-sm"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50`}
          >
            {saving ? tc('loading') : tc('save')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
