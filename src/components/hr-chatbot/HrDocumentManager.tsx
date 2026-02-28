'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  Plus,
  Trash2,
  Pencil,
  Upload,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────

interface HrDocumentManagerProps {
  user: SessionUser
}

interface HrDocument {
  id: string
  title: string
  docType: string
  version: string
  locale: string
  isActive: boolean
  createdAt: string
  uploader: { name: string }
  _count: { chunks: number }
}

const DOC_TYPE_LABELS: Record<string, string> = {
  EMPLOYMENT_RULES: '취업규칙',
  HR_POLICY: 'HR 정책',
  BENEFIT_GUIDE: '복리후생 안내',
  SAFETY_MANUAL: '안전 매뉴얼',
  EMPLOYEE_HANDBOOK: '직원 핸드북',
  OTHER: '기타',
}

// ─── Component ──────────────────────────────────────────

export function HrDocumentManager({ user }: HrDocumentManagerProps) {
  const [documents, setDocuments] = useState<HrDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDocType, setFormDocType] = useState('EMPLOYMENT_RULES')
  const [formContent, setFormContent] = useState('')
  const [formVersion, setFormVersion] = useState('1.0')

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await apiClient.get<HrDocument[]>(
        '/api/v1/hr-documents?limit=50',
      )
      // apiPaginated returns { data: [...], pagination: {...} }
      const payload = res.data as unknown as
        | HrDocument[]
        | { data: HrDocument[] }
      setDocuments(
        Array.isArray(payload) ? payload : payload.data,
      )
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleUpload = async () => {
    if (!formTitle.trim() || !formContent.trim()) return
    setUploading(true)
    try {
      await apiClient.post('/api/v1/hr-documents', {
        title: formTitle,
        docType: formDocType,
        contentText: formContent,
        version: formVersion,
      })
      setShowUpload(false)
      setFormTitle('')
      setFormContent('')
      setFormVersion('1.0')
      await fetchDocuments()
    } catch {
      // silently fail
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/hr-documents/${id}`)
      setDeleteId(null)
      await fetchDocuments()
    } catch {
      // silently fail
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR 문서 관리"
        description="챗봇 RAG 파이프라인에 사용되는 문서를 관리합니다."
      />

      <div className="flex justify-end">
        <Button
          onClick={() => setShowUpload(true)}
          className="bg-ctr-primary hover:bg-ctr-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          문서 추가
        </Button>
      </div>

      {/* Upload Dialog */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-ctr-gray-900">
              <Upload className="mr-2 inline h-5 w-5" />
              문서 추가
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-ctr-gray-700">
                  제목
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="문서 제목"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ctr-gray-700">
                    문서 유형
                  </label>
                  <select
                    value={formDocType}
                    onChange={(e) => setFormDocType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ctr-gray-700">
                    버전
                  </label>
                  <input
                    type="text"
                    value={formVersion}
                    onChange={(e) => setFormVersion(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ctr-gray-700">
                  내용
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="문서 내용을 입력하세요..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowUpload(false)}
                disabled={uploading}
              >
                취소
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!formTitle.trim() || !formContent.trim() || uploading}
                className="bg-ctr-primary hover:bg-ctr-primary/90"
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                업로드
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-ctr-gray-900">
              문서 삭제
            </h3>
            <p className="mb-4 text-sm text-ctr-gray-500">
              이 문서와 관련된 모든 임베딩 데이터가 삭제됩니다. 계속하시겠습니까?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteId)}
              >
                삭제
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-ctr-primary" />
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <FileText className="mb-3 h-12 w-12 text-ctr-gray-300" />
            <p className="text-sm text-ctr-gray-500">
              등록된 문서가 없습니다.
            </p>
            <p className="text-xs text-ctr-gray-400">
              문서를 추가하여 챗봇이 답변할 수 있도록 하세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ctr-gray-500">
                  제목
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ctr-gray-500">
                  유형
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ctr-gray-500">
                  버전
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ctr-gray-500">
                  청크
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ctr-gray-500">
                  업로더
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ctr-gray-500">
                  상태
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-ctr-gray-400" />
                      <span className="text-sm font-medium text-ctr-gray-700">
                        {doc.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-ctr-gray-500">
                    {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                  </td>
                  <td className="px-4 py-3 text-sm text-ctr-gray-500">
                    v{doc.version}
                  </td>
                  <td className="px-4 py-3 text-sm text-ctr-gray-500">
                    {doc._count.chunks}
                  </td>
                  <td className="px-4 py-3 text-sm text-ctr-gray-500">
                    {doc.uploader.name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={doc.isActive ? 'default' : 'secondary'}
                      className={
                        doc.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : ''
                      }
                    >
                      {doc.isActive ? '활성' : '비활성'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                      onClick={() => setDeleteId(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
