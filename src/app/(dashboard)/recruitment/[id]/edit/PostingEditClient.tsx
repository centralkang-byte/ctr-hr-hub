'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용공고 수정 폼 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, Briefcase, Sparkles, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Options ─────────────────────────────────────────────

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: '정규직' },
  { value: 'CONTRACT', label: '계약직' },
  { value: 'DISPATCH', label: '파견직' },
  { value: 'INTERN', label: '인턴' },
]

const WORK_MODE_OPTIONS = [
  { value: '', label: '선택 안함' },
  { value: 'OFFICE', label: '사무실' },
  { value: 'REMOTE', label: '재택' },
  { value: 'HYBRID', label: '혼합' },
]

// ─── Schema ──────────────────────────────────────────────

const formSchema = z.object({
  title: z.string().min(1, '공고 제목을 입력해주세요.'),
  description: z.string().min(1, '직무 설명을 입력해주세요.'),
  requirements: z.string().optional(),
  preferred: z.string().optional(),
  employmentType: z.string().min(1, '고용형태를 선택해주세요.'),
  departmentId: z.string().optional(),
  jobGradeId: z.string().optional(),
  jobCategoryId: z.string().optional(),
  workMode: z.string().optional(),
  headcount: z.coerce.number().int().min(1).default(1),
  location: z.string().optional(),
  salaryRangeMin: z.coerce.number().optional().or(z.literal('')),
  salaryRangeMax: z.coerce.number().optional().or(z.literal('')),
  salaryHidden: z.boolean().optional(),
  deadlineDate: z.string().optional(),
  recruiterId: z.string().optional(),
  requiredCompetencies: z.string().optional(),
})

type FormData = z.input<typeof formSchema>

// ─── Reference Types ─────────────────────────────────────

interface RefOption {
  id: string
  name: string
}

interface EmployeeOption {
  id: string
  name: string
  employeeNo: string
}

interface PostingDetail {
  id: string
  title: string
  description: string
  requirements: string | null
  preferred: string | null
  employmentType: string
  departmentId: string | null
  jobGradeId: string | null
  jobCategoryId: string | null
  workMode: string | null
  headcount: number
  location: string | null
  salaryRangeMin: number | null
  salaryRangeMax: number | null
  salaryHidden: boolean
  deadlineDate: string | null
  recruiterId: string | null
  requiredCompetencies: string[] | null
}

interface Props {
  user: SessionUser
  id: string
}

// ─── Component ───────────────────────────────────────────

