'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용 요청서 작성 폼
// B4: Requisition Form
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Send, Building2, Users, AlertTriangle } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { CARD_STYLES, BUTTON_VARIANTS } from '@/lib/styles'

interface Company { id: string; name: string }
interface Department { id: string; name: string; companyId: string }
interface Position { id: string; titleKo: string; code: string; isFilled: boolean }

export default function RequisitionFormClient({
  const tCommon = useTranslations('common')
  const t = useTranslations('recruitment')
 user }: { user: SessionUser }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [companies, setCompanies] = useState<Company[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])

  const [form, setForm] = useState({
    companyId: user.companyId ?? '',
    departmentId: '',
    title: '',
    headcount: 1,
    jobLevel: '',
    employmentType: 'permanent' as 'permanent' | 'contract' | 'intern',
    urgency: 'normal' as 'urgent' | 'normal' | 'low',
    targetDate: '',
    justification: '',
    positionId: '',
  })

  // 법인 목록
  useEffect(() => {
    apiClient.getList<Company>('/api/v1/companies', { limit: '100' })
      .then((res) => setCompanies(res.data ?? []))
      .catch(() => {})
  }, [])

  // 부서 목록 (법인 선택 시)
  useEffect(() => {
    if (!form.companyId) return
    apiClient.getList<Department>('/api/v1/departments', {
      companyId: form.companyId,
      limit: '200',
    })
      .then((res) => setDepartments(res.data ?? []))
      .catch(() => {})
  }, [form.companyId])

  // 공석 Position 목록
  useEffect(() => {
    if (!form.companyId) return
    apiClient.getList<Position>('/api/v1/positions', {
      companyId: form.companyId,
      isFilled: 'false',
      limit: '100',
    })
      .then((res) => setPositions(res.data ?? []))
      .catch(() => {})
  }, [form.companyId])

  const handleSave = async (submitForApproval: boolean) => {
    if (!form.companyId || !form.departmentId || !form.title || !form.justification) {
      setError('필수 항목을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await apiClient.post<{ id: string }>('/api/v1/recruitment/requisitions', {
        ...form,
        positionId: form.positionId || undefined,
        targetDate: form.targetDate || undefined,
        submitForApproval,
      })
      router.push(`/recruitment/requisitions`)
    } catch (err: any) {
      setError(err?.message ?? '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-[#F5F5F5] text-[#555]"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">채용 요청서 작성</h1>
          <p className="text-sm text-[#666] mt-0.5">부서장이 HR에 채용을 요청합니다.</p>
        </div>
      </div>

      {/* 폼 */}
      <div className={`${CARD_STYLES.padded} space-y-5`}>

        {/* 법인 / 부서 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1.5">
              법인 <span className="text-[#EF4444]">*</span>
            </label>
            <select
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value, departmentId: '', positionId: '' })}
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 focus:border-[#00C853]"
            >
              <option value="">{tCommon('select')}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1.5">
              부서 <span className="text-[#EF4444]">*</span>
            </label>
            <select
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 focus:border-[#00C853]"
            >
              <option value="">{tCommon('select')}</option>
              {departments.filter((d) => d.companyId === form.companyId).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 직무명 */}
        <div>
          <label className="block text-sm font-medium text-[#333] mb-1.5">
            채용 직무명 <span className="text-[#EF4444]">*</span>
          </label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="예: 시니어 백엔드 개발자"
            className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 focus:border-[#00C853] placeholder:text-[#999]"
          />
        </div>

        {/* 인원 / 직급 / 고용형태 */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1.5">채용 인원</label>
            <input
              type="number"
              min={1}
              value={form.headcount}
              onChange={(e) => setForm({ ...form, headcount: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 focus:border-[#00C853]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1.5">직급</label>
            <input
              value={form.jobLevel}
              onChange={(e) => setForm({ ...form, jobLevel: e.target.value })}
              placeholder="예: 과장"
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 focus:border-[#00C853] placeholder:text-[#999]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1.5">고용형태</label>
            <select
              value={form.employmentType}
              onChange={(e) => setForm({ ...form, employmentType: e.target.value as any })}
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 focus:border-[#00C853]"
            >
              <option value="permanent">정규직</option>
              <option value="contract">계약직</option>
              <option value="intern">인턴</option>
            </select>
          </div>
        </div>

        {/* 긴급도 / 희망입사일 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1.5">긴급도</label>
            <div className="flex gap-3">
              {(['urgent', 'normal', 'low'] as const).map((u) => (
                <label key={u} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="urgency"
                    value={u}
                    checked={form.urgency === u}
                    onChange={() => setForm({ ...form, urgency: u })}
                    className="text-[#00C853]"
                  />
                  <span className="text-sm">
                    {u === 'urgent' ? '🔴 긴급' : u === 'normal' ? '🟡 보통' : '🟢 낮음'}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1.5">희망 입사일</label>
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 focus:border-[#00C853]"
            />
          </div>
        </div>

        {/* 연결 포지션 */}
        <div>
          <label className="block text-sm font-medium text-[#333] mb-1.5">
            연결 포지션 <span className="text-[#999] font-normal">(공석 선택 또는 미선택 시 신규 생성)</span>
          </label>
          <select
            value={form.positionId}
            onChange={(e) => setForm({ ...form, positionId: e.target.value })}
            className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 focus:border-[#00C853]"
          >
            <option value="">신규 Position 생성</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.code}] {p.titleKo}
              </option>
            ))}
          </select>
        </div>

        {/* 채용 사유 */}
        <div>
          <label className="block text-sm font-medium text-[#333] mb-1.5">
            채용 사유 <span className="text-[#EF4444]">*</span>
          </label>
          <textarea
            rows={4}
            value={form.justification}
            onChange={(e) => setForm({ ...form, justification: e.target.value })}
            placeholder="채용이 필요한 사유를 상세히 작성해주세요. (예: 신규 프로젝트 인력 확충, 퇴직자 대체 충원 등)"
            className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 focus:border-[#00C853] resize-none placeholder:text-[#999]"
          />
        </div>

        {/* 결재선 안내 */}
        <div className="bg-[#E8F5E9] rounded-lg p-4">
          <p className="text-sm text-[#00A844] font-medium mb-1">결재선 (자동 적용)</p>
          <p className="text-xs text-[#555]">
            {form.urgency === 'urgent'
              ? '긴급: 팀장 → 부서장 → HR → 대표 (4단계)'
              : '일반: 팀장 → HR (2단계)'}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-[#FEE2E2] rounded-lg text-[#B91C1C] text-sm">
            <AlertTriangle size={15} />
            {error}
          </div>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#555] hover:bg-[#FAFAFA]"
        >
          취소
        </button>
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#333] hover:bg-[#FAFAFA] disabled:opacity-50"
        >
          <Save size={15} />
          임시저장
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}
        >
          <Send size={15} />
          결재 요청
        </button>
      </div>
    </div>
  )
}
