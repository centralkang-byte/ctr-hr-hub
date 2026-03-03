'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import {
  CalendarDays, Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  CheckCircle2, Settings, RotateCcw, Loader2, AlertTriangle, X,
} from 'lucide-react'
import type { SessionUser } from '@/types'

// ─── 타입 ─────────────────────────────────────────────────

interface AccrualRule {
  id: string
  accrualType: string
  accrualBasis: string
  rules: AccrualRuleTier[]
  carryOverType: string
  carryOverMaxDays: number | null
  carryOverExpiryMonths: number | null
}

interface AccrualRuleTier {
  minTenureMonths?: number
  maxTenureMonths?: number | null
  daysPerYear?: number
  daysPerMonth?: number
  bonusPerTwoYears?: number
  maxDays?: number
  type?: string
}

interface LeaveTypeDef {
  id: string
  companyId: string | null
  code: string
  name: string
  nameEn: string | null
  isPaid: boolean
  allowHalfDay: boolean
  requiresProof: boolean
  maxConsecutiveDays: number | null
  displayOrder: number
  isActive: boolean
  accrualRules: AccrualRule[]
  _count?: { yearBalances: number }
}

interface Company {
  id: string
  code: string
  name: string
}

type Tab = 'types' | 'accrual' | 'carryover'

// ─── 메인 컴포넌트 ─────────────────────────────────────────