export default function PostingEditClient({ user, id }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [departments, setDepartments] = useState<RefOption[]>([])
  const [grades, setGrades] = useState<RefOption[]>([])
  const [categories, setCategories] = useState<RefOption[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      requirements: '',
      preferred: '',
      employmentType: 'FULL_TIME',
      headcount: 1,
      salaryHidden: false,
    },
  })

  // ─── Fetch reference data + posting detail ────────────

  const fetchData = useCallback(async () => {
    setDataLoading(true)
    try {
      const [deptRes, gradeRes, catRes, empRes, postingRes] = await Promise.all([
        apiClient.getList<RefOption>('/api/v1/org/departments', { limit: 200 }),
        apiClient.getList<RefOption>('/api/v1/org/grades', { limit: 200 }),
        apiClient.getList<RefOption>('/api/v1/org/job-categories', { limit: 200 }),
        apiClient.getList<EmployeeOption>('/api/v1/employees', { limit: 200 }),
        apiClient.get<PostingDetail>(`/api/v1/recruitment/postings/${id}`),
      ])
      setDepartments(deptRes.data)
      setGrades(gradeRes.data)
      setCategories(catRes.data)
      setEmployees(empRes.data)

      const p = postingRes.data
      reset({
        title: p.title,
        description: p.description,
        requirements: p.requirements ?? '',
        preferred: p.preferred ?? '',
        employmentType: p.employmentType,
        departmentId: p.departmentId ?? '',
        jobGradeId: p.jobGradeId ?? '',
        jobCategoryId: p.jobCategoryId ?? '',
        workMode: p.workMode ?? '',
        headcount: p.headcount,
        location: p.location ?? '',
        salaryRangeMin: p.salaryRangeMin ?? '',
        salaryRangeMax: p.salaryRangeMax ?? '',
        salaryHidden: p.salaryHidden,
        deadlineDate: p.deadlineDate ? p.deadlineDate.split('T')[0] : '',
        recruiterId: p.recruiterId ?? '',
        requiredCompetencies: p.requiredCompetencies ? p.requiredCompetencies.join(', ') : '',
      })
    } catch {
      /* silently handle */
    } finally {
      setDataLoading(false)
    }
  }, [id, reset])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── AI Draft Generation ──────────────────────────────

  const handleAiGenerate = async () => {
    const title = watch('title')
    if (!title) return

    const deptId = watch('departmentId')
    const gradeId = watch('jobGradeId')
    const catId = watch('jobCategoryId')

    const dept = departments.find((d) => d.id === deptId)
    const grade = grades.find((g) => g.id === gradeId)
    const cat = categories.find((c) => c.id === catId)

    setAiLoading(true)
    try {
      const res = await apiClient.post<{
        description: string
        qualifications: string
        preferred: string
      }>('/api/v1/ai/job-description', {
        title,
        department: dept?.name,
        grade: grade?.name,
        category: cat?.name,
      })

      setValue('description', res.data.description)
      setValue('requirements', res.data.qualifications)
      setValue('preferred', res.data.preferred)
    } catch {
      /* silently handle */
    } finally {
      setAiLoading(false)
    }
  }

  // ─── Submit ───────────────────────────────────────────

  const onSubmit = async (formData: FormData) => {
    setSubmitting(true)
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        requirements: formData.requirements || null,
        preferred: formData.preferred || null,
        employmentType: formData.employmentType,
        departmentId: formData.departmentId || null,
        jobGradeId: formData.jobGradeId || null,
        jobCategoryId: formData.jobCategoryId || null,
        location: formData.location || null,
        salaryRangeMin: formData.salaryRangeMin && formData.salaryRangeMin !== '' ? Number(formData.salaryRangeMin) : null,
        salaryRangeMax: formData.salaryRangeMax && formData.salaryRangeMax !== '' ? Number(formData.salaryRangeMax) : null,
        salaryHidden: formData.salaryHidden ?? false,
        headcount: formData.headcount,
        workMode: formData.workMode || null,
        recruiterId: formData.recruiterId || null,
        deadlineDate: formData.deadlineDate || null,
        requiredCompetencies: formData.requiredCompetencies
          ? formData.requiredCompetencies.split(',').map((s) => s.trim()).filter(Boolean)
          : null,
      }

      await apiClient.put(`/api/v1/recruitment/postings/${id}`, payload)
      router.push(`/recruitment/${id}`)
    } catch {
      /* silently handle */
    } finally {
      setSubmitting(false)
    }
  }

  void user

  // ─── Field Style ──────────────────────────────────────

  const inputClass = 'w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] transition-colors'
  const labelClass = 'block text-sm font-medium text-[#333] mb-1'
  const errorClass = 'text-xs text-[#F44336] mt-1'

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[#999]">
          <div className="w-4 h-4 border-2 border-[#E8E8E8] border-t-[#00C853] rounded-full animate-spin" />
          데이터를 불러오는 중...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg border border-[#E8E8E8] hover:bg-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-[#666]" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#E3F2FD] rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-[#2196F3]" />
          </div>
          <h1 className="text-xl font-bold text-[#333]" style={{ letterSpacing: '-0.02em' }}>
            채용공고 수정
          </h1>
        </div>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form onSubmit={handleSubmit(onSubmit as any)}>
        {/* 기본정보 */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 mb-6">
          <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
            기본정보
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>공고 제목 *</label>
              <input {...register('title')} className={inputClass} placeholder="예: 자동차부품 품질관리 엔지니어" />
              {errors.title && <p className={errorClass}>{errors.title.message}</p>}
            </div>

            <div>
              <label className={labelClass}>부서</label>
              <select {...register('departmentId')} className={inputClass}>
                <option value="">선택 안함</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>직급</label>
              <select {...register('jobGradeId')} className={inputClass}>
                <option value="">선택 안함</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>직군</label>
              <select {...register('jobCategoryId')} className={inputClass}>
                <option value="">선택 안함</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>고용형태 *</label>
              <select {...register('employmentType')} className={inputClass}>
                {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.employmentType && <p className={errorClass}>{errors.employmentType.message}</p>}
            </div>

            <div>
              <label className={labelClass}>근무형태</label>
              <select {...register('workMode')} className={inputClass}>
                {WORK_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>채용인원</label>
              <input {...register('headcount')} type="number" min={1} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>근무지</label>
              <input {...register('location')} className={inputClass} placeholder="예: 서울 강남구" />
            </div>
          </div>
        </div>

        {/* 공고내용 */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#333]" style={{ letterSpacing: '-0.02em' }}>
              공고내용
            </h2>
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiLoading || !watch('title')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#2196F3] hover:bg-[#1976D2] text-white rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              AI 초안 생성
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>직무 설명 *</label>
              <textarea
                {...register('description')}
                rows={5}
                className={inputClass}
                placeholder="직무에 대한 상세 설명을 입력하세요."
              />
              {errors.description && <p className={errorClass}>{errors.description.message}</p>}
            </div>

            <div>
              <label className={labelClass}>자격 요건</label>
              <textarea
                {...register('requirements')}
                rows={4}
                className={inputClass}
                placeholder="필수 자격 요건을 입력하세요."
              />
            </div>

            <div>
              <label className={labelClass}>우대 사항</label>
              <textarea
                {...register('preferred')}
                rows={4}
                className={inputClass}
                placeholder="우대 사항을 입력하세요."
              />
            </div>
          </div>
        </div>

        {/* 급여 */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 mb-6">
          <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
            급여
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>급여 하한 (원)</label>
              <input {...register('salaryRangeMin')} type="number" className={inputClass} placeholder="0" />
            </div>
            <div>
              <label className={labelClass}>급여 상한 (원)</label>
              <input {...register('salaryRangeMax')} type="number" className={inputClass} placeholder="0" />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-[#333]">
                <input {...register('salaryHidden')} type="checkbox" className="rounded border-[#E8E8E8]" />
                급여 비공개
              </label>
            </div>
          </div>
        </div>

        {/* 채용정보 */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 mb-6">
          <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
            채용정보
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>마감일</label>
              <input {...register('deadlineDate')} type="date" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>채용담당자</label>
              <select {...register('recruiterId')} className={inputClass}>
                <option value="">선택 안함</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.employeeNo})</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>필요 역량 (쉼표 구분)</label>
              <input
                {...register('requiredCompetencies')}
                className={inputClass}
                placeholder="예: 품질관리, IATF16949, 자동차부품, 영어"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 text-sm font-medium border border-[#E8E8E8] text-[#333] hover:bg-[#FAFAFA] rounded-lg transition-colors duration-150"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150 disabled:opacity-50"
          >
            {submitting ? '저장 중...' : '수정 저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
