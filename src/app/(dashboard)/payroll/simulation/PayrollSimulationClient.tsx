'use client'

import { useState } from 'react'
import { Calculator, TrendingUp, ArrowRight, Users, RotateCcw, ChevronDown } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

interface Company { id: string; name: string; code: string; currency: string | null }
interface JobGrade { id: string; name: string; rankOrder: number }

type SimType = 'transfer' | 'raise' | 'promotion'

const SIM_TYPES: { type: SimType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'transfer', label: '전출 시뮬레이션', icon: <ArrowRight className="w-5 h-5" />, desc: '직원을 다른 법인으로 전출 시 비용 변화를 예측합니다' },
  { type: 'raise', label: '연봉 인상 시뮬레이션', icon: <TrendingUp className="w-5 h-5" />, desc: '인상률에 따른 연간 추가 비용을 계산합니다' },
  { type: 'promotion', label: '승진 시뮬레이션', icon: <Users className="w-5 h-5" />, desc: '승진 시 직급별 평균 급여로 비용 변화를 예측합니다' },
]

type SimResult = Record<string, unknown>

export default function PayrollSimulationClient({
  user, companies, jobGrades,
}: {
  user: SessionUser
  companies: Company[]
  jobGrades: JobGrade[]
}) {
  const [simType, setSimType] = useState<SimType>('raise')
  const [employeeId, setEmployeeId] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [title, setTitle] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SimResult | null>(null)
  const [error, setError] = useState('')

  // Params per type
  const [raisePercent, setRaisePercent] = useState(5)
  const [targetCompanyId, setTargetCompanyId] = useState(companies[0]?.id ?? '')
  const [targetGradeId, setTargetGradeId] = useState(jobGrades[0]?.id ?? '')
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10))

  const buildParams = () => {
    if (simType === 'raise') return { raisePercent, effectiveDate }
    if (simType === 'transfer') return { targetCompanyId, effectiveDate }
    return { targetGradeId, effectiveDate }
  }

  const handleRun = async () => {
    if (!employeeId) return setError('직원 ID를 입력하세요.')
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const res = await apiClient.post<SimResult>('/api/v1/payroll/simulation', {
        type: simType,
        title: title || `${SIM_TYPES.find(s => s.type === simType)?.label} — ${new Date().toLocaleDateString('ko-KR')}`,
        employeeId,
        parameters: buildParams(),
      })
      setResult(res.data)
    } catch (e: any) {
      setError(e?.message ?? '시뮬레이션 실패')
    } finally {
      setRunning(false)
    }
  }

  const fmt = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
  const fmtKRW = (n: number) => `₩${Math.abs(n).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`

  const renderResult = () => {
    if (!result) return null
    const r = result as Record<string, unknown>

    if (simType === 'raise') {
      const before = r.before as Record<string, number>
      const after = r.after as Record<string, number>
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#F5F5F5] rounded-xl p-4">
              <p className="text-xs text-[#666] mb-2">인상 전</p>
              <p className="text-sm text-[#555]">기본급: {fmt(before.basePay)} {r.currency as string}</p>
              <p className="text-sm text-[#555]">총지급: {fmt(before.grossPay)} {r.currency as string}</p>
            </div>
            <div className="bg-[#E8F5E9] rounded-xl p-4">
              <p className="text-xs text-[#047857] mb-2">인상 후 ({r.raisePercent as number}%)</p>
              <p className="text-sm text-[#047857] font-medium">기본급: {fmt(after.basePay)} {r.currency as string}</p>
              <p className="text-sm text-[#047857] font-medium">총지급: {fmt(after.grossPay)} {r.currency as string}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#666]">월 추가 비용 (현지)</span>
              <span className="font-mono font-semibold text-[#1A1A1A]">+{fmt(r.monthlyDeltaLocal as number)} {r.currency as string}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#666]">월 추가 비용 (KRW)</span>
              <span className="font-mono font-semibold text-[#1A1A1A]">+{fmtKRW(r.monthlyDeltaKRW as number)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-[#F5F5F5] pt-2">
              <span className="text-[#666] font-medium">연간 추가 비용 (KRW)</span>
              <span className="font-mono font-bold text-[#00C853] text-base">+{fmtKRW(r.annualDeltaKRW as number)}</span>
            </div>
          </div>
          <p className="text-xs text-[#999]">{r.note as string}</p>
        </div>
      )
    }

    if (simType === 'transfer') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#F5F5F5] rounded-xl p-4">
              <p className="text-xs text-[#666] mb-2">현재 ({r.currentCompany as string})</p>
              <p className="text-sm font-mono font-semibold">{fmt(r.currentGrossKRW as number)} KRW/월</p>
              <p className="text-xs text-[#999]">{fmt(r.currentGrossLocal as number)} {r.currentCurrency as string}</p>
            </div>
            <div className="bg-[#E8F5E9] rounded-xl p-4">
              <p className="text-xs text-[#047857] mb-2">전출 후 ({r.targetCompany as string})</p>
              <p className="text-sm font-mono font-semibold text-[#047857]">{fmt(r.targetAvgKRW as number)} KRW/월</p>
              <p className="text-xs text-[#999]">{fmt(r.targetAvgLocal as number)} {r.targetCurrency as string} (법인 동직급 평균)</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-4">
            <div className="flex justify-between text-sm">
              <span className="text-[#666]">월 차이 (KRW)</span>
              <span className={`font-mono font-bold ${(r.deltaKRW as number) >= 0 ? 'text-[#DC2626]' : 'text-[#059669]'}`}>
                {(r.deltaKRW as number) >= 0 ? '+' : ''}{fmtKRW(r.deltaKRW as number)}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t border-[#F5F5F5] mt-2 pt-2">
              <span className="text-[#666] font-medium">연간 추가 비용 (KRW)</span>
              <span className={`font-mono font-bold text-base ${(r.deltaKRW as number) >= 0 ? 'text-[#DC2626]' : 'text-[#059669]'}`}>
                {(r.deltaKRW as number) >= 0 ? '+' : ''}{fmtKRW((r.deltaKRW as number) * 12)}
              </span>
            </div>
          </div>
          <p className="text-xs text-[#999]">{r.note as string}</p>
        </div>
      )
    }

    // promotion
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="px-2.5 py-1 bg-[#F5F5F5] rounded-lg text-[#555]">{r.currentGrade as string}</span>
          <ArrowRight className="w-4 h-4 text-[#CCC]" />
          <span className="px-2.5 py-1 bg-[#E8F5E9] rounded-lg text-[#047857] font-medium">{r.targetGrade as string}</span>
        </div>
        <div className="bg-white rounded-xl border border-[#E8E8E8] p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#666]">현재 총지급</span>
            <span className="font-mono">{fmt(r.currentGrossLocal as number)} {r.currency as string}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#666]">대상 직급 평균</span>
            <span className="font-mono">{fmt(r.targetAvgLocal as number)} {r.currency as string}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-[#F5F5F5] pt-2">
            <span className="text-[#666]">월 추가 비용 (KRW)</span>
            <span className="font-mono font-semibold">+{fmtKRW(r.deltaKRW as number)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#666] font-medium">연간 추가 비용 (KRW)</span>
            <span className="font-mono font-bold text-[#00C853] text-base">+{fmtKRW(r.annualDeltaKRW as number)}</span>
          </div>
        </div>
        <p className="text-xs text-[#999]">{r.note as string}</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-[#E8F5E9] rounded-lg flex items-center justify-center">
          <Calculator className="w-5 h-5 text-[#00C853]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">급여 시뮬레이션</h1>
          <p className="text-sm text-[#666]">전출·인상·승진 시나리오의 급여 영향을 사전에 분석합니다</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Config */}
        <div className="col-span-2 space-y-5">
          {/* Type selector */}
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">시뮬레이션 유형</h3>
            <div className="grid grid-cols-3 gap-3">
              {SIM_TYPES.map(s => (
                <button
                  key={s.type}
                  onClick={() => { setSimType(s.type); setResult(null) }}
                  className={`p-3 rounded-xl border-2 text-left transition-colors ${
                    simType === s.type ? 'border-[#00C853] bg-[#E8F5E9]' : 'border-[#E8E8E8] hover:border-[#D4D4D4]'
                  }`}
                >
                  <div className={`mb-2 ${simType === s.type ? 'text-[#00C853]' : 'text-[#666]'}`}>{s.icon}</div>
                  <div className={`text-xs font-semibold ${simType === s.type ? 'text-[#00A844]' : 'text-[#333]'}`}>{s.label}</div>
                  <div className="text-xs text-[#999] mt-1">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Employee */}
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">대상 직원</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#666] mb-1 block">직원 ID</label>
                <input
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  placeholder="직원 UUID 입력"
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-[#666] mb-1 block">시뮬레이션 제목 (선택)</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="예: 2025년 상반기 전출 검토"
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Params */}
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">시뮬레이션 파라미터</h3>
            <div className="space-y-3">
              {simType === 'raise' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#666] mb-1 block">인상률 (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={raisePercent}
                      onChange={e => setRaisePercent(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#666] mb-1 block">적용일</label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={e => setEffectiveDate(e.target.value)}
                      className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}
              {simType === 'transfer' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#666] mb-1 block">대상 법인</label>
                    <select
                      value={targetCompanyId}
                      onChange={e => setTargetCompanyId(e.target.value)}
                      className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                    >
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.code} ({c.currency})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#666] mb-1 block">전출일</label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={e => setEffectiveDate(e.target.value)}
                      className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}
              {simType === 'promotion' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#666] mb-1 block">대상 직급</label>
                    <select
                      value={targetGradeId}
                      onChange={e => setTargetGradeId(e.target.value)}
                      className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                    >
                      {jobGrades.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#666] mb-1 block">승진일</label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={e => setEffectiveDate(e.target.value)}
                      className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-[#DC2626] bg-[#FEE2E2] px-4 py-3 rounded-lg">{error}</div>
          )}

          <button
            onClick={handleRun}
            disabled={!employeeId || running}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#00C853] hover:bg-[#00A844] text-white rounded-xl font-medium disabled:opacity-50"
          >
            <Calculator className="w-4 h-4" />
            {running ? '계산 중...' : '시뮬레이션 실행'}
          </button>
        </div>

        {/* Right: Result */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-5 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">결과</h3>
              {result && (
                <button onClick={() => setResult(null)} className="text-xs text-[#999] hover:text-[#555]">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {!result && !running && (
              <div className="py-12 text-center text-sm text-[#999]">
                파라미터를 설정하고<br />시뮬레이션을 실행하세요
              </div>
            )}
            {running && (
              <div className="py-12 text-center text-sm text-[#999]">계산 중...</div>
            )}
            {result && !running && renderResult()}
          </div>
        </div>
      </div>
    </div>
  )
}
