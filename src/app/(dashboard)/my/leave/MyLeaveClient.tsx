'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import {
  CalendarDays, Plus, Loader2, AlertTriangle, Clock,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

// ─── 타입 ─────────────────────────────────────────────────

interface LeaveTypeDef {
  id: string
  code: string
  name: string
  isPaid: boolean
  allowHalfDay: boolean
}

interface YearBalance {
  id: string
  leaveTypeDefId: string
  year: number
  entitled: number
  used: number
  carriedOver: number
  adjusted: number
  pending: number
  remaining: number
  expiresAt: string | null
  leaveTypeDef: LeaveTypeDef
}

interface LeaveRequest {
  id: string
  startDate: string
  endDate: string
  days: number
  status: string
  reason: string | null
  createdAt: string
  policy: { name: string; leaveType: string } | null
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: '대기중', color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]', icon: <Clock className="w-3 h-3" /> },
  APPROVED: { label: '승인', color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]', icon: <CheckCircle2 className="w-3 h-3" /> },
  REJECTED: { label: '반려', color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]', icon: <XCircle className="w-3 h-3" /> },
  CANCELLED: { label: '취소', color: 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]', icon: null },
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────

export function MyLeaveClient({ user }: { user: SessionUser }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [balances, setBalances] = useState<YearBalance[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loadingBalances, setLoadingBalances] = useState(true)
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBalances = useCallback(async () => {
    setLoadingBalances(true)
    try {
      const res = await apiClient.get<YearBalance[]>('/api/v1/leave/year-balances', { year: String(year) })
      setBalances(res.data ?? [])
    } catch {
      setError('잔여 휴가 정보를 불러오지 못했습니다.')
    } finally {
      setLoadingBalances(false)
    }
  }, [year])

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true)
    try {
      const res = await apiClient.getList<LeaveRequest>('/api/v1/leave/requests', { limit: '50' })
      setRequests(res.data ?? [])
    } catch {
      // silent — old system may not have data
      setRequests([])
    } finally {
      setLoadingRequests(false)
    }
  }, [])

  useEffect(() => { loadBalances() }, [loadBalances])
  useEffect(() => { loadRequests() }, [loadRequests])

  const totalEntitled = balances.reduce((sum, b) => sum + b.entitled + b.carriedOver + b.adjusted, 0)
  const totalUsed = balances.reduce((sum, b) => sum + b.used, 0)
  const totalPending = balances.reduce((sum, b) => sum + b.pending, 0)
  const totalRemaining = balances.reduce((sum, b) => sum + b.remaining, 0)

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-[#00C853]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">내 휴가</h1>
            <p className="text-sm text-[#666] mt-0.5">연간 부여 현황 및 사용 내역을 확인합니다</p>
          </div>
        </div>
        {/* 연도 선택기 */}
        <div className="flex items-center gap-2">
          <button onClick={() => setYear((y) => y - 1)} className="p-1.5 hover:bg-[#F5F5F5] rounded-lg">
            <ChevronLeft className="w-4 h-4 text-[#555]" />
          </button>
          <span className="text-lg font-bold text-[#1A1A1A] min-w-16 text-center">{year}년</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= new Date().getFullYear()}
            className="p-1.5 hover:bg-[#F5F5F5] rounded-lg disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4 text-[#555]" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[#B91C1C] text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* KPI 카드 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '총 부여일수', value: totalEntitled, unit: '일', color: 'text-[#1A1A1A]' },
          { label: '사용', value: totalUsed, unit: '일', color: 'text-[#059669]' },
          { label: '대기중', value: totalPending, unit: '일', color: 'text-[#B45309]' },
          { label: '잔여', value: totalRemaining, unit: '일', color: 'text-[#00C853]' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-[#E8E8E8] p-5">
            <p className="text-xs text-[#666] mb-1">{kpi.label}</p>
            <p className={`text-3xl font-bold ${kpi.color}`}>
              {kpi.value}
              <span className="text-sm font-normal ml-1 text-[#999]">{kpi.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 유형별 잔여 현황 */}
      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        <div className="px-5 py-4 border-b border-[#F5F5F5] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1A1A1A]">유형별 휴가 현황</h2>
          {loadingBalances && <Loader2 className="w-4 h-4 animate-spin text-[#00C853]" />}
        </div>

        {!loadingBalances && balances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#999]">
            <CalendarDays className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">{year}년 부여된 휴가 정보가 없습니다</p>
            <p className="text-xs mt-1">관리자에게 연간 부여 실행을 요청하세요</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {balances.map((b) => {
              const total = b.entitled + b.carriedOver + b.adjusted
              const usedPct = total > 0 ? Math.min(100, (b.used / total) * 100) : 0
              const pendingPct = total > 0 ? Math.min(100 - usedPct, (b.pending / total) * 100) : 0

              return (
                <div key={b.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#1A1A1A]">{b.leaveTypeDef.name}</span>
                      {b.leaveTypeDef.isPaid
                        ? <span className="text-xs text-[#047857] bg-[#D1FAE5] px-1.5 py-0.5 rounded-full">유급</span>
                        : <span className="text-xs text-[#B45309] bg-[#FEF3C7] px-1.5 py-0.5 rounded-full">무급</span>
                      }
                      {b.carriedOver > 0 && (
                        <span className="text-xs text-[#4338CA] bg-[#E0E7FF] px-1.5 py-0.5 rounded-full">이월 {b.carriedOver}일 포함</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-[#00C853]">{b.remaining}</span>
                      <span className="text-xs text-[#999]">/ {total}일</span>
                    </div>
                  </div>

                  {/* 사용률 바 */}
                  <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                    <div className="h-full flex">
                      <div
                        className="bg-[#059669] rounded-full transition-all"
                        style={{ width: `${usedPct}%` }}
                      />
                      {pendingPct > 0 && (
                        <div
                          className="bg-[#FCD34D] rounded-full transition-all"
                          style={{ width: `${pendingPct}%` }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#999]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-[#059669] rounded-full inline-block" />
                      사용 {b.used}일
                    </span>
                    {b.pending > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-[#FCD34D] rounded-full inline-block" />
                        대기 {b.pending}일
                      </span>
                    )}
                    {b.expiresAt && (
                      <span className="text-[#DC2626]">
                        소멸 {format(new Date(b.expiresAt), 'M/d', { locale: ko })}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 사용 내역 */}
      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        <div className="px-5 py-4 border-b border-[#F5F5F5] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1A1A1A]">휴가 신청 내역</h2>
          {loadingRequests && <Loader2 className="w-4 h-4 animate-spin text-[#00C853]" />}
        </div>

        {!loadingRequests && requests.length === 0 ? (
          <p className="text-center text-sm text-[#999] py-10">신청 내역이 없습니다</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
                {['휴가 유형', '기간', '일수', '상태', '신청일'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#666] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.slice(0, 20).map((r) => {
                const st = STATUS_LABELS[r.status] ?? STATUS_LABELS.PENDING
                return (
                  <tr key={r.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 text-sm text-[#1A1A1A]">
                      {r.policy?.name ?? r.policy?.leaveType ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#555]">
                      {format(new Date(r.startDate), 'yy.M.d')} ~ {format(new Date(r.endDate), 'yy.M.d')}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#555]">{r.days}일</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>
                        {st.icon}
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#999]">
                      {format(new Date(r.createdAt), 'yy.M.d')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
