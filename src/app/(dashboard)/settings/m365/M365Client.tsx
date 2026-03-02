'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — M365 Provisioning Client
// Microsoft 365 계정 프로비저닝 관리
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  Cloud,
  Loader2,
  UserPlus,
  UserMinus,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface ProvisioningLog {
  id: string
  employeeId: string
  email: string
  actionType: string
  status: string
  licensesRevoked: string[]
  convertToSharedMailbox: boolean
  errorMessage: string | null
  executedAt: string
  createdAt: string
}

interface M365Status {
  exists: boolean
  enabled: boolean
  licenses: string[]
  lastSignIn: string | null
}

// ─── Constants ──────────────────────────────────────────────

const ACTION_MAP: Record<string, { label: string; icon: typeof UserPlus; color: string }> = {
  PROVISION: { label: '계정 생성', icon: UserPlus, color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' },
  DISABLE: { label: '계정 비활성화', icon: UserMinus, color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]' },
  LICENSE_REVOKE: { label: '라이선스 회수', icon: Shield, color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]' },
  SHARED_MAILBOX_CONVERT: { label: '공유사서함 전환', icon: Mail, color: 'bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]' },
  REACTIVATE: { label: '계정 재활성화', icon: CheckCircle2, color: 'bg-[#E0E7FF] text-[#4338CA] border-[#C7D2FE]' },
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  M365_PENDING: { label: '처리중', color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]' },
  M365_SUCCESS: { label: '성공', color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' },
  M365_FAILED: { label: '실패', color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]' },
}

const M365_LICENSES = [
  { id: 'E3', name: 'Microsoft 365 E3' },
  { id: 'E5', name: 'Microsoft 365 E5' },
  { id: 'F1', name: 'Microsoft 365 F1' },
  { id: 'TEAMS', name: 'Microsoft Teams' },
  { id: 'EXCHANGE', name: 'Exchange Online' },
]

// ─── Component ──────────────────────────────────────────────

export function M365Client({ user }: { user: SessionUser }) {
  void user

  const [logs, setLogs] = useState<ProvisioningLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState<string>('all')

  // Provision modal
  const [provisionOpen, setProvisionOpen] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  const [provForm, setProvForm] = useState({
    employeeId: '',
    email: '',
    displayName: '',
    licenses: [] as string[],
  })

  // Disable modal
  const [disableOpen, setDisableOpen] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [disableForm, setDisableForm] = useState({
    employeeId: '',
    email: '',
    revokeAllLicenses: true,
    convertToShared: false,
  })

  // Status check
  const [statusEmail, setStatusEmail] = useState('')
  const [statusResult, setStatusResult] = useState<M365Status | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)

  // ─── Fetch Logs ───
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (actionFilter !== 'all') params.set('actionType', actionFilter)
      const res = await apiClient.get<{ data: ProvisioningLog[] }>(
        `/api/v1/m365/logs?${params}`
      )
      setLogs(res.data?.data ?? [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [actionFilter])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  // ─── Provision ───
  const handleProvision = async () => {
    setProvisioning(true)
    try {
      await apiClient.post('/api/v1/m365/provision', provForm)
      setProvisionOpen(false)
      setProvForm({ employeeId: '', email: '', displayName: '', licenses: [] })
      await fetchLogs()
    } catch {
      // handled
    } finally {
      setProvisioning(false)
    }
  }

  // ─── Disable ───
  const handleDisable = async () => {
    if (!confirm('M365 계정을 비활성화하시겠습니까?')) return
    setDisabling(true)
    try {
      await apiClient.post('/api/v1/m365/disable', disableForm)
      setDisableOpen(false)
      setDisableForm({ employeeId: '', email: '', revokeAllLicenses: true, convertToShared: false })
      await fetchLogs()
    } catch {
      // handled
    } finally {
      setDisabling(false)
    }
  }

  // ─── Status Check ───
  const handleCheckStatus = async () => {
    if (!statusEmail) return
    setCheckingStatus(true)
    try {
      const res = await apiClient.get<{ data: M365Status }>(
        `/api/v1/m365/status?email=${encodeURIComponent(statusEmail)}`
      )
      setStatusResult(res.data?.data ?? null)
    } catch {
      setStatusResult(null)
    } finally {
      setCheckingStatus(false)
    }
  }

  // ─── KPI ───
  const totalActions = logs.length
  const successActions = logs.filter(l => l.status === 'M365_SUCCESS').length
  const failedActions = logs.filter(l => l.status === 'M365_FAILED').length
  const provisionedCount = logs.filter(l => l.actionType === 'PROVISION' && l.status === 'M365_SUCCESS').length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
            <Cloud className="h-6 w-6 text-[#00C853]" />
            M365 계정 프로비저닝
          </h1>
          <p className="text-sm text-[#666] mt-1">Microsoft 365 계정 생성, 비활성화, 라이선스 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setDisableOpen(true)}
            className="border-[#FECACA] text-[#DC2626] hover:bg-[#FEE2E2]"
          >
            <UserMinus className="h-4 w-4 mr-2" />
            계정 비활성화
          </Button>
          <Button
            onClick={() => setProvisionOpen(true)}
            className="bg-[#00C853] hover:bg-[#00A844] text-white"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            계정 프로비저닝
          </Button>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[#666] mb-1">전체 작업</p>
            <p className="text-3xl font-bold text-[#1A1A1A]">{totalActions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[#666] mb-1">프로비저닝</p>
            <p className="text-3xl font-bold text-[#00C853]">{provisionedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[#666] mb-1">성공</p>
            <p className="text-3xl font-bold text-[#059669]">{successActions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[#666] mb-1">실패</p>
            <p className="text-3xl font-bold text-[#DC2626]">{failedActions}</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Status Check ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-[#999]" />
            계정 상태 조회
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              value={statusEmail}
              onChange={e => setStatusEmail(e.target.value)}
              placeholder="이메일 주소 입력"
              className="max-w-md"
            />
            <Button onClick={handleCheckStatus} disabled={checkingStatus} variant="outline">
              {checkingStatus ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              조회
            </Button>
          </div>

          {statusResult && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#FAFAFA] rounded-lg p-3">
                <p className="text-xs text-[#666]">계정 존재</p>
                <p className="font-semibold">{statusResult.exists ? '예' : '아니오'}</p>
              </div>
              <div className="bg-[#FAFAFA] rounded-lg p-3">
                <p className="text-xs text-[#666]">활성 상태</p>
                <Badge className={statusResult.enabled
                  ? 'bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]'
                  : 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]'
                }>
                  {statusResult.enabled ? '활성' : '비활성'}
                </Badge>
              </div>
              <div className="bg-[#FAFAFA] rounded-lg p-3">
                <p className="text-xs text-[#666]">라이선스</p>
                <p className="text-sm font-medium">{statusResult.licenses.join(', ') || '-'}</p>
              </div>
              <div className="bg-[#FAFAFA] rounded-lg p-3">
                <p className="text-xs text-[#666]">마지막 로그인</p>
                <p className="text-sm">{statusResult.lastSignIn ? new Date(statusResult.lastSignIn).toLocaleDateString('ko-KR') : '-'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Filter + Log List ─── */}
      <div className="flex items-center gap-3">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="작업 유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(ACTION_MAP).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-[#666]">
            <Cloud className="h-12 w-12 mx-auto mb-3 text-[#D4D4D4]" />
            <p>프로비저닝 이력이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const action = ACTION_MAP[log.actionType] ?? ACTION_MAP.PROVISION
            const status = STATUS_MAP[log.status] ?? STATUS_MAP.M365_PENDING
            const ActionIcon = action.icon

            return (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${action.color.split(' ')[0]}`}>
                        <ActionIcon className={`h-4 w-4 ${action.color.split(' ')[1]}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[#1A1A1A]">{action.label}</p>
                          <Badge className={`${status.color} border`}>{status.label}</Badge>
                        </div>
                        <p className="text-xs text-[#666]">{log.email}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-[#666]">
                        {new Date(log.executedAt).toLocaleString('ko-KR')}
                      </p>
                      {log.licensesRevoked.length > 0 && (
                        <p className="text-xs text-[#D97706]">
                          라이선스: {log.licensesRevoked.join(', ')}
                        </p>
                      )}
                      {log.convertToSharedMailbox && (
                        <p className="text-xs text-[#00C853]">공유사서함 전환</p>
                      )}
                      {log.errorMessage && (
                        <p className="text-xs text-[#EF4444]">{log.errorMessage}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ─── Provision Modal ─── */}
      <Dialog open={provisionOpen} onOpenChange={setProvisionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>M365 계정 프로비저닝</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#333] mb-1 block">직원 ID</label>
              <Input
                value={provForm.employeeId}
                onChange={e => setProvForm(p => ({ ...p, employeeId: e.target.value }))}
                placeholder="직원 UUID"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#333] mb-1 block">이메일</label>
              <Input
                type="email"
                value={provForm.email}
                onChange={e => setProvForm(p => ({ ...p, email: e.target.value }))}
                placeholder="user@ctr.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#333] mb-1 block">표시 이름</label>
              <Input
                value={provForm.displayName}
                onChange={e => setProvForm(p => ({ ...p, displayName: e.target.value }))}
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#333] mb-2 block">라이선스</label>
              <div className="space-y-2">
                {M365_LICENSES.map(lic => (
                  <label key={lic.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={provForm.licenses.includes(lic.id)}
                      onChange={e => {
                        setProvForm(p => ({
                          ...p,
                          licenses: e.target.checked
                            ? [...p.licenses, lic.id]
                            : p.licenses.filter(l => l !== lic.id),
                        }))
                      }}
                      className="rounded border-[#D4D4D4]"
                    />
                    {lic.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProvisionOpen(false)}>취소</Button>
            <Button
              onClick={handleProvision}
              disabled={provisioning || !provForm.email || !provForm.displayName}
              className="bg-[#00C853] hover:bg-[#00A844] text-white"
            >
              {provisioning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              프로비저닝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Disable Modal ─── */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#DC2626]">M365 계정 비활성화</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#333] mb-1 block">직원 ID</label>
              <Input
                value={disableForm.employeeId}
                onChange={e => setDisableForm(p => ({ ...p, employeeId: e.target.value }))}
                placeholder="직원 UUID"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#333] mb-1 block">이메일</label>
              <Input
                type="email"
                value={disableForm.email}
                onChange={e => setDisableForm(p => ({ ...p, email: e.target.value }))}
                placeholder="user@ctr.com"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#333]">전체 라이선스 회수</label>
              <Switch
                checked={disableForm.revokeAllLicenses}
                onCheckedChange={v => setDisableForm(p => ({ ...p, revokeAllLicenses: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#333]">공유 사서함 전환</label>
              <Switch
                checked={disableForm.convertToShared}
                onCheckedChange={v => setDisableForm(p => ({ ...p, convertToShared: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableOpen(false)}>취소</Button>
            <Button
              onClick={handleDisable}
              disabled={disabling || !disableForm.email}
              variant="destructive"
            >
              {disabling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              비활성화 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
