'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Delegation Settings Page
// /delegation/settings — 위임 설정 관리
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck,
  Plus,
  XCircle,
  Search,
  CalendarDays,
  User,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api'
import { formatDateLocale } from '@/lib/format/date'
import type { SessionUser } from '@/types'

// ─── Types ───────────────────────────────────────────────

interface EligibleDelegatee {
  id: string
  name: string
  email: string
  department: string | null
  jobGrade: string | null
}

interface DelegationRecord {
  id: string
  delegatorId: string
  delegateeId: string
  companyId: string
  scope: 'LEAVE_ONLY' | 'ALL'
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED'
  reason: string | null
  startDate: string
  endDate: string
  revokedAt: string | null
  createdAt: string
  delegatee?: { id: string; name: string; assignments?: Array<{ department?: { name: string }; jobGrade?: { name: string } }> }
  delegator?: { id: string; name: string; assignments?: Array<{ department?: { name: string }; jobGrade?: { name: string } }> }
}

type ViewMode = 'list' | 'create'

// ─── Helpers ─────────────────────────────────────────────

function getDaysLeft(endDate: string): number {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ─── Component ───────────────────────────────────────────

export function DelegationSettingsClient({ user: _user }: { user: SessionUser }) {
  const [view, setView] = useState<ViewMode>('list')
  const [delegated, setDelegated] = useState<DelegationRecord[]>([])
  const [received, setReceived] = useState<DelegationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // Create form state
  const [eligible, setEligible] = useState<EligibleDelegatee[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDelegatee, setSelectedDelegatee] = useState<EligibleDelegatee | null>(null)
  const [scope, setScope] = useState<'LEAVE_ONLY' | 'ALL'>('LEAVE_ONLY')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // ── Data Fetch ─────────────────────────────────────────

  const fetchDelegations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ delegated: DelegationRecord[]; received: DelegationRecord[] }>(
        `/api/v1/delegation?type=all&includeExpired=${showHistory}`
      )
      setDelegated(res.data.delegated)
      setReceived(res.data.received)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [showHistory])

  useEffect(() => { void fetchDelegations() }, [fetchDelegations])

  // ── Search Eligible ────────────────────────────────────

  useEffect(() => {
    if (view !== 'create') return
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await apiClient.get<EligibleDelegatee[]>(
          `/api/v1/delegation/eligible?search=${encodeURIComponent(searchQuery)}`
        )
        setEligible(res.data)
      } catch {
        // silent
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, view])

  // ── Create Delegation ──────────────────────────────────

  const handleCreate = async () => {
    if (!selectedDelegatee || !startDate || !endDate) {
      setError('수임자, 시작일, 종료일을 모두 선택해주세요.')
      return
    }

    setProcessing(true)
    setError(null)
    try {
      await apiClient.post('/api/v1/delegation', {
        delegateeId: selectedDelegatee.id,
        scope,
        reason: reason || undefined,
        startDate,
        endDate,
      })
      setView('list')
      resetForm()
      void fetchDelegations()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? '위임 생성에 실패했습니다.'
      setError(msg)
    } finally {
      setProcessing(false)
    }
  }

  // ── Revoke Delegation ─────────────────────────────────

  const handleRevoke = async (id: string) => {
    setProcessing(true)
    try {
      await apiClient.put(`/api/v1/delegation/${id}/revoke`, {})
      void fetchDelegations()
    } catch {
      // silent
    } finally {
      setProcessing(false)
    }
  }

  const resetForm = () => {
    setSelectedDelegatee(null)
    setScope('LEAVE_ONLY')
    setStartDate('')
    setEndDate('')
    setReason('')
    setSearchQuery('')
    setError(null)
  }

  // ── Active delegations ────────────────────────────────

  const activeDelegated = delegated.filter((d) => d.status === 'ACTIVE')
  const historyDelegated = delegated.filter((d) => d.status !== 'ACTIVE')
  const activeReceived = received.filter((d) => d.status === 'ACTIVE')

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="위임 설정"
        description="부재 시 승인 권한을 위임하여 업무 중단을 방지합니다."
      />

      {/* ── Info Banner ── */}
      <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-primary/10 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-xs text-primary">
          <p className="font-medium">승인 위임 안내</p>
          <p className="mt-1 text-muted-foreground">
            출장, 휴가 등 부재 시 다른 매니저에게 승인 권한을 위임할 수 있습니다.
            수임자는 위임 기간 동안 귀하의 팀 휴가 승인/반려를 처리할 수 있습니다.
            최대 30일까지 설정 가능합니다.
          </p>
        </div>
      </div>

      {view === 'list' ? (
        <>
          {/* ── Active Delegations (Given) ── */}
          <Card className="border-border">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-bold text-foreground">
                  내가 설정한 위임
                </CardTitle>
                {activeDelegated.length > 0 && (
                  <Badge className="bg-primary text-white text-[10px] px-1.5 rounded-full">
                    {activeDelegated.length}
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                className="gap-1.5 bg-primary text-white hover:bg-primary/80"
                onClick={() => { resetForm(); setView('create') }}
              >
                <Plus className="h-3.5 w-3.5" />
                새 위임 설정
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeDelegated.length === 0 ? (
                <EmptyState
                  icon={<ShieldCheck className="h-10 w-10" />}
                  title="활성 위임이 없습니다"
                  description="부재 시 위임을 설정하면 승인 업무가 원활하게 처리됩니다."
                />
              ) : (
                <div className="space-y-3">
                  {activeDelegated.map((d) => {
                    const daysLeft = getDaysLeft(d.endDate)
                    return (
                      <div
                        key={d.id}
                        className="flex items-center justify-between rounded-xl border border-primary/20 bg-background p-4 transition-all hover:shadow-sm"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {d.delegatee?.name ?? '알 수 없음'}
                              </span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <Badge
                                variant="outline"
                                className="text-[10px] border-indigo-200 text-primary"
                              >
                                {d.scope === 'ALL' ? '전체' : '휴가'}
                              </Badge>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                              <CalendarDays className="h-3 w-3" />
                              <span>{formatDateLocale(d.startDate)} ~ {formatDateLocale(d.endDate)}</span>
                              {daysLeft > 0 && (
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] px-1 ${daysLeft <= 3 ? 'border-destructive/20 text-red-500' : 'border-indigo-200 text-primary'}`}
                                >
                                  D-{daysLeft}
                                </Badge>
                              )}
                            </div>
                            {d.reason && (
                              <p className="mt-1 text-[11px] text-muted-foreground">{d.reason}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-[11px] text-red-500 border-destructive/20 hover:bg-destructive/10"
                          disabled={processing}
                          onClick={() => handleRevoke(d.id)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          해제
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Received Delegations ── */}
          {activeReceived.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <CardTitle className="text-base font-bold text-foreground">
                    나에게 위임된 승인 권한
                  </CardTitle>
                  <Badge className="bg-emerald-500/100 text-white text-[10px] px-1.5 rounded-full">
                    {activeReceived.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeReceived.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-4 rounded-xl border border-emerald-100 bg-tertiary-container/10 p-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/100/10">
                        <User className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {d.delegator?.name ?? '알 수 없음'}
                          </span>
                          <span className="text-[11px] text-muted-foreground">님의 승인 권한</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          <span>{formatDateLocale(d.startDate)} ~ {formatDateLocale(d.endDate)}</span>
                          <Badge variant="outline" className="text-[9px] border-emerald-100 text-emerald-500">
                            {d.scope === 'ALL' ? '전체' : '휴가'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── History Toggle ── */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Clock className="h-3.5 w-3.5" />
              {showHistory ? '이력 숨기기' : '이력 보기'}
            </button>
          </div>

          {/* ── History ── */}
          {showHistory && historyDelegated.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground">이력</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {historyDelegated.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
                    >
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">
                            {d.delegatee?.name ?? '알 수 없음'}
                          </span>
                          <span className="ml-2 text-[10px] text-muted-foreground/60">
                            {formatDateLocale(d.startDate)} ~ {formatDateLocale(d.endDate)}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${d.status === 'EXPIRED' ? 'border-amber-300 text-amber-700' : 'border-destructive/20 text-red-500'}`}
                      >
                        {d.status === 'EXPIRED' ? '만료' : '해제'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* ── Create View ── */
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-foreground">
                새 위임 설정
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setView('list'); resetForm() }}
                className="text-muted-foreground"
              >
                취소
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-red-500">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Step 1: Select Delegatee */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                수임자 선택 <span className="text-red-500">*</span>
              </label>
              {selectedDelegatee ? (
                <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-background p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{selectedDelegatee.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedDelegatee.department ?? ''} · {selectedDelegatee.jobGrade ?? ''}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDelegatee(null)}
                    className="text-muted-foreground h-7"
                  >
                    변경
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={'이름 또는 이메일로 검색...'}
                      className="pl-9 h-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {eligible.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                      {eligible.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setSelectedDelegatee(e)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border last:border-0"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground">{e.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {e.department ?? ''} · {e.email}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Scope */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">위임 범위</label>
              <Select value={scope} onValueChange={(v) => setScope(v as 'LEAVE_ONLY' | 'ALL')}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEAVE_ONLY">휴가 승인만</SelectItem>
                  <SelectItem value="ALL">전체 승인</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Step 3: Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  시작일 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  종료일 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10"
                  min={startDate || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {/* Step 4: Reason */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">사유 (선택)</label>
              <Input
                placeholder="출장, 휴가 등..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-10"
                maxLength={200}
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => { setView('list'); resetForm() }}
              >
                취소
              </Button>
              <Button
                className="gap-1.5 bg-primary text-white hover:bg-primary/80"
                onClick={handleCreate}
                disabled={processing || !selectedDelegatee || !startDate || !endDate}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                위임 설정
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
