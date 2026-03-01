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

interface ConsentFormProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const PURPOSE_OPTIONS = [
  'Employment Contract',
  'Payroll Processing',
  'Performance Management',
  'Health & Safety',
  'Marketing Communications',
  'Third-party Data Sharing',
  'CCTV Monitoring',
  'Biometric Data',
]

export default function ConsentForm({ open, onClose, onSaved }: ConsentFormProps) {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const [employees, setEmployees] = useState<Employee[]>([])
  const [form, setForm] = useState({
    employee_id: '',
    purpose: '',
    legal_basis: '',
    expires_at: '',
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
    if (!form.employee_id || !form.purpose || !form.legal_basis) {
      setError(tc('required'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/v1/compliance/gdpr/consents', {
        method: 'POST',
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
          <DialogTitle>{t('gdpr.consentForm')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Employee Selector */}
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

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('gdpr.purpose')} <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.purpose}
              onChange={(e) => handleChange('purpose', e.target.value)}
            >
              <option value="">{tc('selectPlaceholder')}</option>
              {PURPOSE_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Legal Basis */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('gdpr.legalBasis')} <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              placeholder="e.g., Art. 6(1)(b) – Contractual necessity"
              value={form.legal_basis}
              onChange={(e) => handleChange('legal_basis', e.target.value)}
            />
          </div>

          {/* Expires At */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('gdpr.expiresAt')}
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.expires_at}
              onChange={(e) => handleChange('expires_at', e.target.value)}
            />
          </div>

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
