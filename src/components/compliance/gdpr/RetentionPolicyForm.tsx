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

interface RetentionPolicy {
  id: string
  category: string
  retention_months: number
  description: string
  auto_delete: boolean
  anonymize: boolean
}

interface RetentionPolicyFormProps {
  open: boolean
  policy: RetentionPolicy | null
  onClose: () => void
  onSaved: () => void
}

const DATA_CATEGORIES = [
  'Employee Personal Data',
  'Payroll Records',
  'Performance Reviews',
  'Recruitment Data',
  'Attendance Records',
  'Medical Records',
  'Disciplinary Records',
  'Training Records',
  'CCTV Footage',
  'Biometric Data',
  'Contract Documents',
  'Background Checks',
]

export default function RetentionPolicyForm({ open, policy, onClose, onSaved }: RetentionPolicyFormProps) {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const isEdit = Boolean(policy)

  const [form, setForm] = useState({
    category: '',
    retention_months: 36,
    description: '',
    auto_delete: false,
    anonymize: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (policy) {
      setForm({
        category: policy.category ?? '',
        retention_months: policy.retention_months ?? 36,
        description: policy.description ?? '',
        auto_delete: policy.auto_delete ?? false,
        anonymize: policy.anonymize ?? false,
      })
    } else {
      setForm({ category: '', retention_months: 36, description: '', auto_delete: false, anonymize: false })
    }
    setError('')
  }, [open, policy])

  const handleChange = (field: string, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.category || !form.retention_months) {
      setError(tc('required'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const url = isEdit
        ? `/api/v1/compliance/gdpr/retention-policies/${policy!.id}`
        : '/api/v1/compliance/gdpr/retention-policies'
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
            {isEdit ? tc('edit') : tc('create')} — {t('gdpr.retention')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">
              {tc('category')} <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary"
              value={form.category}
              onChange={(e) => handleChange('category', e.target.value)}
            >
              <option value="">{tc('selectPlaceholder')}</option>
              {DATA_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Retention Months */}
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">
              {t('gdpr.retentionMonths')} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={600}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary"
              value={form.retention_months}
              onChange={(e) => handleChange('retention_months', parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-[#999] mt-1">e.g., 36 = 3 years, 84 = 7 years</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">{tc('description')}</label>
            <textarea
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary resize-none"
              rows={3}
              placeholder="Policy description and legal basis..."
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-background rounded-lg">
              <div>
                <p className="text-sm font-medium text-[#333]">{t('gdpr.autoDelete')}</p>
                <p className="text-xs text-[#999]">Automatically delete data after retention period</p>
              </div>
              <button
                type="button"
                onClick={() => handleChange('auto_delete', !form.auto_delete)}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.auto_delete ? 'bg-primary' : 'bg-border'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-card rounded-full shadow transition-transform ${form.auto_delete ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-background rounded-lg">
              <div>
                <p className="text-sm font-medium text-[#333]">{t('gdpr.anonymize')}</p>
                <p className="text-xs text-[#999]">Anonymize instead of deleting</p>
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
