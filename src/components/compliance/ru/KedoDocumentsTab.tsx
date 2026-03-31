'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — KEDO Documents Tab
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, PenLine, XCircle } from 'lucide-react'
import { apiClient } from '@/lib/api'
import KedoDocumentForm from './KedoDocumentForm'
import KedoSignDialog from './KedoSignDialog'
import type { PaginationInfo } from '@/types'
import { BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'
import { STATUS_VARIANT } from '@/lib/styles/status'

interface KedoDocument {
  id: string
  employeeId: string
  documentType: string
  title: string
  content: string | null
  status: string
  signatureLevel: string | null
  signatureHash: string | null
  signedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  expiresAt: string | null
  createdAt: string
  employee: { id: string; name: string; employeeNo: string }
  signedBy: { id: string; name: string } | null
  rejectedBy: { id: string; name: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '초안',
  PENDING_SIGNATURE: '서명 대기',
  SIGNED: '서명 완료',
  REJECTED: '반려',
  EXPIRED: '만료',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: STATUS_VARIANT.neutral,
  PENDING_SIGNATURE: STATUS_VARIANT.warning,
  SIGNED: STATUS_VARIANT.success,
  REJECTED: STATUS_VARIANT.error,
  EXPIRED: STATUS_VARIANT.neutral,
}

const DOC_TYPE_LABELS: Record<string, string> = {
  EMPLOYMENT_CONTRACT: '근로계약서',
  SUPPLEMENTARY_AGREEMENT: '부속합의서',
  TRANSFER_ORDER: '이동명령',
  VACATION_ORDER: '휴가명령',
  DISMISSAL_ORDER: '해고명령',
  SALARY_CHANGE: '급여변경',
  DISCIPLINARY_ORDER: '징계명령',
}

export default function KedoDocumentsTab() {
  const [documents, setDocuments] = useState<KedoDocument[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<KedoDocument | null>(null)
  const [signDoc, setSignDoc] = useState<KedoDocument | null>(null)

  const fetchDocuments = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const params: Record<string, string | number> = { page, limit: 20 }
        if (statusFilter) params.status = statusFilter
        if (typeFilter) params.documentType = typeFilter

        const res = await apiClient.getList<KedoDocument>(
          '/api/v1/compliance/ru/kedo',
          params,
        )
        setDocuments(res.data ?? [])
        setPagination(res.pagination ?? null)
      } catch {
        // error handled silently
      } finally {
        setLoading(false)
      }
    },
    [statusFilter, typeFilter],
  )

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleFormSuccess = () => {
    setShowForm(false)
    setSelectedDoc(null)
    fetchDocuments()
  }

  const handleSignSuccess = () => {
    setSignDoc(null)
    fetchDocuments()
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
            >
              <option value="">전체 상태</option>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
            >
              <option value="">전체 유형</option>
              {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            {/* Refresh */}
            <button
              onClick={() => fetchDocuments()}
              className="p-2 border border-border rounded-lg hover:bg-background text-muted-foreground"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => { setSelectedDoc(null); setShowForm(true) }}
            className={`flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
          >
            <Plus className="w-4 h-4" />
            문서 생성
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={TABLE_STYLES.wrapper}>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            로딩 중...
          </div>
        ) : documents.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            KEDO 문서가 없습니다.
          </div>
        ) : (
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>
                  제목
                </th>
                <th className={TABLE_STYLES.headerCell}>
                  직원
                </th>
                <th className={TABLE_STYLES.headerCell}>
                  문서 유형
                </th>
                <th className={TABLE_STYLES.headerCell}>
                  상태
                </th>
                <th className={TABLE_STYLES.headerCell}>
                  서명 수준
                </th>
                <th className={TABLE_STYLES.headerCell}>
                  생성일
                </th>
                <th className={TABLE_STYLES.headerCellRight}>
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className={TABLE_STYLES.row}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground max-w-xs truncate">
                      {doc.title}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-foreground">{doc.employee.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.employee.employeeNo}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        STATUS_COLORS[doc.status] ?? 'bg-background text-muted-foreground border-border'
                      }`}
                    >
                      {STATUS_LABELS[doc.status] ?? doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {doc.signatureLevel ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {doc.status === 'DRAFT' && (
                        <button
                          onClick={() => { setSelectedDoc(doc); setShowForm(true) }}
                          className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                          title="수정"
                        >
                          <PenLine className="w-4 h-4" />
                        </button>
                      )}
                      {(doc.status === 'DRAFT' || doc.status === 'PENDING_SIGNATURE') && (
                        <button
                          onClick={() => setSignDoc(doc)}
                          className="text-sm text-primary hover:text-primary/90 font-medium"
                        >
                          서명
                        </button>
                      )}
                      {doc.status !== 'SIGNED' && doc.status !== 'REJECTED' && (
                        <button
                          onClick={() => setSignDoc(doc)}
                          className="p-1.5 hover:bg-destructive/10 rounded text-red-400 hover:text-destructive"
                          title="반려"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">전체 {pagination.total}건</p>
            <div className="flex gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => fetchDocuments(page)}
                  className={`w-8 h-8 text-xs rounded-lg ${
                    page === pagination.page
                      ? 'bg-primary text-white'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <KedoDocumentForm
          document={selectedDoc}
          onClose={() => { setShowForm(false); setSelectedDoc(null) }}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Sign/Reject Dialog */}
      {signDoc && (
        <KedoSignDialog
          document={signDoc}
          onClose={() => setSignDoc(null)}
          onSuccess={handleSignSuccess}
        />
      )}
    </div>
  )
}
