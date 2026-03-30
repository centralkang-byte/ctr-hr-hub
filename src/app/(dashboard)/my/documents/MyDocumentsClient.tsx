'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 문서/증명서 셀프서비스 (2-Tab)
// Tab 1: 내 문서 — EmployeeDocument 목록 + 다운로드
// Tab 2: 증명서 발급 — CertificateRequest 목록 + 신청
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  FileText,
  Download,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FilePlus,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { BUTTON_VARIANTS } from '@/lib/styles'
import type { SessionUser } from '@/types'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────

interface EmployeeDocument {
  id: string
  docType: string
  title: string
  fileSize: number | null
  mimeType: string | null
  createdAt: string
  uploader: { id: string; name: string } | null
}

interface CertificateRequest {
  id: string
  type: string
  purpose: string | null
  status: string
  requestedAt: string
  issuedAt: string | null
  issuedFileKey: string | null
  approver: { id: string; name: string } | null
}

// ─── Constants ────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  CONTRACT: '계약서',
  ID_CARD: '신분증',
  CERTIFICATE: '증명서',
  RESUME: '이력서',
  HANDOVER: '인수인계',
  OTHER: '기타',
}

const CERT_TYPE_LABELS: Record<string, string> = {
  EMPLOYMENT_CERT: '재직증명서',
  CAREER_CERT: '경력증명서',
  INCOME_CERT: '소득증명서',
}

