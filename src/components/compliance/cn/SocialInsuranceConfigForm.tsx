'use client'

import { useState } from 'react'
import { WdDrawer, WdField, WdRow } from '@/components/shared/WdDrawer'
import { apiClient } from '@/lib/api'

const INPUT_CLS = 'w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus:outline-none'

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
  deletedAt: string | null
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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    // WdDrawer primary는 form submit이 아니므로 native required가 강제되지 않음 → 명시적 검증
    if (
      !form.insuranceType ||
      !form.city.trim() ||
      !form.employerRate ||
      !form.employeeRate ||
      !form.baseMin ||
      !form.baseMax ||
      !form.effectiveFrom
    ) {
      setError('필수 항목이 누락되었습니다.')
      return
    }
    // native min/max/step가 강제되지 않으므로 범위 명시 검증
    const employerRate = parseFloat(form.employerRate)
    const employeeRate = parseFloat(form.employeeRate)
    if (employerRate < 0 || employerRate > 100 || employeeRate < 0 || employeeRate > 100) {
      setError('부담률은 0~100% 범위여야 합니다.')
      return
    }
    if (parseFloat(form.baseMin) < 0 || parseFloat(form.baseMax) < 0) {
      setError('기수는 0 이상이어야 합니다.')
      return
    }
    // step 복원: 부담률 0.01 단위(소수 2자리)·기수 정수
    const isTwoDecimals = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim())
    if (!isTwoDecimals(form.employerRate) || !isTwoDecimals(form.employeeRate)) {
      setError('부담률은 소수점 둘째 자리까지 입력 가능합니다.')
      return
    }
    if (!Number.isInteger(parseFloat(form.baseMin)) || !Number.isInteger(parseFloat(form.baseMax))) {
      setError('기수는 정수로 입력하세요.')
      return
    }
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
    <WdDrawer
      open
      onClose={() => onClose()}
      title={isEdit ? '사회보험 요율 수정' : '사회보험 요율 추가'}
      closeDisabled={submitting}
      secondary={{ label: '취소', onClick: () => onClose(), disabled: submitting }}
      primary={{ label: submitting ? '저장 중...' : isEdit ? '수정' : '추가', onClick: handleSubmit, disabled: submitting }}
    >
      {/* Insurance Type */}
      <WdField label="보험 유형" required htmlFor="social-insurance-type">
        <select
          id="social-insurance-type"
          name="insuranceType"
          value={form.insuranceType}
          onChange={handleChange}
          required
          disabled={isEdit}
          className={INPUT_CLS}
        >
          <option value="">선택하세요</option>
          {INSURANCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </WdField>

      {/* City */}
      <WdField label="도시" required htmlFor="social-city">
        <input
          id="social-city"
          type="text"
          name="city"
          value={form.city}
          onChange={handleChange}
          required
          placeholder="예: 上海, 北京"
          className={INPUT_CLS}
        />
      </WdField>

      {/* Rates */}
      <WdRow>
        <WdField label="회사 부담률 (%)" required htmlFor="social-employer-rate">
          <input
            id="social-employer-rate"
            type="number"
            name="employerRate"
            value={form.employerRate}
            onChange={handleChange}
            required
            min="0"
            max="100"
            step="0.01"
            placeholder="예: 16.00"
            className={INPUT_CLS}
          />
        </WdField>
        <WdField label="직원 부담률 (%)" required htmlFor="social-employee-rate">
          <input
            id="social-employee-rate"
            type="number"
            name="employeeRate"
            value={form.employeeRate}
            onChange={handleChange}
            required
            min="0"
            max="100"
            step="0.01"
            placeholder="예: 8.00"
            className={INPUT_CLS}
          />
        </WdField>
      </WdRow>

      {/* Base Range */}
      <WdRow>
        <WdField label="기수 하한 (CNY)" required htmlFor="social-base-min">
          <input
            id="social-base-min"
            type="number"
            name="baseMin"
            value={form.baseMin}
            onChange={handleChange}
            required
            min="0"
            step="1"
            placeholder="예: 3000"
            className={INPUT_CLS}
          />
        </WdField>
        <WdField label="기수 상한 (CNY)" required htmlFor="social-base-max">
          <input
            id="social-base-max"
            type="number"
            name="baseMax"
            value={form.baseMax}
            onChange={handleChange}
            required
            min="0"
            step="1"
            placeholder="예: 30000"
            className={INPUT_CLS}
          />
        </WdField>
      </WdRow>

      {/* Effective Dates */}
      <WdRow>
        <WdField label="적용 시작일" required htmlFor="social-effective-from">
          <input
            id="social-effective-from"
            type="date"
            name="effectiveFrom"
            value={form.effectiveFrom}
            onChange={handleChange}
            required
            className={INPUT_CLS}
          />
        </WdField>
        <WdField label="적용 종료일" htmlFor="social-effective-to">
          <input
            id="social-effective-to"
            type="date"
            name="effectiveTo"
            value={form.effectiveTo}
            onChange={handleChange}
            className={INPUT_CLS}
          />
        </WdField>
      </WdRow>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
    </WdDrawer>
  )
}
