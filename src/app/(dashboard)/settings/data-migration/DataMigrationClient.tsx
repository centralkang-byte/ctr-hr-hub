'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Data Migration Client
// 데이터 마이그레이션 도구: 생성 → 검증 → 실행 → 결과
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  Database,
  Loader2,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileUp,
  Trash2,
  Eye,
  ClipboardCheck,
  BarChart3,
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
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface MigrationJob {
  id: string
  name: string
  description: string | null
  sourceType: string
  dataScope: string
  status: string
  totalRecords: number
  processedRecords: number
  successRecords: number
  errorRecords: number
  validationErrors: unknown
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  _count?: { logs: number }
  logs?: MigrationLog[]
}

interface MigrationLog {
  id: string
  level: string
  message: string
  recordRef: string | null
  createdAt: string
}

interface Template {
  scope: string
  requiredFields: string[]
  sampleTemplate: Record<string, string>
}

// ─── Constants ──────────────────────────────────────────────

const SCOPE_MAP: Record<string, { label: string; icon: typeof Database }> = {
  EMPLOYEES: { label: '인사 마스터', icon: Database },
  ATTENDANCE: { label: '근태 데이터', icon: BarChart3 },
  PAYROLL: { label: '급여 데이터', icon: BarChart3 },
  LEAVE: { label: '휴가 데이터', icon: BarChart3 },
  PERFORMANCE: { label: '성과 데이터', icon: BarChart3 },
  ALL: { label: '전체', icon: Database },
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Loader2 }> = {
  DRAFT: { label: '초안', color: 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]', icon: FileUp },
  VALIDATING: { label: '검증중', color: 'bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]', icon: Loader2 },
  VALIDATED: { label: '검증완료', color: 'bg-[#E0E7FF] text-[#4338CA] border-[#C7D2FE]', icon: ClipboardCheck },
  RUNNING: { label: '실행중', color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]', icon: Loader2 },
  COMPLETED: { label: '완료', color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]', icon: CheckCircle2 },
  FAILED: { label: '실패', color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]', icon: XCircle },
  ROLLED_BACK: { label: '롤백', color: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]', icon: AlertTriangle },
}

const LOG_LEVEL_COLORS: Record<string, string> = {
  INFO: 'text-[#00C853]',
  WARNING: 'text-[#D97706]',
  ERROR: 'text-[#DC2626]',
}

const SOURCE_TYPES = ['CSV', 'EXCEL', 'JSON', 'API']

// ─── Component ──────────────────────────────────────────────

