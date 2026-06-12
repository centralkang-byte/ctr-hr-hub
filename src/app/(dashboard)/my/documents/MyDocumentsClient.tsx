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
  FilePlus,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { WdDrawer, WdField } from '@/components/shared/WdDrawer'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
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

// 상태별 라벨 키만 보유 — 색/카테고리는 StatusBadge가 status.ts STATUS_MAP에서 해석
const CERT_STATUS_LABEL_KEYS: Record<string, string> = {
  REQUESTED: 'certStatus.REQUESTED',
  APPROVED: 'certStatus.APPROVED',
  ISSUED: 'certStatus.ISSUED',
  REJECTED: 'certStatus.REJECTED',
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      {/* Tabs (segmented control) */}
      <div
        className="inline-flex bg-muted/50 rounded-lg p-1 mb-6"
        role="tablist"
        aria-label={t('pageTitle')}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm motion-safe:transition-all',
                isActive
                  ? 'bg-card shadow-sm text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
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

      {/* Request Drawer */}
      <WdDrawer
        open={showDialog}
        onClose={onCloseDialog}
        eyebrow={t('selfService')}
        title={t('dialog.title')}
        closeDisabled={submitting}
        primary={{
          label: submitting ? t('action.submitting') : t('action.submit'),
          onClick: onSubmit,
          disabled: submitting,
        }}
        secondary={{ label: t('action.cancel'), onClick: onCloseDialog, disabled: submitting }}
      >
        <WdField label={t('dialog.certTypeLabel')} required htmlFor="cert-type">
          <select
            id="cert-type"
            value={requestType}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full px-3 py-2 border border-border-strong rounded-lg bg-card text-foreground"
          >
            {Object.entries(CERT_TYPE_KEYS).map(([key, labelKey]) => (
              <option key={key} value={key}>{t(labelKey)}</option>
            ))}
          </select>
        </WdField>

        <WdField label={t('dialog.purposeLabel')} htmlFor="cert-purpose">
          <textarea
            id="cert-purpose"
            value={requestPurpose}
            onChange={(e) => onPurposeChange(e.target.value)}
            placeholder={t('dialog.purposePlaceholder')}
            rows={3}
            className="w-full px-3 py-2 border border-border-strong rounded-lg bg-card text-foreground resize-none"
          />
        </WdField>
      </WdDrawer>

      {/* Request List */}
      {requests.length === 0 ? (
        <EmptyState icon={FilePlus} title={t('empty.noCertificates')} description={t('empty.noCertificatesDesc')} />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const labelKey = CERT_STATUS_LABEL_KEYS[req.status] ?? CERT_STATUS_LABEL_KEYS.REQUESTED
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
                  <StatusBadge status={req.status}>{t(labelKey)}</StatusBadge>
                  {req.status === 'ISSUED' && req.issuedFileKey && (
                    <button
                      onClick={() => onDownload(req.id)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      aria-label={t('action.download')}
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