export function LeaveSettingsClient({ user }: { user: SessionUser }) {
  const [tab, setTab] = useState<Tab>('types')
  const [typeDefs, setTypeDefs] = useState<LeaveTypeDef[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [accrualTarget, setAccrualTarget] = useState<LeaveTypeDef | null>(null)
  const [accrualRunning, setAccrualRunning] = useState(false)
  const [accrualResult, setAccrualResult] = useState<string | null>(null)

  const loadTypeDefs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = selectedCompanyId ? { companyId: selectedCompanyId } : {}
      const res = await apiClient.get<LeaveTypeDef[]>('/api/v1/leave/type-defs', params)
      setTypeDefs(res.data ?? [])
    } catch {
      setError('휴가 유형 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [selectedCompanyId])

  const loadCompanies = async () => {
    try {
      const res = await apiClient.get<Company[]>('/api/v1/companies')
      setCompanies(res.data ?? [])
    } catch {
      // silent
    }
  }

  useEffect(() => { loadCompanies() }, [])
  useEffect(() => { loadTypeDefs() }, [loadTypeDefs])

  const handleDelete = async (id: string) => {
    if (!confirm('이 휴가 유형을 비활성화하시겠습니까?')) return
    try {
      await apiClient.delete(`/api/v1/leave/type-defs/${id}`)
      await loadTypeDefs()
    } catch {
      alert('삭제에 실패했습니다.')
    }
  }

  const handleRunAccrual = async () => {
    if (!selectedCompanyId) { alert('법인을 선택해주세요.'); return }
    const year = new Date().getFullYear()
    if (!confirm(`${year}년 연간 휴가 부여를 실행하시겠습니까? 기존 부여 일수가 갱신됩니다.`)) return
    setAccrualRunning(true)
    setAccrualResult(null)
    try {
      const res = await apiClient.post<{ message: string }>('/api/v1/leave/accrual', { companyId: selectedCompanyId, year })
      setAccrualResult(res.data?.message ?? '완료')
    } catch {
      setAccrualResult('오류가 발생했습니다.')
    } finally {
      setAccrualRunning(false)
    }
  }

  // 탭별 데이터
  const globalTypes = typeDefs.filter((t) => t.companyId === null)
  const companyTypes = typeDefs.filter((t) => t.companyId !== null)

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-[#00C853]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">휴가 정책 설정</h1>
            <p className="text-sm text-[#666] mt-0.5">법인별 휴가 유형, 부여 규칙, 이월·소멸 정책을 관리합니다</p>
          </div>
        </div>
        {/* 일괄 부여 버튼 */}
        <div className="flex items-center gap-3">
          {selectedCompanyId && (
            <button
              onClick={handleRunAccrual}
              disabled={accrualRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E8F5E9] text-[#00A844] border border-[#A5D6A7] hover:bg-[#C8E6C9] text-sm font-medium disabled:opacity-60"
            >
              {accrualRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              연간 부여 실행
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            휴가 유형 추가
          </button>
        </div>
      </div>

      {/* 실행 결과 */}
      {accrualResult && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${accrualResult.includes('오류') ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-[#D1FAE5] text-[#047857]'}`}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {accrualResult}
          <button onClick={() => setAccrualResult(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* 법인 필터 */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-[#666]">법인:</span>
        <select
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          className="px-3 py-1.5 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
        >
          <option value="">전체 (글로벌 공통)</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-[#E8E8E8]">
        {([
          { key: 'types', label: '휴가 유형' },
          { key: 'accrual', label: '부여 규칙' },
          { key: 'carryover', label: '이월·소멸' },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-[#00C853] text-[#00C853]'
                : 'border-transparent text-[#666] hover:text-[#333]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 컨텐츠 */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#00C853]" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-[#B91C1C] py-8">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      ) : tab === 'types' ? (
        <TypesTab
          globalTypes={globalTypes}
          companyTypes={companyTypes}
          companies={companies}
          editingId={editingId}
          setEditingId={setEditingId}
          onDelete={handleDelete}
          onRefresh={loadTypeDefs}
        />
      ) : tab === 'accrual' ? (
        <AccrualTab
          typeDefs={typeDefs}
          accrualTarget={accrualTarget}
          setAccrualTarget={setAccrualTarget}
          onRefresh={loadTypeDefs}
        />
      ) : (
        <CarryOverTab typeDefs={typeDefs} onRefresh={loadTypeDefs} />
      )}

      {/* 추가 폼 모달 */}
      {showAddForm && (
        <AddTypeDefModal
          companies={companies}
          onClose={() => setShowAddForm(false)}
          onSaved={loadTypeDefs}
        />
      )}
    </div>
  )
}

// ─── Tab 1: 휴가 유형 ─────────────────────────────────────

function TypesTab({
  globalTypes,
  companyTypes,
  companies,
  editingId,
  setEditingId,
  onDelete,
  onRefresh,
}: {
  globalTypes: LeaveTypeDef[]
  companyTypes: LeaveTypeDef[]
  companies: Company[]
  editingId: string | null
  setEditingId: (id: string | null) => void
  onDelete: (id: string) => void
  onRefresh: () => void
}) {
  const renderRow = (t: LeaveTypeDef) => (
    <tr key={t.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-[#1A1A1A]">{t.name}</div>
        <div className="text-xs text-[#999]">{t.code}</div>
      </td>
      <td className="px-4 py-3">
        {t.companyId
          ? <span className="text-xs text-[#555]">{companies.find((c) => c.id === t.companyId)?.name ?? t.companyId}</span>
          : <span className="inline-flex px-2 py-0.5 rounded-full bg-[#E0E7FF] text-[#4338CA] text-xs">글로벌</span>
        }
      </td>
      <td className="px-4 py-3">
        {t.isPaid
          ? <span className="inline-flex px-2 py-0.5 rounded-full bg-[#D1FAE5] text-[#047857] text-xs">유급</span>
          : <span className="inline-flex px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-xs">무급</span>
        }
      </td>
      <td className="px-4 py-3 text-xs text-[#555]">
        {[
          t.allowHalfDay && '반차',
          t.requiresProof && '증빙필요',
          t.maxConsecutiveDays && `최대 ${t.maxConsecutiveDays}일`,
        ].filter(Boolean).join(' · ') || '—'}
      </td>
      <td className="px-4 py-3 text-xs text-[#999]">{t._count?.yearBalances ?? 0}명</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setEditingId(t.id)} className="p-1.5 hover:bg-[#F5F5F5] rounded text-[#666]">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(t.id)} className="p-1.5 hover:bg-[#FEE2E2] rounded text-[#DC2626]">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )

  const thead = (
    <thead>
      <tr className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
        {['유형명', '법인', '유급/무급', '옵션', '사용 인원', ''].map((h) => (
          <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#666] uppercase tracking-wider">{h}</th>
        ))}
      </tr>
    </thead>
  )

  return (
    <div className="space-y-6">
      {/* 글로벌 공통 */}
      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        <div className="px-5 py-3.5 border-b border-[#F5F5F5]">
          <h3 className="text-sm font-semibold text-[#1A1A1A]">글로벌 공통 휴가 유형</h3>
        </div>
        <table className="w-full">
          {thead}
          <tbody>{globalTypes.map(renderRow)}</tbody>
        </table>
        {globalTypes.length === 0 && (
          <p className="text-center text-sm text-[#999] py-8">등록된 유형이 없습니다.</p>
        )}
      </div>

      {/* 법인별 */}
      {companyTypes.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E8E8E8]">
          <div className="px-5 py-3.5 border-b border-[#F5F5F5]">
            <h3 className="text-sm font-semibold text-[#1A1A1A]">법인 전용 휴가 유형</h3>
          </div>
          <table className="w-full">
            {thead}
            <tbody>{companyTypes.map(renderRow)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tab 2: 부여 규칙 ─────────────────────────────────────

function AccrualTab({
  typeDefs,
  accrualTarget,
  setAccrualTarget,
  onRefresh,
}: {
  typeDefs: LeaveTypeDef[]
  accrualTarget: LeaveTypeDef | null
  setAccrualTarget: (t: LeaveTypeDef | null) => void
  onRefresh: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    accrualType: 'annual',
    accrualBasis: 'calendar_year',
    carryOverType: 'none',
    carryOverMaxDays: '',
    carryOverExpiryMonths: '',
    rulesJson: '[]',
  })

  useEffect(() => {
    if (!accrualTarget || accrualTarget.accrualRules.length === 0) {
      setForm({ accrualType: 'annual', accrualBasis: 'calendar_year', carryOverType: 'none', carryOverMaxDays: '', carryOverExpiryMonths: '', rulesJson: '[]' })
      return
    }
    const r = accrualTarget.accrualRules[0]
    setForm({
      accrualType: r.accrualType,
      accrualBasis: r.accrualBasis,
      carryOverType: r.carryOverType,
      carryOverMaxDays: r.carryOverMaxDays?.toString() ?? '',
      carryOverExpiryMonths: r.carryOverExpiryMonths?.toString() ?? '',
      rulesJson: JSON.stringify(r.rules, null, 2),
    })
  }, [accrualTarget])

  const handleSave = async () => {
    if (!accrualTarget) return
    let parsedRules: AccrualRuleTier[]
    try {
      parsedRules = JSON.parse(form.rulesJson)
    } catch {
      alert('규칙 JSON 형식이 올바르지 않습니다.')
      return
    }
    setSaving(true)
    try {
      await apiClient.put(`/api/v1/leave/type-defs/${accrualTarget.id}/accrual-rules`, {
        accrualType: form.accrualType,
        accrualBasis: form.accrualBasis,
        rules: parsedRules,
        carryOverType: form.carryOverType,
        carryOverMaxDays: form.carryOverMaxDays ? Number(form.carryOverMaxDays) : null,
        carryOverExpiryMonths: form.carryOverExpiryMonths ? Number(form.carryOverExpiryMonths) : null,
      })
      await onRefresh()
      setAccrualTarget(null)
    } catch {
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* 유형 목록 */}
      <div className="col-span-1 bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F5F5F5] text-sm font-semibold text-[#1A1A1A]">휴가 유형 선택</div>
        <div className="divide-y divide-[#F5F5F5]">
          {typeDefs.map((t) => (
            <button
              key={t.id}
              onClick={() => setAccrualTarget(t)}
              className={`w-full text-left px-4 py-3 hover:bg-[#FAFAFA] transition-colors ${accrualTarget?.id === t.id ? 'bg-[#E8F5E9]' : ''}`}
            >
              <div className="text-sm font-medium text-[#1A1A1A]">{t.name}</div>
              <div className="text-xs text-[#999]">{t.accrualRules.length > 0 ? `${t.accrualRules[0].accrualType} / ${t.accrualRules[0].accrualBasis}` : '규칙 없음'}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 편집 패널 */}
      <div className="col-span-2 bg-white rounded-xl border border-[#E8E8E8] p-5 space-y-5">
        {!accrualTarget ? (
          <div className="flex items-center justify-center h-48 text-[#999] text-sm">
            좌측 목록에서 휴가 유형을 선택하세요
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#1A1A1A]">{accrualTarget.name} — 부여 규칙</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">부여 방식</label>
                <select
                  value={form.accrualType}
                  onChange={(e) => setForm({ ...form, accrualType: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
                >
                  <option value="annual">연 1회 일괄 (annual)</option>
                  <option value="monthly">월별 부여 (monthly)</option>
                  <option value="manual">수동 부여 (manual)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">기준일</label>
                <select
                  value={form.accrualBasis}
                  onChange={(e) => setForm({ ...form, accrualBasis: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
                >
                  <option value="calendar_year">달력 연도 (1월 1일)</option>
                  <option value="hire_date_anniversary">입사 기념일</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">
                부여 규칙 (JSON 티어)
              </label>
              <textarea
                value={form.rulesJson}
                onChange={(e) => setForm({ ...form, rulesJson: e.target.value })}
                rows={8}
                className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#00C853]/10"
                placeholder={'[\n  { "minTenureMonths": 0, "maxTenureMonths": null, "daysPerYear": 15 }\n]'}
              />
              <p className="text-xs text-[#999] mt-1">minTenureMonths, maxTenureMonths (null=무제한), daysPerYear, daysPerMonth, bonusPerTwoYears, maxDays</p>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setAccrualTarget(null)} className="px-4 py-2 text-sm border border-[#D4D4D4] rounded-lg hover:bg-[#FAFAFA]">취소</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                저장
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Tab 3: 이월·소멸 ─────────────────────────────────────

function CarryOverTab({ typeDefs, onRefresh }: { typeDefs: LeaveTypeDef[]; onRefresh: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8]">
      <table className="w-full">
        <thead>
          <tr className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
            {['휴가 유형', '이월 방식', '최대 이월일', '소멸 기간(월)', ''].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#666] uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {typeDefs.map((t) => {
            const rule = t.accrualRules[0]
            if (!rule) return (
              <tr key={t.id} className="border-b border-[#F5F5F5]">
                <td className="px-4 py-3 text-sm text-[#1A1A1A]">{t.name}</td>
                <td colSpan={4} className="px-4 py-3 text-xs text-[#999]">부여 규칙 없음</td>
              </tr>
            )
            return (
              <tr key={t.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-[#1A1A1A]">{t.name}</div>
                  <div className="text-xs text-[#999]">{t.code}</div>
                </td>
                <td className="px-4 py-3">
                  {rule.carryOverType === 'none' && <span className="text-xs text-[#999]">이월 없음</span>}
                  {rule.carryOverType === 'limited' && <span className="inline-flex px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-xs">제한 이월</span>}
                  {rule.carryOverType === 'unlimited' && <span className="inline-flex px-2 py-0.5 rounded-full bg-[#D1FAE5] text-[#047857] text-xs">전액 이월</span>}
                </td>
                <td className="px-4 py-3 text-sm text-[#555]">
                  {rule.carryOverMaxDays != null ? `${rule.carryOverMaxDays}일` : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-[#555]">
                  {rule.carryOverExpiryMonths != null ? `${rule.carryOverExpiryMonths}개월` : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-[#999]">
                  <Settings className="w-3.5 h-3.5 inline" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {typeDefs.length === 0 && (
        <p className="text-center text-sm text-[#999] py-8">데이터가 없습니다.</p>
      )}
    </div>
  )
}

// ─── 추가 모달 ────────────────────────────────────────────

function AddTypeDefModal({
  companies,
  onClose,
  onSaved,
}: {
  companies: Company[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    companyId: '',
    code: '',
    name: '',
    nameEn: '',
    isPaid: true,
    allowHalfDay: true,
    requiresProof: false,
    maxConsecutiveDays: '',
    displayOrder: '0',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.code || !form.name) { alert('코드와 이름은 필수입니다.'); return }
    setSaving(true)
    try {
      await apiClient.post('/api/v1/leave/type-defs', {
        companyId: form.companyId || null,
        code: form.code,
        name: form.name,
        nameEn: form.nameEn || undefined,
        isPaid: form.isPaid,
        allowHalfDay: form.allowHalfDay,
        requiresProof: form.requiresProof,
        maxConsecutiveDays: form.maxConsecutiveDays ? Number(form.maxConsecutiveDays) : undefined,
        displayOrder: Number(form.displayOrder),
      })
      await onSaved()
      onClose()
    } catch {
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8]">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">휴가 유형 추가</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#F5F5F5] rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">법인 <span className="text-[#999]">(비워두면 글로벌 공통)</span></label>
            <select
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value })}
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
            >
              <option value="">글로벌 공통</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">코드 *</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. annual"
                className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">순서</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">유형명 (한국어) *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. 연차휴가"
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">유형명 (영문)</label>
            <input
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              placeholder="e.g. Annual Leave"
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">연속 사용 최대일</label>
              <input
                type="number"
                value={form.maxConsecutiveDays}
                onChange={(e) => setForm({ ...form, maxConsecutiveDays: e.target.value })}
                placeholder="제한 없으면 비워둠"
                className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            {([
              { key: 'isPaid', label: '유급' },
              { key: 'allowHalfDay', label: '반차 허용' },
              { key: 'requiresProof', label: '증빙 필요' },
            ] as { key: keyof typeof form; label: string }[]).map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key] as boolean}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  className="w-4 h-4 rounded border-[#D4D4D4] text-[#00C853]"
                />
                <span className="text-sm text-[#333]">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#E8E8E8]">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[#D4D4D4] rounded-lg hover:bg-[#FAFAFA]">취소</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
