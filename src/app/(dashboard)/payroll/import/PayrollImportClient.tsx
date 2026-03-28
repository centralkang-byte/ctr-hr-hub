'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useRef } from 'react'
import {
  Upload, FileSpreadsheet, Settings2, CheckCircle2, Clock,
  ChevronRight, Plus, Trash2, Save, AlertCircle, Building2
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'

interface Company {
  id: string
  name: string
  code: string
  currency: string | null
}

interface ImportMapping {
  id: string
  name: string
  companyId: string
  currency: string
  fileType: string
  headerRow: number
  mappings: Record<string, string>
  isDefault: boolean
}

interface ImportLog {
  id: string
  companyId: string
  year: number
  month: number
  fileName: string
  employeeCount: number
  totalGross: string
  totalNet: string
  currency: string
  status: string
  createdAt: string
  company: { name: string; code: string }
  mapping: { name: string; currency: string }
}

// 표준 필드 목록 (PayrollItem 기준)
const STANDARD_FIELDS = [
  { key: 'employeeNumber', label: '사번', required: true },
  { key: 'name', label: '성명', required: true },
  { key: 'basePay', label: '기본급', required: true },
  { key: 'grossPay', label: '총지급액', required: true },
  { key: 'netPay', label: '실수령액', required: true },
  { key: 'totalDeductions', label: '공제합계', required: false },
  { key: 'overtime', label: '연장수당', required: false },
  { key: 'bonus', label: '성과급/상여', required: false },
]

type Tab = 'upload' | 'mapping' | 'history'

export default function PayrollImportClient({ user, companies }: {
  user: SessionUser
  companies: Company[]
}) {
  const tCommon = useTranslations('common')
  const t = useTranslations('payroll')
  const [tab, setTab] = useState<Tab>('upload')
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(companies[0] ?? null)
  const [mappings, setMappings] = useState<ImportMapping[]>([])
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [selectedMapping, setSelectedMapping] = useState<ImportMapping | null>(null)
  const [editingMapping, setEditingMapping] = useState<Partial<ImportMapping> | null>(null)
  const [loadingMappings, setLoadingMappings] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear())
  const [uploadMonth, setUploadMonth] = useState(new Date().getMonth() + 1)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [savingMapping, setSavingMapping] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!selectedCompany) return
    setLoadingMappings(true)
    apiClient.get<ImportMapping[]>(`/api/v1/payroll/import-mappings?companyId=${selectedCompany.id}`)
      .then(res => {
        const list = res.data ?? []
        setMappings(list)
        const def = list.find((m: ImportMapping) => m.isDefault) ?? list[0] ?? null
        setSelectedMapping(def)
      })
      .catch(() => setMappings([]))
      .finally(() => setLoadingMappings(false))
  }, [selectedCompany])

  useEffect(() => {
    if (tab !== 'history' || !selectedCompany) return
    setLoadingLogs(true)
    apiClient.get<ImportLog[]>(`/api/v1/payroll/import-logs?companyId=${selectedCompany.id}`)
      .then(res => setLogs(res.data ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoadingLogs(false))
  }, [tab, selectedCompany])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null)
  }

  const handleUpload = async () => {
    if (!selectedFile || !selectedMapping || !selectedCompany) return
    setUploading(true)
    try {
      // 실제 파일 파싱은 생략 — 메타데이터만 기록 (데모)
      await apiClient.post('/api/v1/payroll/import-logs', {
        companyId: selectedCompany.id,
        mappingId: selectedMapping.id,
        year: uploadYear,
        month: uploadMonth,
        fileName: selectedFile.name,
        employeeCount: 0,
        totalGross: 0,
        totalNet: 0,
        currency: selectedCompany.currency ?? 'USD',
        uploadedById: user.id,
      })
      showToast(`${selectedFile.name} 업로드 완료`)
      setSelectedFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setTab('history')
    } catch {
      showToast('업로드 실패', 'error')
    } finally {
      setUploading(false)
    }
  }

  const startNewMapping = () => {
    setEditingMapping({
      companyId: selectedCompany?.id ?? '',
      name: '',
      fileType: 'xlsx',
      headerRow: 1,
      currency: selectedCompany?.currency ?? 'USD',
      isDefault: false,
      mappings: Object.fromEntries(STANDARD_FIELDS.map(f => [f.key, ''])),
    })
  }

  const saveMapping = async () => {
    if (!editingMapping) return
    setSavingMapping(true)
    try {
      const createdRes = await apiClient.post<ImportMapping>('/api/v1/payroll/import-mappings', editingMapping)
      setMappings(prev => [...prev, createdRes.data])
      setSelectedMapping(createdRes.data)
      setEditingMapping(null)
      showToast('매핑 저장 완료')
    } catch {
      showToast('저장 실패', 'error')
    } finally {
      setSavingMapping(false)
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      uploaded: 'bg-[#FEF3C7] text-[#B45309]',
      processing: 'bg-[#E0E7FF] text-[#4B6DE0]',
      confirmed: 'bg-[#D1FAE5] text-[#047857]',
      failed: 'bg-[#FEE2E2] text-[#B91C1C]',
    }
    const label: Record<string, string> = { uploaded: '업로드됨', processing: '처리중', confirmed: t('confirmed'), failed: t('failed') }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-[#F5F5F5] text-[#666]'}`}>
        {label[status] ?? status}
      </span>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-[#EDF1FE] rounded-lg flex items-center justify-center">
          <Upload className="w-5 h-5 text-[#5E81F4]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('importTitle')}</h1>
          <p className="text-sm text-[#666]">{t('kr_ked95b4ec_company_keab889ec_ke')}</p>
        </div>
      </div>

      {/* Company Selector */}
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="w-4 h-4 text-[#666]" />
        <span className="text-sm text-[#666]">{t('company_kec84a0ed')}</span>
        <div className="flex gap-2 flex-wrap">
          {companies.map(co => (
            <button
              key={co.id}
              onClick={() => setSelectedCompany(co)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCompany?.id === co.id
                  ? 'bg-[#5E81F4] text-white'
                  : 'bg-white border border-[#D4D4D4] text-[#555] hover:bg-[#FAFAFA]'
              }`}
            >
              {co.code} ({co.currency})
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E8E8E8] mb-6">
        {([['upload', '파일 업로드', Upload], ['mapping', '컬럼 매핑 설정', Settings2], ['history', '업로드 이력', Clock]] as const).map(
          ([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-[#5E81F4] text-[#5E81F4]'
                  : 'border-transparent text-[#666] hover:text-[#333]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          )
        )}
      </div>

      {/* Tab: Upload */}
      {tab === 'upload' && (
        <div className="max-w-2xl space-y-6">
          {/* Mapping selector */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">{t('kr_kecbbaceb_keba7a4ed_kec84a0ed')}</h3>
            {loadingMappings ? (
              <div className="text-sm text-[#999]">{tCommon('loading')}</div>
            ) : mappings.length === 0 ? (
              <div className="text-sm text-[#999]">
                선택한 법인에 매핑 설정이 없습니다.{' '}
                <button onClick={() => setTab('mapping')} className="text-[#5E81F4] underline">
                  {t('kr_keba7a4ed_add')}
                </button>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {!mappings?.length && <EmptyState />}
              {mappings?.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMapping(m)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      selectedMapping?.id === m.id
                        ? 'border-[#5E81F4] bg-[#EDF1FE] text-[#4B6DE0]'
                        : 'border-[#D4D4D4] text-[#555] hover:bg-[#FAFAFA]'
                    }`}
                  >
                    {m.name} {m.isDefault && <span className="text-xs ml-1 text-[#999]">{t('kr_keab8b0eb')}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Period */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">{t('kr_keab889ec_keca780ea_month')}</h3>
            <div className="flex gap-3">
              <select
                value={uploadYear}
                onChange={e => setUploadYear(Number(e.target.value))}
                className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
              >
                {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
              </select>
              <select
                value={uploadMonth}
                onChange={e => setUploadMonth(Number(e.target.value))}
                className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
          </div>

          {/* File Drop */}
          <div
            className="bg-white rounded-xl border-2 border-dashed border-[#D4D4D4] p-10 text-center cursor-pointer hover:border-[#5E81F4] hover:bg-[#EDF1FE]/20 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <FileSpreadsheet className="w-12 h-12 text-[#CCC] mx-auto mb-3" />
            {selectedFile ? (
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A]">{selectedFile.name}</p>
                <p className="text-xs text-[#999] mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-[#333]">{t('kr_ked8c8cec_ked81b4eb_kec84a0ed')}</p>
                <p className="text-xs text-[#999] mt-1">{t('kr_xlsx_csv_keca780ec')}</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileChange} />
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || !selectedMapping || uploading}
            className={`w-full flex items-center justify-center gap-2 py-3 ${BUTTON_VARIANTS.primary} rounded-xl font-medium disabled:opacity-50`}
          >
            <Upload className="w-4 h-4" />
            {uploading ? '업로드 중...' : '업로드 시작'}
          </button>

          {!selectedMapping && (
            <div className="flex items-center gap-2 text-sm text-[#B45309] bg-[#FEF3C7] p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {t('kr_kecbbaceb_keba7a4ed_keba8bcec_')}
            </div>
          )}
        </div>
      )}

      {/* Tab: Mapping Editor */}
      {tab === 'mapping' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1A1A1A]">
              {selectedCompany?.code} 컬럼 매핑 목록
            </h3>
            <button
              onClick={startNewMapping}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5E81F4] text-white rounded-lg text-sm"
            >
              <Plus className="w-4 h-4" /> {t('kr_kec8388_keba7a4ed_add')}
            </button>
          </div>

          {/* Existing Mappings */}
          {mappings.length > 0 && (
            <div className={TABLE_STYLES.wrapper}>
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>{t('kr_keba7a4ed')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('kr_ked8c8cec_ked9895ec')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('kr_ked86b5ed')}</th>
                    <th className={TABLE_STYLES.headerCell}>기본</th>
                  </tr>
                </thead>
                <tbody>
                  {!mappings?.length && (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState />
                      </td>
                    </tr>
                  )}
                  {mappings?.map(m => (
                    <tr key={m.id} className={TABLE_STYLES.row}>
                      <td className={cn(TABLE_STYLES.cell, "font-medium")}>{m.name}</td>
                      <td className={TABLE_STYLES.cellMuted}>{m.fileType.toUpperCase()}</td>
                      <td className={cn(TABLE_STYLES.cellMuted, "font-mono tabular-nums")}>{m.currency}</td>
                      <td className={TABLE_STYLES.cell}>
                        {m.isDefault && (
                          <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* New Mapping Editor */}
          {editingMapping && (
            <div className="bg-white rounded-xl border border-[#5E81F4] p-5 space-y-4">
              <h4 className="text-sm font-semibold text-[#1A1A1A]">{t('kr_kec8388_keba7a4ed_settings')}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-[#666] mb-1 block">{t('kr_keba7a4ed')}</label>
                  <input
                    value={editingMapping.name ?? ''}
                    onChange={e => setEditingMapping(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="예: 기본 급여 양식"
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">{t('kr_ked8c8cec_ked9895ec')}</label>
                  <select
                    value={editingMapping.fileType ?? 'xlsx'}
                    onChange={e => setEditingMapping(prev => ({ ...prev, fileType: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                  >
                    <option value="xlsx">XLSX</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">{t('kr_ked97a4eb_ked9689_kebb288ed')}</label>
                  <input
                    type="number"
                    min={1}
                    value={editingMapping.headerRow ?? 1}
                    onChange={e => setEditingMapping(prev => ({ ...prev, headerRow: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <h5 className="text-xs text-[#666] font-medium mb-2">{t('kr_kecbbaceb_keba7a4ed_ked8c8cec_')}</h5>
                <div className="grid grid-cols-2 gap-3">
                  {STANDARD_FIELDS.map(field => (
                    <div key={field.key} className="flex items-center gap-2">
                      <span className="text-xs text-[#555] w-28 shrink-0">
                        {field.label}
                        {field.required && <span className="text-[#DC2626] ml-0.5">*</span>}
                      </span>
                      <ChevronRight className="w-3 h-3 text-[#CCC] shrink-0" />
                      <input
                        value={(editingMapping.mappings as Record<string, string>)?.[field.key] ?? ''}
                        onChange={e => setEditingMapping(prev => ({
                          ...prev,
                          mappings: { ...(prev?.mappings as Record<string, string> ?? {}), [field.key]: e.target.value }
                        }))}
                        placeholder="파일 헤더명"
                        className="flex-1 px-2.5 py-1.5 border border-[#D4D4D4] rounded text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-sm text-[#555] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingMapping.isDefault ?? false}
                    onChange={e => setEditingMapping(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="w-4 h-4 rounded border-[#D4D4D4] text-[#5E81F4]"
                  />
                  {t('kr_keab8b0eb_keba7a4ed_settings')}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingMapping(null)}
                    className="px-3 py-1.5 border border-[#D4D4D4] rounded-lg text-sm text-[#555] hover:bg-[#FAFAFA]"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={saveMapping}
                    disabled={savingMapping || !editingMapping.name}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5E81F4] text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {savingMapping ? tCommon('loading') : tCommon('save')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: History */}
      {tab === 'history' && (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{t('company')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_keab889ec')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_ked8c8cec')}</th>
                <th className={TABLE_STYLES.headerCellRight}>{t('kr_kec9db8ec')}</th>
                <th className={TABLE_STYLES.headerCellRight}>{t('kr_kecb49dec_ked9884ec')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('status')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_kec9785eb')}</th>
              </tr>
            </thead>
            <tbody>
              {loadingLogs ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-[#999]">{tCommon('loading')}</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-[#999]">{t('kr_kec9785eb_kec9db4eb_kec9786ec')}</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className={TABLE_STYLES.row}>
                    <td className={cn(TABLE_STYLES.cell, "font-medium")}>{log.company.code}</td>
                    <td className={TABLE_STYLES.cellMuted}>{log.year}년 {log.month}월</td>
                    <td className={TABLE_STYLES.cellMuted}>
                      <div className="truncate max-w-[180px]" title={log.fileName}>{log.fileName}</div>
                    </td>
                    <td className={TABLE_STYLES.cellRight}>{log.employeeCount.toLocaleString()}명</td>
                    <td className={cn(TABLE_STYLES.cellRight, "font-mono tabular-nums")}>
                      {Number(log.totalGross).toLocaleString()} {log.currency}
                    </td>
                    <td className={TABLE_STYLES.cell}>{statusBadge(log.status)}</td>
                    <td className={cn(TABLE_STYLES.cellMuted, "text-xs")}>
                      {new Date(log.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white z-50
          ${toast.type === 'success' ? 'bg-[#059669]' : 'bg-[#DC2626]'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