const CERT_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  REQUESTED: { label: '신청완료', color: 'bg-primary/10 text-primary dark:bg-blue-900/30 dark:text-blue-300', icon: Clock },
  APPROVED: { label: '승인', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', icon: CheckCircle2 },
  ISSUED: { label: '발급완료', color: 'bg-tertiary-container/20 text-tertiary dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
  REJECTED: { label: '반려', color: 'bg-destructive/10 text-destructive dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
}

const TABS = [
  { key: 'documents', label: '내 문서', icon: FileText },
  { key: 'certificates', label: '증명서 발급', icon: FilePlus },
] as const

type TabKey = (typeof TABS)[number]['key']

// ─── Component ────────────────────────────────────────────

export function MyDocumentsClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
  const [activeTab, setActiveTab] = useState<TabKey>('documents')
  const [documents, setDocuments] = useState<EmployeeDocument[]>([])
  const [certRequests, setCertRequests] = useState<CertificateRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showRequestDialog, setShowRequestDialog] = useState(false)
  const [requestType, setRequestType] = useState<string>('EMPLOYMENT_CERT')
  const [requestPurpose, setRequestPurpose] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchDocuments = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await apiClient.get('/api/v1/my/documents')
      setDocuments(res?.data ?? [])
    } catch {
      // 에러 시 빈 배열
    }
  }, [])

  const fetchCertRequests = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await apiClient.get('/api/v1/my/documents/certificate-requests')
      setCertRequests(res?.data ?? [])
    } catch {
      // 에러 시 빈 배열
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchDocuments(), fetchCertRequests()]).finally(() => setLoading(false))
  }, [fetchDocuments, fetchCertRequests])

  // ─── Download Handler ─────────────────────────────────

  const handleDownload = async (docId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await apiClient.get(`/api/v1/my/documents/${docId}/download`)
      if (res?.data?.url) {
        window.open(res.data.url, '_blank')
      }
    } catch {
      toast({ title: '다운로드 실패', description: '파일을 다운로드할 수 없습니다.', variant: 'destructive' })
    }
  }

  // ─── Certificate Request Handler ───────────────────────

  const handleRequestCertificate = async () => {
    setSubmitting(true)
    try {
      await apiClient.post('/api/v1/my/documents/request-certificate', {
        type: requestType,
        purpose: requestPurpose || undefined,
      })
      toast({ title: '증명서 신청 완료', description: 'HR 담당자 승인 후 발급됩니다.' })
      setShowRequestDialog(false)
      setRequestPurpose('')
      await fetchCertRequests()
    } catch {
      toast({ title: '신청 실패', description: '잠시 후 다시 시도해주세요.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Loading ──────────────────────────────────────────

  if (loading) return <TableSkeleton />

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#222] dark:text-white">문서/증명서</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-[#999] hover:text-[#666] dark:text-muted-foreground/60 dark:hover:text-slate-300',
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.key === 'certificates' && certRequests.length > 0 && (
                <span className="ml-1 text-xs bg-primary text-white rounded-full px-1.5 py-0.5">
                  {certRequests.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'documents' ? (
        <DocumentsTab documents={documents} onDownload={handleDownload} />
      ) : (
        <CertificatesTab
          requests={certRequests}
          onDownload={handleDownload}
          showDialog={showRequestDialog}
          onOpenDialog={() => setShowRequestDialog(true)}
          onCloseDialog={() => setShowRequestDialog(false)}
          requestType={requestType}
          onTypeChange={setRequestType}
          requestPurpose={requestPurpose}
          onPurposeChange={setRequestPurpose}
          onSubmit={handleRequestCertificate}
          submitting={submitting}
        />
      )}
    </div>
  )
}

// ─── Documents Tab ──────────────────────────────────────

function DocumentsTab({
  documents,
  onDownload,
}: {
  documents: EmployeeDocument[]
  onDownload: (id: string) => void
}) {
  if (documents.length === 0) {
    return <EmptyState icon={FileText} title="등록된 문서가 없습니다" description="HR에서 등록한 문서가 여기에 표시됩니다." />
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between p-4 bg-card rounded-lg border border-border"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/5 dark:bg-slate-700 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-[#222] dark:text-white">{doc.title}</p>
              <div className="flex items-center gap-2 text-xs text-[#999] dark:text-muted-foreground/60">
                <span className="px-1.5 py-0.5 rounded bg-muted dark:bg-slate-700">
                  {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                </span>
                <span>{new Date(doc.createdAt).toLocaleDateString('ko-KR')}</span>
                {doc.uploader && <span>· {doc.uploader.name}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={() => onDownload(doc.id)}
            className="p-2 rounded-lg hover:bg-muted dark:hover:bg-slate-700 transition-colors"
          >
            <Download className="w-5 h-5 text-primary" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Certificates Tab ───────────────────────────────────

function CertificatesTab({
  requests,
  onDownload,
  showDialog,
  onOpenDialog,
  onCloseDialog,
  requestType,
  onTypeChange,
  requestPurpose,
  onPurposeChange,
  onSubmit,
  submitting,
}: {
  requests: CertificateRequest[]
  onDownload: (id: string) => void
  showDialog: boolean
  onOpenDialog: () => void
  onCloseDialog: () => void
  requestType: string
  onTypeChange: (v: string) => void
  requestPurpose: string
  onPurposeChange: (v: string) => void
  onSubmit: () => void
  submitting: boolean
}) {
  return (
    <div>
      {/* Request Button */}
      <div className="flex justify-end mb-4">
        <button onClick={onOpenDialog} className={BUTTON_VARIANTS.primary}>
          <Plus className="w-4 h-4 mr-1" />
          증명서 신청
        </button>
      </div>

      {/* Request Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-[#222] dark:text-white mb-4">증명서 발급 신청</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#666] dark:text-slate-300 mb-1">증명서 유형</label>
                <select
                  value={requestType}
                  onChange={(e) => onTypeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card dark:bg-slate-700 text-[#222] dark:text-white"
                >
                  {Object.entries(CERT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#666] dark:text-slate-300 mb-1">용도 (선택)</label>
                <textarea
                  value={requestPurpose}
                  onChange={(e) => onPurposeChange(e.target.value)}
                  placeholder="예: 은행 대출 신청용"
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card dark:bg-slate-700 text-[#222] dark:text-white resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={onCloseDialog} className={BUTTON_VARIANTS.secondary} disabled={submitting}>
                취소
              </button>
              <button onClick={onSubmit} className={BUTTON_VARIANTS.primary} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    신청 중...
                  </>
                ) : (
                  '신청하기'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request List */}
      {requests.length === 0 ? (
        <EmptyState icon={FilePlus} title="증명서 발급 요청 내역이 없습니다" description="위 '증명서 신청' 버튼으로 재직증명서/경력증명서를 요청할 수 있습니다." />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const statusConfig = CERT_STATUS_CONFIG[req.status] ?? CERT_STATUS_CONFIG.REQUESTED
            const StatusIcon = statusConfig.icon
            return (
              <div
                key={req.id}
                className="flex items-center justify-between p-4 bg-card rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 dark:bg-slate-700 flex items-center justify-center">
                    <FilePlus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-[#222] dark:text-white">
                      {CERT_TYPE_LABELS[req.type] ?? req.type}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[#999] dark:text-muted-foreground/60">
                      <span>{new Date(req.requestedAt).toLocaleDateString('ko-KR')}</span>
                      {req.purpose && <span>· {req.purpose}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', statusConfig.color)}>
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig.label}
                  </span>
                  {req.status === 'ISSUED' && req.issuedFileKey && (
                    <button
                      onClick={() => onDownload(req.id)}
                      className="p-2 rounded-lg hover:bg-muted dark:hover:bg-slate-700 transition-colors"
                      title="다운로드"
                    >
                      <Download className="w-5 h-5 text-primary" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
