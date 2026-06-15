'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 법정의무교육 등록 폼
// Modal: 교육유형 / 과정 / 연도 / 마감일 / 필수시간
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { WdDrawer, WdField, WdRow } from '@/components/shared/WdDrawer'
import { X } from 'lucide-react'

const INPUT_CLS = 'w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus:outline-none'

interface MandatoryTrainingFormProps {
  defaultYear: number
  onClose: () => void
  onSuccess: () => void
}

const TRAINING_TYPES = [
  { value: 'SEXUAL_HARASSMENT', label: '성희롱 예방교육' },
  { value: 'WORKPLACE_BULLYING', label: '직장 내 괴롭힘 예방교육' },
  { value: 'PERSONAL_INFO', label: '개인정보보호 교육' },
  { value: 'SAFETY_HEALTH', label: '안전보건 교육' },
  { value: 'DISABILITY_AWARENESS', label: '장애인 인식개선 교육' },
]

const COURSE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  SEXUAL_HARASSMENT: [
    { value: 'sh-basic', label: '직장 내 성희롱 예방 기초' },
    { value: 'sh-advanced', label: '직장 내 성희롱 예방 심화' },
  ],
  WORKPLACE_BULLYING: [
    { value: 'wb-basic', label: '직장 내 괴롭힘 방지 교육' },
    { value: 'wb-management', label: '관리자 괴롭힘 예방 과정' },
  ],
  PERSONAL_INFO: [
    { value: 'pi-general', label: '개인정보 처리 및 보호 실무' },
    { value: 'pi-gdpr', label: 'GDPR 및 개인정보보호법 개요' },
  ],
  SAFETY_HEALTH: [
    { value: 'sh-basic', label: '산업안전보건 기초 과정' },
    { value: 'sh-hazard', label: '위험성 평가 실무' },
  ],
  DISABILITY_AWARENESS: [
    { value: 'da-general', label: '장애인식 개선 연간 교육' },
    { value: 'da-inclusion', label: '장애인 포용 직장문화 교육' },
  ],
}

interface FormData {
  trainingType: string
  courseId: string
  year: number
  dueDate: string
  requiredHours: number
}

export default function MandatoryTrainingForm({
  defaultYear,
  onClose,
  onSuccess,
}: MandatoryTrainingFormProps) {
  const [form, setForm] = useState<FormData>({
    trainingType: '',
    courseId: '',
    year: defaultYear,
    dueDate: '',
    requiredHours: 1,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const courseOptions = form.trainingType ? (COURSE_OPTIONS[form.trainingType] ?? []) : []

  const handleChange = (field: keyof FormData, value: string | number) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value }
      // Reset course when training type changes
      if (field === 'trainingType') {
        updated.courseId = ''
      }
      return updated
    })
    setError(null)
  }

  const handleSubmit = async () => {
    if (!form.trainingType) {
      setError('교육 유형을 선택해주세요.')
      return
    }
    if (!form.courseId) {
      setError('과정을 선택해주세요.')
      return
    }
    if (!form.dueDate) {
      setError('마감일을 입력해주세요.')
      return
    }
    // WdDrawer primary는 form submit이 아니므로 native min/max가 강제되지 않음 → 명시적 검증
    if (!Number.isInteger(form.requiredHours) || form.requiredHours < 1 || form.requiredHours > 40) {
      setError('교육 시간은 1~40 사이의 정수여야 합니다.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/v1/compliance/kr/mandatory-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? '교육 등록에 실패했습니다.')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : '교육 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <WdDrawer
      open
      onClose={onClose}
      title="법정의무교육 추가"
      closeDisabled={submitting}
      secondary={{ label: '취소', onClick: onClose, disabled: submitting }}
      primary={{ label: submitting ? '등록 중...' : '교육 추가', onClick: handleSubmit, disabled: submitting }}
    >
      {/* Training Type */}
      <WdField label="교육 유형" required htmlFor="mandtrain-training-type">
        <select
          id="mandtrain-training-type"
          className={INPUT_CLS}
          value={form.trainingType}
          onChange={(e) => handleChange('trainingType', e.target.value)}
        >
          <option value="">교육 유형 선택</option>
          {TRAINING_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </WdField>

      {/* Course Selector */}
      <WdField label="과정" required htmlFor="mandtrain-course">
        <select
          id="mandtrain-course"
          className={INPUT_CLS}
          value={form.courseId}
          onChange={(e) => handleChange('courseId', e.target.value)}
          disabled={!form.trainingType}
        >
          <option value="">
            {form.trainingType ? '과정 선택' : '교육 유형을 먼저 선택하세요'}
          </option>
          {courseOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </WdField>

      {/* Year + Due Date */}
      <WdRow>
        <WdField label="대상 연도" required htmlFor="mandtrain-year">
          <select
            id="mandtrain-year"
            className={INPUT_CLS}
            value={form.year}
            onChange={(e) => handleChange('year', Number(e.target.value))}
          >
            {[defaultYear + 1, defaultYear, defaultYear - 1].map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </WdField>

        <WdField label="이수 마감일" required htmlFor="mandtrain-due-date">
          <input
            id="mandtrain-due-date"
            type="date"
            className={INPUT_CLS}
            value={form.dueDate}
            onChange={(e) => handleChange('dueDate', e.target.value)}
          />
        </WdField>
      </WdRow>

      {/* Required Hours */}
      <WdField label="필수 이수시간 (시간)" htmlFor="mandtrain-required-hours">
        <input
          id="mandtrain-required-hours"
          type="number"
          min={1}
          max={40}
          className={INPUT_CLS}
          value={form.requiredHours}
          onChange={(e) => handleChange('requiredHours', Number(e.target.value))}
          placeholder="1"
        />
        <p className="text-xs text-muted-foreground mt-1">법정 최소 이수시간을 입력하세요.</p>
      </WdField>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-destructive/10 border border-destructive/20 rounded-lg">
          <X className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </WdDrawer>
  )
}
