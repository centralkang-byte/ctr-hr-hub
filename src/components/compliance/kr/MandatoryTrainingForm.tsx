'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 법정의무교육 등록 폼
// Modal: 교육유형 / 과정 / 연도 / 마감일 / 필수시간
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { X, BookOpen } from 'lucide-react'

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50">
              <BookOpen className="w-4 h-4 text-blue-600" />
            </div>
            <DialogTitle>법정의무교육 추가</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Training Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              교육 유형 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.trainingType}
              onChange={(e) => handleChange('trainingType', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">교육 유형 선택</option>
              {TRAINING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Course Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              과정 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.courseId}
              onChange={(e) => handleChange('courseId', e.target.value)}
              disabled={!form.trainingType}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
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
          </div>

          {/* Year + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                대상 연도 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.year}
                onChange={(e) => handleChange('year', Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[defaultYear + 1, defaultYear, defaultYear - 1].map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                이수 마감일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Required Hours */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              필수 이수시간 (시간)
            </label>
            <input
              type="number"
              min={1}
              max={40}
              value={form.requiredHours}
              onChange={(e) => handleChange('requiredHours', Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1"
            />
            <p className="text-xs text-slate-400 mt-1">법정 최소 이수시간을 입력하세요.</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
              <X className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              {submitting ? '등록 중...' : '교육 추가'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
