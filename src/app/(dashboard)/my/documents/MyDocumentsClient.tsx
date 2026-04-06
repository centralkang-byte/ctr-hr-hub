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

const DOC_TYPE_KEYS: Record<string, string> = {
  CONTRACT: 'docType.CONTRACT',
  ID_CARD: 'docType.ID_CARD',
  CERTIFICATE: 'docType.CERTIFICATE',
  RESUME: 'docType.RESUME',
  HANDOVER: 'docType.HANDOVER',
  OTHER: 'docType.OTHER',
}

const CERT_TYPE_KEYS: Record<string, string> = {
  EMPLOYMENT_CERT: 'certType.EMPLOYMENT_CERT',
  CAREER_CERT: 'certType.CAREER_CERT',
  INCOME_CERT: 'certType.INCOME_CERT',
}

const CERT_STATUS_CONFIG: Record<string, { labelKey: string; color: string; icon: typeof Clock }> = {
  REQUESTED: { labelKey: 'certStatus.REQUESTED', color: 'bg-primary/10 text-primary', icon: Clock },
  APPROVED: { labelKey: 'certStatus.APPROVED', color: 'bg-yellow-500/15 text-yellow-700', icon: CheckCircle2 },
  ISSUED: { labelKey: 'certStatus.ISSUED', color: 'bg-tertiary-container/20 text-tertiary', icon: CheckCircle2 },
  REJECTED: { labelKey: 'certStatus.REJECTED', color: 'bg-destructive/10 text-destructive', icon: XCircle },
}

const TABS = [
  { key: 'documents', labelKey: 'tabs.documents', icon: FileText },
  { key: 'certificates', labelKey: 'tabs.certificates', icon: FilePlus },
] as const

type TabKey = (typeof TABS)[number]['key']

// ─── Component ────────────────────────────────────────────

export function MyDocumentsClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('myDocuments')
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
      toast({ title: t('error.loadFailed'), variant: 'destructive' })
    }
  }, [t])

  const fetchCertRequests = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await apiClient.get('/api/v1/my/documents/certificate-requests')
      setCertRequests(res?.data ?? [])
    } catch {
      toast({ title: t('error.loadFailed'), variant: 'destructive' })
    }
  }, [t])

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
      toast({ title: t('error.downloadFailed'), description: t('error.downloadFailedDesc'), variant: 'destructive' })
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
      toast({ title: t('toast.requestSuccess'), description: t('toast.requestSuccessDesc') })
      setShowRequestDialog(false)
      setRequestPurpose('')
      await fetchCertRequests()
    } catch {
      toast({ title: t('error.requestFailed'), description: t('error.retryLater'), variant: 'destructive' })
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
        <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
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
                  : 'border-transparent text-muted-foreground hover:text-muted-foreground',
              )}
            >
              <Icon className="w-4 h-4" />
              {t(tab.labelKey)}
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
        <DocumentsTab documents={documents} onDownload={handleDownload} t={t} />
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
          t={t}
        />
      )}
    </div>
  )
}

// ─── Documents Tab ──────────────────────────────────────

function DocumentsTab({
  documents,
  onDownload,
  t,
}: {
  documents: EmployeeDocument[]
  onDownload: (id: string) => void
  t: (key: string) => string
}) {
  if (documents.length === 0) {
    return <EmptyState icon={FileText} title={t('empty.noDocuments')} description={t('empty.noDocumentsDesc')} />
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between p-4 bg-card rounded-lg border border-border"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">{doc.title}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="px-1.5 py-0.5 rounded bg-muted">
                  {DOC_TYPE_KEYS[doc.docType] ? t(DOC_TYPE_KEYS[doc.docType]) : doc.docType}
                </span>
                <span>{new Date(doc.createdAt).toLocaleDateString('ko-KR')}</span>
                {doc.uploader && <span>· {doc.uploader.name}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={() => onDownload(doc.id)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
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
  t,
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
  t: (key: string) => string
}) {
  return (
    <div>
      {/* Request Button */}
      <div className="flex justify-end mb-4">
        <button onClick={onOpenDialog} className={BUTTON_VARIANTS.primary}>
          <Plus className="w-4 h-4 mr-1" />
          {t('action.requestCert')}
        </button>
      </div>

      {/* Request Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">{t('dialog.title')}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">{t('dialog.certTypeLabel')}</label>
                <select
                  value={requestType}
                  onChange={(e) => onTypeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                >
                  {Object.entries(CERT_TYPE_KEYS).map(([key, labelKey]) => (
                    <option key={key} value={key}>{t(labelKey)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">{t('dialog.purposeLabel')}</label>
                <textarea
                  value={requestPurpose}
                  onChange={(e) => onPurposeChange(e.target.value)}
                  placeholder={t('dialog.purposePlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={onCloseDialog} className={BUTTON_VARIANTS.secondary} disabled={submitting}>
                {t('action.cancel')}
              </button>
              <button onClick={onSubmit} className={BUTTON_VARIANTS.primary} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    {t('action.submitting')}
                  </>
                ) : (
                  t('action.submit')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request List */}
      {requests.length === 0 ? (
        <EmptyState icon={FilePlus} title={t('empty.noCertificates')} description={t('empty.noCertificatesDesc')} />
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
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center">
                    <FilePlus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {CERT_TYPE_KEYS[req.type] ? t(CERT_TYPE_KEYS[req.type]) : req.type}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(req.requestedAt).toLocaleDateString('ko-KR')}</span>
                      {req.purpose && <span>· {req.purpose}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', statusConfig.color)}>
                    <StatusIcon className="w-3 h-3" />
                    {t(statusConfig.labelKey)}
                  </span>
                  {req.status === 'ISSUED' && req.issuedFileKey && (
                    <button
                      onClick={() => onDownload(req.id)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title={t('action.download')}
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
