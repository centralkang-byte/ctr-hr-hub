'use client'

import { useState, useEffect, useCallback } from 'react'
import { Globe, Save, Copy, ChevronLeft, ChevronRight, TrendingUp, Info } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

interface ExchangeRate {
  id: string
  fromCurrency: string
  toCurrency: string
  rate: string
  source: string
}

interface RatesResponse {
  year: number
  month: number
  rates: ExchangeRate[]
}

const CURRENCIES = [
  { code: 'USD', name: '미국 달러', flag: '🇺🇸', company: 'CTR-US' },
  { code: 'CNY', name: '중국 위안', flag: '🇨🇳', company: 'CTR-CN' },
  { code: 'RUB', name: '러시아 루블', flag: '🇷🇺', company: 'CTR-RU' },
  { code: 'VND', name: '베트남 동', flag: '🇻🇳', company: 'CTR-VN' },
  { code: 'MXN', name: '멕시코 페소', flag: '🇲🇽', company: 'CTR-MX' },
]

export default function ExchangeRatesClient({ user }: { user: SessionUser }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rates, setRates] = useState<Record<string, string>>({})
  const [original, setOriginal] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchRates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<RatesResponse>(
        `/api/v1/payroll/exchange-rates?year=${year}&month=${month}`
      )
      const map: Record<string, string> = {}
      for (const r of res.data.rates) {
        map[r.fromCurrency] = Number(r.rate).toFixed(4)
      }
      setRates(map)
      setOriginal(map)
    } catch {
      setRates({})
      setOriginal({})
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchRates() }, [fetchRates])

  const handlePrevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const handleNextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const isDirty = CURRENCIES.some(c => rates[c.code] !== original[c.code])

  const handleSave = async () => {
    setSaving(true)
    try {
      const rateList = CURRENCIES
        .filter(c => rates[c.code] && Number(rates[c.code]) > 0)
        .map(c => ({ fromCurrency: c.code, toCurrency: 'KRW', rate: Number(rates[c.code]), source: 'manual' }))
      await apiClient.put('/api/v1/payroll/exchange-rates', { year, month, rates: rateList })
      setOriginal({ ...rates })
      showToast(`${year}년 ${month}월 환율이 저장되었습니다.`)
    } catch {
      showToast('저장 실패', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyPrev = async () => {
    setCopying(true)
    try {
      await apiClient.post('/api/v1/payroll/exchange-rates/copy-prev', { year, month })
      showToast('전월 환율을 복사했습니다.')
      await fetchRates()
    } catch (e: any) {
      showToast(e?.message ?? '복사 실패', 'error')
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#E8F5E9] rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-[#00C853]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">환율 관리</h1>
            <p className="text-sm text-[#666]">해외 급여의 KRW 환산에 사용되는 월별 고정 환율</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyPrev}
            disabled={copying || loading}
            className="flex items-center gap-2 px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#555] hover:bg-[#FAFAFA] disabled:opacity-50"
          >
            <Copy className="w-4 h-4" />
            {copying ? '복사 중...' : '전월 복사'}
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={handlePrevMonth} className="p-2 hover:bg-[#F5F5F5] rounded-lg">
          <ChevronLeft className="w-5 h-5 text-[#555]" />
        </button>
        <div className="text-lg font-semibold text-[#1A1A1A] min-w-[120px] text-center">
          {year}년 {month}월
        </div>
        <button onClick={handleNextMonth} className="p-2 hover:bg-[#F5F5F5] rounded-lg">
          <ChevronRight className="w-5 h-5 text-[#555]" />
        </button>
        {isDirty && (
          <span className="text-xs text-[#B45309] bg-[#FEF3C7] px-2 py-1 rounded-full">미저장 변경사항</span>
        )}
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-[#E0E7FF] rounded-xl mb-6 text-sm text-[#4338CA]">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong>월별 고정 환율</strong>: 해당 월의 모든 해외 급여 환산에 동일한 환율이 적용됩니다.
          실시간 환율과 다를 수 있으며, 급여 계산의 일관성을 위해 월 초에 설정하는 것을 권장합니다.
        </div>
      </div>

      {/* Rate Table */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
        <div className="bg-[#FAFAFA] px-4 py-3 border-b border-[#F5F5F5]">
          <div className="grid grid-cols-12 gap-4 text-xs text-[#666] font-medium uppercase tracking-wider">
            <div className="col-span-1">국기</div>
            <div className="col-span-2">통화</div>
            <div className="col-span-3">통화명</div>
            <div className="col-span-2">법인</div>
            <div className="col-span-3">1 [통화] = ? KRW</div>
            <div className="col-span-1">소스</div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#999] text-sm">환율 데이터 로딩 중...</div>
        ) : (
          <div className="divide-y divide-[#F5F5F5]">
            {CURRENCIES.map((cur) => {
              const val = rates[cur.code] ?? ''
              const changed = val !== (original[cur.code] ?? '')
              const src = val ? (changed ? 'manual' : 'DB') : ''
              return (
                <div key={cur.code} className="grid grid-cols-12 gap-4 items-center px-4 py-3 hover:bg-[#FAFAFA]">
                  <div className="col-span-1 text-2xl">{cur.flag}</div>
                  <div className="col-span-2 font-mono font-semibold text-[#1A1A1A]">{cur.code}</div>
                  <div className="col-span-3 text-sm text-[#555]">{cur.name}</div>
                  <div className="col-span-2 text-sm text-[#555]">{cur.company}</div>
                  <div className="col-span-3">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={val}
                        onChange={(e) => setRates(prev => ({ ...prev, [cur.code]: e.target.value }))}
                        placeholder="미설정"
                        className={`w-full px-3 py-1.5 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00C853]/20
                          ${changed ? 'border-[#00C853] bg-[#E8F5E9]' : 'border-[#D4D4D4]'}`}
                      />
                      {val && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#999]">KRW</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-1">
                    {val ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        changed ? 'bg-[#E8F5E9] text-[#047857]' : 'bg-[#F5F5F5] text-[#666]'
                      }`}>
                        {changed ? '수정됨' : src}
                      </span>
                    ) : (
                      <span className="text-xs text-[#CCC]">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* KRW Preview */}
      {!loading && CURRENCIES.some(c => rates[c.code]) && (
        <div className="mt-6 bg-white rounded-xl border border-[#E8E8E8] p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#00C853]" />
            <h3 className="text-sm font-semibold text-[#1A1A1A]">환산 미리보기 (100 단위)</h3>
          </div>
          <div className="grid grid-cols-5 gap-4">
            {CURRENCIES.filter(c => rates[c.code] && Number(rates[c.code]) > 0).map((cur) => (
              <div key={cur.code} className="text-center p-3 bg-[#FAFAFA] rounded-lg">
                <div className="text-lg">{cur.flag}</div>
                <div className="text-xs text-[#666] mt-1">100 {cur.code}</div>
                <div className="text-sm font-bold text-[#1A1A1A] mt-1">
                  ₩{(Number(rates[cur.code]) * 100).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white z-50
          ${toast.type === 'success' ? 'bg-[#059669]' : 'bg-[#DC2626]'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
