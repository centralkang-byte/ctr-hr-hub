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
  DRAFT: 'bg-slate-50 text-slate-600 border-slate-200',
  PENDING_SIGNATURE: 'bg-amber-50 text-amber-700 border-amber-200',
  SIGNED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  EXPIRED: 'bg-orange-50 text-orange-700 border-orange-200',
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체 유형</option>
              {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            {/* Refresh */}
            <button
              onClick={() => fetchDocuments()}
              className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => { setSelectedDoc(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            문서 생성
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            로딩 중...
          </div>
        ) : documents.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            KEDO 문서가 없습니다.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">
                  제목
                </th>
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">
                  직원
                </th>
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">
                  문서 유형
                </th>
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">
                  서명 수준
                </th>
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">
                  생성일
                </th>
                <th className="px-4 py-3 text-right text-xs text-slate-500 font-medium uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900 max-w-xs truncate">
                      {doc.title}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-slate-900">{doc.employee.name}</p>
                      <p className="text-xs text-slate-500">{doc.employee.employeeNo}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        STATUS_COLORS[doc.status] ?? 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {STATUS_LABELS[doc.status] ?? doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {doc.signatureLevel ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(doc.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {doc.status === 'DRAFT' && (
                        <button
                          onClick={() => { setSelectedDoc(doc); setShowForm(true) }}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700"
                          title="수정"
                        >
                          <PenLine className="w-4 h-4" />
                        </button>
                      )}
                      {(doc.status === 'DRAFT' || doc.status === 'PENDING_SIGNATURE') && (
                        <button
                          onClick={() => setSignDoc(doc)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          서명
                        </button>
                      )}
                      {doc.status !== 'SIGNED' && doc.status !== 'REJECTED' && (
                        <button
                          onClick={() => setSignDoc(doc)}
                          className="p-1.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600"
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
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <p className="text-xs text-slate-500">전체 {pagination.total}건</p>
            <div className="flex gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => fetchDocuments(page)}
                  className={`w-8 h-8 text-xs rounded-lg ${
                    page === pagination.page
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
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
