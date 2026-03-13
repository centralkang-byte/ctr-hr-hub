'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 퇴직금 중간정산 탭
// 신청 목록 테이블 + 상태뱃지 + 승인/반려 액션
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Calculator,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
} from 'lucide-react'
import SeveranceInterimForm from './SeveranceInterimForm'
import { BUTTON_VARIANTS } from '@/lib/styles'

type SipStatus = 'SIP_PENDING' | 'SIP_APPROVED' | 'SIP_REJECTED' | 'SIP_PAID'

interface SeveranceInterimRequest {
  id: string
  employeeId: string
  employeeName: string
  employeeNo: string
  department: string
  reason: string
  requestDate: string
  estimatedAmount: number
  status: SipStatus
  reviewedAt?: string
  reviewedBy?: string
  paidAt?: string
}

const STATUS_MAP: Record<SipStatus, { label: string; className: string }> = {
  SIP_PENDING: {
    label: '검토 중',
    className: 'bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]',
  },
  SIP_APPROVED: {
    label: '승인',
    className: 'bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]',
  },
  SIP_REJECTED: {
    label: '반려',
    className: 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]',
  },
  SIP_PAID: {
    label: '지급 완료',
    className: 'bg-[#EEF2FF] text-[#4338CA] border border-[#EEF2FF]',
  },
}

const REASON_LABELS: Record<string, string> = {
  HOUSING_PURCHASE: '주택 구입',
  HOUSING_LEASE: '주거 임차',
  MEDICAL_EXPENSES: '의료비',
  NATURAL_DISASTER: '재난·재해',
  RETIREMENT_INSURANCE: '퇴직연금 전환',
  OTHER: '기타',
}

const MOCK_REQUESTS: SeveranceInterimRequest[] = [
  {
    id: '1',
    employeeId: 'e1',
    employeeName: '김철수',
    employeeNo: 'KR-001',
    department: '생산팀',
    reason: 'HOUSING_PURCHASE',
    requestDate: '2026-02-15',
    estimatedAmount: 12500000,
    status: 'SIP_PENDING',
  },
  {
    id: '2',
    employeeId: 'e2',
    employeeName: '이영희',
    employeeNo: 'KR-002',
    department: '품질팀',
    reason: 'MEDICAL_EXPENSES',
    requestDate: '2026-02-01',
    estimatedAmount: 8200000,
    status: 'SIP_APPROVED',
    reviewedAt: '2026-02-05',
    reviewedBy: '인사팀장',
  },
  {
    id: '3',
    employeeId: 'e3',
    employeeName: '박민준',
    employeeNo: 'KR-003',
    department: '물류팀',
    reason: 'HOUSING_LEASE',
    requestDate: '2026-01-20',
    estimatedAmount: 5500000,
    status: 'SIP_PAID',
    reviewedAt: '2026-01-25',
    paidAt: '2026-02-10',
  },
  {
    id: '4',
    employeeId: 'e4',
    employeeName: '최수진',
    employeeNo: 'KR-004',
    department: '인사팀',
    reason: 'OTHER',
    requestDate: '2026-01-10',
    estimatedAmount: 3100000,
    status: 'SIP_REJECTED',
    reviewedAt: '2026-01-15',
    reviewedBy: '인사팀장',
  },
]

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원'
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function SeveranceInterimTab() {
  const [requests, setRequests] = useState<SeveranceInterimRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/compliance/kr/severance-interim')
      if (res.ok) {
        const json = await res.json()
        const list = json.data ?? json.requests ?? json
        setRequests(Array.isArray(list) ? list : [])
      } else {
        setRequests(MOCK_REQUESTS)
      }
    } catch {
      setRequests(MOCK_REQUESTS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id + action)
    try {
      const res = await fetch(`/api/v1/compliance/kr/severance-interim/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        await fetchRequests()
      } else {
        // Update locally for demo
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: action === 'approve' ? 'SIP_APPROVED' : 'SIP_REJECTED',
                  reviewedAt: new Date().toISOString().slice(0, 10),
                }
              : r
          )
        )
      }
    } catch {
      // Silent fail for demo
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">퇴직금 중간정산</h2>
          <p className="text-sm text-[#666] mt-0.5">
            중간정산 신청 현황 및 승인 처리를 관리합니다.
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className={`flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm transition-colors`}
        >
          <Plus className="w-4 h-4" />
          신규 신청
        </button>
      </div>

      {/* Summary Chips */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_MAP) as SipStatus[]).map((status) => {
          const count = requests.filter((r) => r.status === status).length
          const info = STATUS_MAP[status]
          return (
            <span
              key={status}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${info.className}`}
            >
              {info.label}: {count}건
            </span>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#F5F5F5]">
                <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">
                  직원
                </th>
                <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">
                  사유
                </th>
                <th className="px-4 py-3 text-right text-xs text-[#666] font-medium uppercase tracking-wider">
                  예상 지급액
                </th>
                <th className="px-4 py-3 text-center text-xs text-[#666] font-medium uppercase tracking-wider">
                  신청일
                </th>
                <th className="px-4 py-3 text-center text-xs text-[#666] font-medium uppercase tracking-wider">
                  상태
                </th>
                <th className="px-4 py-3 text-center text-xs text-[#666] font-medium uppercase tracking-wider">
                  처리일
                </th>
                <th className="px-4 py-3 text-center text-xs text-[#666] font-medium uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#F5F5F5]">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-[#F5F5F5] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-[#999]">
                      <FileText className="w-8 h-8" />
                      <p className="text-sm">신청 내역이 없습니다.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const statusInfo = STATUS_MAP[req.status]
                  const isPending = req.status === 'SIP_PENDING'
                  return (
                    <tr
                      key={req.id}
                      className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA] transition-colors"
                    >
                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-[#1A1A1A]">{req.employeeName}</p>
                          <p className="text-xs text-[#999]">
                            {req.employeeNo} · {req.department}
                          </p>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-[#333]">
                          {REASON_LABELS[req.reason] ?? req.reason}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-[#1A1A1A]">
                          {formatCurrency(req.estimatedAmount)}
                        </span>
                      </td>

                      {/* Request Date */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-[#555]">{formatDate(req.requestDate)}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Reviewed/Paid At */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-[#666]">
                          {req.paidAt
                            ? `지급: ${formatDate(req.paidAt)}`
                            : req.reviewedAt
                            ? formatDate(req.reviewedAt)
                            : '-'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Calculate button always shown */}
                          <button
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-[#D4D4D4] text-[#555] hover:bg-[#FAFAFA] transition-colors"
                            title="중간정산 계산"
                          >
                            <Calculator className="w-3 h-3" />
                            계산
                          </button>

                          {isPending && (
                            <>
                              <button
                                onClick={() => handleReview(req.id, 'approve')}
                                disabled={actionLoading === req.id + 'approve'}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#059669] hover:bg-[#047857] text-white disabled:opacity-50 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                승인
                              </button>
                              <button
                                onClick={() => handleReview(req.id, 'reject')}
                                disabled={actionLoading === req.id + 'reject'}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEE2E2] disabled:opacity-50 transition-colors"
                              >
                                <XCircle className="w-3 h-3" />
                                반려
                              </button>
                            </>
                          )}

                          {req.status === 'SIP_REJECTED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-[#DC2626]">
                              <AlertCircle className="w-3 h-3" />
                              반려됨
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Request Modal */}
      {showForm && (
        <SeveranceInterimForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            fetchRequests()
          }}
        />
      )}
    </div>
  )
}