export function DataMigrationClient({ user }: { user: SessionUser }) {
  void user

  const [jobs, setJobs] = useState<MigrationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newJob, setNewJob] = useState({
    name: '',
    description: '',
    sourceType: 'CSV',
    dataScope: 'EMPLOYEES',
  })

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<MigrationJob | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Template
  const [templateData, setTemplateData] = useState<Template | null>(null)

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ─── Fetch Jobs ───
  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await apiClient.get<{ data: MigrationJob[] }>(
        `/api/v1/migration/jobs?${params}`
      )
      setJobs(res.data?.data ?? [])
    } catch {
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void fetchJobs()
  }, [fetchJobs])

  // ─── Create Job ───
  const handleCreate = async () => {
    setCreating(true)
    try {
      await apiClient.post('/api/v1/migration/jobs', {
        name: newJob.name,
        description: newJob.description || null,
        sourceType: newJob.sourceType,
        dataScope: newJob.dataScope,
      })
      setCreateOpen(false)
      setNewJob({ name: '', description: '', sourceType: 'CSV', dataScope: 'EMPLOYEES' })
      await fetchJobs()
    } catch {
      // handled
    } finally {
      setCreating(false)
    }
  }

  // ─── View Detail ───
  const handleViewDetail = async (job: MigrationJob) => {
    setSelectedJob(job)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await apiClient.get<{ data: MigrationJob }>(`/api/v1/migration/jobs/${job.id}`)
      setSelectedJob(res.data?.data ?? job)
    } catch {
      // keep original
    } finally {
      setDetailLoading(false)
    }
  }

  // ─── Validate ───
  const handleValidate = async (jobId: string) => {
    setActionLoading(jobId)
    try {
      // Mock data for validation
      const mockData = [
        { employeeNo: 'EMP001', name: '홍길동', email: 'hong@ctr.com', departmentId: 'dept-1', jobGradeId: 'jg-1', hireDate: '2020-01-01', status: 'ACTIVE' },
        { employeeNo: 'EMP002', name: '김철수', email: 'kim@ctr.com', departmentId: 'dept-2', jobGradeId: 'jg-2', hireDate: '2021-03-15', status: 'ACTIVE' },
        { employeeNo: 'EMP003', name: '이영희', email: 'lee@ctr.com', departmentId: 'dept-1', jobGradeId: 'jg-3', hireDate: '2019-06-01', status: 'ACTIVE' },
      ]
      await apiClient.post(`/api/v1/migration/jobs/${jobId}/validate`, { data: mockData })
      await fetchJobs()
    } catch {
      // handled
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Execute ───
  const handleExecute = async (jobId: string) => {
    if (!confirm('마이그레이션을 실행하시겠습니까? 이 작업은 되돌리기 어려울 수 있습니다.')) return
    setActionLoading(jobId)
    try {
      const mockData = [
        { employeeNo: 'EMP001', name: '홍길동', email: 'hong@ctr.com', departmentId: 'dept-1', jobGradeId: 'jg-1', hireDate: '2020-01-01', status: 'ACTIVE' },
        { employeeNo: 'EMP002', name: '김철수', email: 'kim@ctr.com', departmentId: 'dept-2', jobGradeId: 'jg-2', hireDate: '2021-03-15', status: 'ACTIVE' },
        { employeeNo: 'EMP003', name: '이영희', email: 'lee@ctr.com', departmentId: 'dept-1', jobGradeId: 'jg-3', hireDate: '2019-06-01', status: 'ACTIVE' },
      ]
      await apiClient.post(`/api/v1/migration/jobs/${jobId}/execute`, { data: mockData })
      await fetchJobs()
    } catch {
      // handled
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Delete ───
  const handleDelete = async (jobId: string) => {
    if (!confirm('이 마이그레이션 작업을 삭제하시겠습니까?')) return
    try {
      await apiClient.delete(`/api/v1/migration/jobs/${jobId}`)
      await fetchJobs()
    } catch {
      // handled
    }
  }

  // ─── Fetch Template ───
  const handleFetchTemplate = async (scope: string) => {
    try {
      const res = await apiClient.get<{ data: Template }>(`/api/v1/migration/templates?scope=${scope}`)
      setTemplateData(res.data?.data ?? null)
    } catch {
      setTemplateData(null)
    }
  }

  // ─── KPI ───
  const totalJobs = jobs.length
  const completedJobs = jobs.filter(j => j.status === 'COMPLETED').length
  const runningJobs = jobs.filter(j => ['VALIDATING', 'RUNNING'].includes(j.status)).length
  const failedJobs = jobs.filter(j => j.status === 'FAILED').length

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
            <Database className="h-6 w-6 text-[#00C853]" />
            데이터 마이그레이션
          </h1>
          <p className="text-sm text-[#666] mt-1">외부 시스템 데이터 검증 및 이관 도구</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#00C853] hover:bg-[#00A844] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          새 마이그레이션
        </Button>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[#666] mb-1">전체 작업</p>
            <p className="text-3xl font-bold text-[#1A1A1A]">{totalJobs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[#666] mb-1">실행중</p>
            <p className="text-3xl font-bold text-[#D97706]">{runningJobs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[#666] mb-1">완료</p>
            <p className="text-3xl font-bold text-[#059669]">{completedJobs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[#666] mb-1">실패</p>
            <p className="text-3xl font-bold text-[#DC2626]">{failedJobs}</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Filter ─── */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {Object.entries(STATUS_MAP).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── Job List ─── */}
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-[#666]">
            <Database className="h-12 w-12 mx-auto mb-3 text-[#D4D4D4]" />
            <p>마이그레이션 작업이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {
            const st = STATUS_MAP[job.status] ?? STATUS_MAP.DRAFT
            const scope = SCOPE_MAP[job.dataScope] ?? SCOPE_MAP.ALL
            const isProcessing = actionLoading === job.id
            const progress = job.totalRecords > 0
              ? Math.round((job.processedRecords / job.totalRecords) * 100)
              : 0

            return (
              <Card key={job.id} className="hover:border-[#E8F5E9] transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-[#1A1A1A]">{job.name}</p>
                          <Badge className={`${st.color} border`}>{st.label}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#666]">
                          <span className="bg-[#F5F5F5] px-1.5 py-0.5 rounded">{scope.label}</span>
                          <span>{job.sourceType}</span>
                          <span>·</span>
                          <span>{new Date(job.createdAt).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Progress stats */}
                      {job.totalRecords > 0 && (
                        <div className="text-right text-xs text-[#666]">
                          <p>
                            <span className="font-medium text-[#1A1A1A]">{job.processedRecords}</span>
                            /{job.totalRecords}건
                          </p>
                          <p>
                            {job.successRecords > 0 && (
                              <span className="text-[#059669]">{job.successRecords} 성공</span>
                            )}
                            {job.errorRecords > 0 && (
                              <span className="text-[#EF4444] ml-1">{job.errorRecords} 오류</span>
                            )}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetail(job)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          상세
                        </Button>

                        {job.status === 'DRAFT' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleValidate(job.id)}
                              disabled={isProcessing}
                              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white"
                            >
                              {isProcessing ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              ) : (
                                <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                              )}
                              검증
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(job.id)}
                              className="text-[#EF4444] hover:text-[#B91C1C]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}

                        {job.status === 'VALIDATED' && (
                          <Button
                            size="sm"
                            onClick={() => handleExecute(job.id)}
                            disabled={isProcessing}
                            className="bg-[#059669] hover:bg-[#047857] text-white"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5 mr-1" />
                            )}
                            실행
                          </Button>
                        )}

                        {job.status === 'FAILED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(job.id)}
                            className="text-[#EF4444] hover:text-[#B91C1C]"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            삭제
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {job.totalRecords > 0 && ['RUNNING', 'COMPLETED', 'FAILED'].includes(job.status) && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-[#666] mb-1">
                        <span>진행률</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#E8E8E8] overflow-hidden">
                        <div
                          className={`h-full transition-all rounded-full ${
                            job.status === 'FAILED' ? 'bg-[#EF4444]' :
                            job.status === 'COMPLETED' ? 'bg-[#059669]' : 'bg-[#00C853]'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {job.description && (
                    <p className="text-xs text-[#999] mt-2">{job.description}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ─── Create Modal ─── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>새 마이그레이션 작업</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#333] mb-1 block">작업명</label>
              <Input
                value={newJob.name}
                onChange={e => setNewJob(p => ({ ...p, name: e.target.value }))}
                placeholder="예: 2025 인사 데이터 이관"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#333] mb-1 block">설명</label>
              <Input
                value={newJob.description}
                onChange={e => setNewJob(p => ({ ...p, description: e.target.value }))}
                placeholder="설명 (선택)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">소스 형식</label>
                <Select
                  value={newJob.sourceType}
                  onValueChange={v => setNewJob(p => ({ ...p, sourceType: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">데이터 범위</label>
                <Select
                  value={newJob.dataScope}
                  onValueChange={v => {
                    setNewJob(p => ({ ...p, dataScope: v }))
                    handleFetchTemplate(v)
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCOPE_MAP).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Template preview */}
            {templateData && (
              <div className="bg-[#FAFAFA] rounded-lg p-3">
                <p className="text-xs font-medium text-[#333] mb-2">필수 필드:</p>
                <div className="flex flex-wrap gap-1">
                  {templateData.requiredFields.map(f => (
                    <span key={f} className="bg-white px-2 py-0.5 rounded text-xs border border-[#E8E8E8] font-mono">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newJob.name}
              className="bg-[#00C853] hover:bg-[#00A844] text-white"
            >
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Detail Modal ─── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-[#00C853]" />
              {selectedJob?.name}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#00C853]" />
            </div>
          ) : selectedJob ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-[#FAFAFA] rounded-lg p-3 text-center">
                  <p className="text-xs text-[#666]">전체</p>
                  <p className="text-lg font-bold">{selectedJob.totalRecords}</p>
                </div>
                <div className="bg-[#E8F5E9] rounded-lg p-3 text-center">
                  <p className="text-xs text-[#00C853]">처리</p>
                  <p className="text-lg font-bold text-[#00A844]">{selectedJob.processedRecords}</p>
                </div>
                <div className="bg-[#D1FAE5] rounded-lg p-3 text-center">
                  <p className="text-xs text-[#059669]">성공</p>
                  <p className="text-lg font-bold text-[#047857]">{selectedJob.successRecords}</p>
                </div>
                <div className="bg-[#FEE2E2] rounded-lg p-3 text-center">
                  <p className="text-xs text-[#EF4444]">오류</p>
                  <p className="text-lg font-bold text-[#DC2626]">{selectedJob.errorRecords}</p>
                </div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#666]">데이터 범위</p>
                  <p className="font-medium">{SCOPE_MAP[selectedJob.dataScope]?.label ?? selectedJob.dataScope}</p>
                </div>
                <div>
                  <p className="text-[#666]">소스 형식</p>
                  <p className="font-medium">{selectedJob.sourceType}</p>
                </div>
                <div>
                  <p className="text-[#666]">시작 시각</p>
                  <p className="font-medium">{selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleString('ko-KR') : '-'}</p>
                </div>
                <div>
                  <p className="text-[#666]">완료 시각</p>
                  <p className="font-medium">{selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleString('ko-KR') : '-'}</p>
                </div>
              </div>

              {/* Logs */}
              <div>
                <h4 className="text-sm font-semibold text-[#1A1A1A] mb-2">실행 로그</h4>
                <div className="max-h-[300px] overflow-y-auto rounded-lg border border-[#E8E8E8] bg-[#FAFAFA]">
                  {(selectedJob.logs ?? []).length === 0 ? (
                    <p className="p-4 text-center text-xs text-[#666]">로그가 없습니다.</p>
                  ) : (
                    <div className="divide-y divide-[#E8E8E8]">
                      {(selectedJob.logs ?? []).map(log => (
                        <div key={log.id} className="px-4 py-2 flex items-start gap-3">
                          <span className={`text-xs font-mono font-medium mt-0.5 ${LOG_LEVEL_COLORS[log.level] ?? 'text-[#666]'}`}>
                            [{log.level}]
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#333]">{log.message}</p>
                            {log.recordRef && (
                              <p className="text-[10px] text-[#999] mt-0.5">Ref: {log.recordRef}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-[#999] shrink-0">
                            {new Date(log.createdAt).toLocaleTimeString('ko-KR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
