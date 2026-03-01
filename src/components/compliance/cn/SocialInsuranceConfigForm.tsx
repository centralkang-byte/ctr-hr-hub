'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { apiClient } from '@/lib/api'

interface SocialInsuranceConfig {
  id: string
  insuranceType: string
  city: string
  employerRate: number
  employeeRate: number
  baseMin: number
  baseMax: number
  effectiveFrom: string
  effectiveTo: string | null
  isActive: boolean
}

interface SocialInsuranceConfigFormProps {
  config: SocialInsuranceConfig | null
  onClose: (refresh?: boolean) => void
}

const INSURANCE_TYPES = [
  { value: 'PENSION', label: '양로보험 (养老保险)' },
  { value: 'MEDICAL', label: '의료보험 (医疗保险)' },
  { value: 'UNEMPLOYMENT', label: '실업보험 (失业保险)' },
  { value: 'WORK_INJURY', label: '산재보험 (工伤保险)' },
  { value: 'MATERNITY_INS', label: '생육보험 (生育保险)' },
  { value: 'HOUSING_FUND', label: '주택적립금 (住房公积金)' },
]

export default function SocialInsuranceConfigForm({
  config,
  onClose,
}: SocialInsuranceConfigFormProps) {
  const isEdit = config !== null
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    insuranceType: config?.insuranceType ?? '',
    city: config?.city ?? '',
    employerRate: config?.employerRate?.toString() ?? '',
    employeeRate: config?.employeeRate?.toString() ?? '',
    baseMin: config?.baseMin?.toString() ?? '',
    baseMax: config?.baseMax?.toString() ?? '',
    effectiveFrom: config?.effectiveFrom
      ? config.effectiveFrom.split('T')[0]
      : '',
    effectiveTo: config?.effectiveTo
      ? config.effectiveTo.split('T')[0]
      : '',
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const payload = {
        insuranceType: form.insuranceType,
        city: form.city,
        employerRate: parseFloat(form.employerRate),
        employeeRate: parseFloat(form.employeeRate),
        baseMin: parseFloat(form.baseMin),
        baseMax: parseFloat(form.baseMax),
        effectiveFrom: new Date(form.effectiveFrom).toISOString(),
        ...(form.effectiveTo
          ? { effectiveTo: new Date(form.effectiveTo).toISOString() }
          : {}),
      }

      if (isEdit) {
        await apiClient.put(
          `/api/v1/compliance/cn/social-insurance/config/${config.id}`,
          payload,
        )
      } else {
        await apiClient.post(
          '/api/v1/compliance/cn/social-insurance/config',
          payload,
        )
      }

      onClose(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? '사회보험 요율 수정' : '사회보험 요율 추가'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Insurance Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              보험 유형 <span className="text-red-500">*</span>
            </label>
            <select
              name="insuranceType"
              value={form.insuranceType}
              onChange={handleChange}
              required
              disabled={isEdit}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">선택하세요</option>
              {INSURANCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              도시 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="city"
              value={form.city}
              onChange={handleChange}
              required
              placeholder="예: 上海, 北京"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
            />
          </div>

          {/* Rates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                회사 부담률 (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="employerRate"
                value={form.employerRate}
                onChange={handleChange}
                required
                min="0"
                max="100"
                step="0.01"
                placeholder="예: 16.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                직원 부담률 (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="employeeRate"
                value={form.employeeRate}
                onChange={handleChange}
                required
                min="0"
                max="100"
                step="0.01"
                placeholder="예: 8.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Base Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                기수 하한 (CNY) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="baseMin"
                value={form.baseMin}
                onChange={handleChange}
                required
                min="0"
                step="1"
                placeholder="예: 3000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                기수 상한 (CNY) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="baseMax"
                value={form.baseMax}
                onChange={handleChange}
                required
                min="0"
                step="1"
                placeholder="예: 30000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Effective Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                적용 시작일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="effectiveFrom"
                value={form.effectiveFrom}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                적용 종료일
              </label>
              <input
                type="date"
                name="effectiveTo"
                value={form.effectiveTo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => onClose()}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '저장 중...' : isEdit ? '수정' : '추가'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
