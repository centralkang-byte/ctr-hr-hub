'use client'

import { useTranslations, useLocale } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'

import { useState, useEffect, useRef } from 'react'
import {
  Upload, FileSpreadsheet, Settings2, CheckCircle2, Clock,
  ChevronRight, Plus, Save, AlertCircle, Building2
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { BUTTON_VARIANTS, BUTTON_SIZES, TABLE_STYLES, TAB_STYLES, TYPOGRAPHY } from '@/lib/styles'
import { type StatusCategory } from '@/lib/styles/status'
import { useArrowKeyNavigation } from '@/hooks/useArrowKeyNavigation'
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
  { key: 'employeeNumber', labelKey: 'import.fieldEmployeeId', required: true },
  { key: 'name', labelKey: 'import.fieldName', required: true },
  { key: 'basePay', labelKey: 'import.fieldBasePay', required: true },
  { key: 'grossPay', labelKey: 'import.fieldGrossPay', required: true },
  { key: 'netPay', labelKey: 'import.fieldNetPay', required: true },
  { key: 'totalDeductions', labelKey: 'import.fieldTotalDeduction', required: false },
  { key: 'overtime', labelKey: 'import.fieldOvertimePay', required: false },
  { key: 'bonus', labelKey: 'import.fieldBonus', required: false },
]

// 가져오기 로그 status → 시맨틱 카테고리 (ALL-4 — STATUS_MAP 미등록 소문자 status 로컬 매핑)
const LOG_STATUS_VARIANT: Record<string, StatusCategory> = {
  uploaded: 'warning',
  processing: 'info',
  confirmed: 'success',
  failed: 'error',
}

type Tab = 'upload' | 'mapping' | 'history'

export default function PayrollImportClient({ user, companies }: {
  user: SessionUser
  companies: Company[]
}) {
  const tCommon = useTranslations('common')
  const t = useTranslations('payroll')
  const locale = useLocale()
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
  const [toastState, setToastState] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [savingMapping, setSavingMapping] = useState(false)

  // IM-7: 선택 버튼그룹 roving tabindex (기존 onClick 동작 무변경 — 키보드 내비만 추가)
  const companyIndex = companies.findIndex(co => co.id === selectedCompany?.id)
  const companyNav = useArrowKeyNavigation(companies.length, companyIndex, i => {
    if (companies[i]) setSelectedCompany(companies[i])
  })
  const mappingIndex = mappings.findIndex(m => m.id === selectedMapping?.id)
  const mappingNav = useArrowKeyNavigation(mappings.length, mappingIndex, i => {
    if (mappings[i]) setSelectedMapping(mappings[i])
  })

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastState({ msg, type })
    setTimeout(() => setToastState(null), 3000)
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
      showToast(t('import.uploadComplete', { fileName: selectedFile.name }))
      setSelectedFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setTab('history')
    } catch {
      showToast(t('import.uploadFailed'), 'error')
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
      showToast(t('import.mappingSaved'))
    } catch {
      showToast(t('import.saveFailed'), 'error')
    } finally {
      setSavingMapping(false)
    }
  }

  const statusBadge = (status: string) => {
    const label: Record<string, string> = {
      uploaded: t('import.statusUploaded'),
      processing: t('import.statusProcessing'),
      confirmed: t('confirmed'),
      failed: t('failed'),
    }
    return (
      <StatusBadge variant={LOG_STATUS_VARIANT[status] ?? 'neutral'}>
        {label[status] ?? status}
      </StatusBadge>
    )
  }

  const TAB_LABELS: Record<Tab, string> = {
    upload: t('import.tabUpload'),
    mapping: t('import.tabMapping'),
    history: t('import.tabHistory'),
  }

  const TAB_ICONS: Record<Tab, typeof Upload> = {
    upload: Upload,
    mapping: Settings2,
    history: Clock,
  }

  return (
    <div className="mx-auto max-w-7xl p-4 space-y-4">
      {/* Header (ALL-1: proto .page-h + 56px 아이콘 타일) */}
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-accent text-primary">
          <Upload className="h-[26px] w-[26px]" aria-hidden="true" />
        </div>
        <div>
          <h1 className={TYPOGRAPHY.pageTitle}>{t('importTitle')}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t('import.subtitle')}</p>
        </div>
      </div>

      {/* Company Selector (IM-7: aria-pressed 토글 버튼군 + roving tabindex) */}
      <div className="flex items-center gap-3">
        <Building2 className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-muted-foreground whitespace-nowrap">{t('import.companySelect')}</span>
        <div
          role="group"
          aria-label={t('import.companySelect')}
          onKeyDown={companyNav.onKeyDown}
          className="flex gap-2 flex-wrap"
        >
          {companies.map((co, i) => (
            <button
              key={co.id}
              type="button"
              aria-pressed={selectedCompany?.id === co.id}
              {...companyNav.itemProps(i)}
              onClick={() => setSelectedCompany(co)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                selectedCompany?.id === co.id
                  ? 'bg-primary text-white'
                  : BUTTON_VARIANTS.secondary,
              )}
            >
              {co.code} ({co.currency})
            </button>
          ))}
        </div>
      </div>

      {/* Tabs (IM-1: Radix Tabs + TAB_STYLES — 패널형, tab state·값 무변경) */}
      <Tabs value={tab} onValueChange={v => setTab(v as Tab)} className="space-y-4">
        <TabsList aria-label={t('import.tabsLabel')}>
          {(['upload', 'mapping', 'history'] as const).map(key => {
            const Icon = TAB_ICONS[key]
            return (
              <TabsTrigger key={key} value={key}>
                <Icon className={TAB_STYLES.icon} aria-hidden="true" />
                {TAB_LABELS[key]}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* Tab: Upload */}
        <TabsContent value="upload" className="max-w-2xl space-y-6">
          {/* Mapping selector */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h3 className={cn(TYPOGRAPHY.cardTitle, 'mb-3')}>{t('import.selectMappingTemplate')}</h3>
            {loadingMappings ? (
              <div className="text-sm text-muted-foreground">{tCommon('loading')}</div>
            ) : mappings.length === 0 ? (
              <EmptyState
                size="sm"
                title={t('import.noMappingConfig')}
                sub=""
                action={{ label: t('import.addMapping'), onClick: () => setTab('mapping') }}
              />
            ) : (
              <div
                role="group"
                aria-label={t('import.selectMappingTemplate')}
                onKeyDown={mappingNav.onKeyDown}
                className="flex gap-2 flex-wrap"
              >
                {mappings.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={selectedMapping?.id === m.id}
                    {...mappingNav.itemProps(i)}
                    onClick={() => setSelectedMapping(m)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      selectedMapping?.id === m.id
                        ? 'border-primary bg-primary/10 text-primary/90'
                        : 'border-border text-muted-foreground hover:bg-background'
                    }`}
                  >
                    {m.name} {m.isDefault && <span className="text-xs ml-1 text-muted-foreground">{t('import.default')}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Period */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h3 className={cn(TYPOGRAPHY.cardTitle, 'mb-3')}>{t('import.payrollPeriod')}</h3>
            <div className="flex gap-3">
              <select
                value={uploadYear}
                onChange={e => setUploadYear(Number(e.target.value))}
                className="px-3 py-2 border border-border rounded-lg text-sm"
              >
                {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
              </select>
              <select
                value={uploadMonth}
                onChange={e => setUploadMonth(Number(e.target.value))}
                className="px-3 py-2 border border-border rounded-lg text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{t('import.monthLabel', { month: m })}</option>
                ))}
              </select>
            </div>
          </div>

          {/* File Drop */}
          <div
            className="bg-card rounded-xl border-2 border-dashed border-border p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/10 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <FileSpreadsheet className="w-12 h-12 text-border mx-auto mb-3" />
            {selectedFile ? (
              <div>
                <p className="text-sm font-semibold text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-foreground">{t('import.dropFilePrompt')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('import.supportedFormats')}</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileChange} />
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || !selectedMapping || uploading}
            className={cn('w-full flex items-center justify-center gap-2 font-medium', BUTTON_VARIANTS.primary, BUTTON_SIZES.lg, 'disabled:opacity-50')}
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            {uploading ? t('import.uploading') : t('import.uploadStart')}
          </button>

          {!selectedMapping && (
            <div className="flex items-center gap-2 text-sm text-ctr-warning bg-warning-bright/15 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              {t('import.mappingRequiredWarning')}
            </div>
          )}
        </TabsContent>

        {/* Tab: Mapping Editor */}
        <TabsContent value="mapping" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className={TYPOGRAPHY.cardTitle}>
              {t('import.mappingList', { code: selectedCompany?.code ?? '' })}
            </h3>
            <button
              type="button"
              onClick={startNewMapping}
              className={cn('inline-flex items-center gap-1.5', BUTTON_VARIANTS.primary, BUTTON_SIZES.md)}
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> {t('import.addNewMapping')}
            </button>
          </div>

          {/* Existing Mappings */}
          {mappings.length > 0 && (
            <div className={TABLE_STYLES.wrapper}>
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>{t('import.colMappingName')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('import.colFileType')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('import.colCurrency')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('import.default')}</th>
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
                          <CheckCircle2 className="w-4 h-4 text-tertiary" aria-label={t('import.default')} />
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
            <div className="bg-card rounded-xl border border-primary p-5 space-y-4">
              <h4 className={TYPOGRAPHY.cardTitle}>{t('import.newMappingSettings')}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={cn(TYPOGRAPHY.label, 'mb-1 block')}>{t('import.colMappingName')}</label>
                  <input
                    value={editingMapping.name ?? ''}
                    onChange={e => setEditingMapping(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('import.exampleTemplateName')}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className={cn(TYPOGRAPHY.label, 'mb-1 block')}>{t('import.colFileType')}</label>
                  <select
                    value={editingMapping.fileType ?? 'xlsx'}
                    onChange={e => setEditingMapping(prev => ({ ...prev, fileType: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  >
                    <option value="xlsx">XLSX</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
                <div>
                  <label className={cn(TYPOGRAPHY.label, 'mb-1 block')}>{t('import.headerRowNumber')}</label>
                  <input
                    type="number"
                    min={1}
                    value={editingMapping.headerRow ?? 1}
                    onChange={e => setEditingMapping(prev => ({ ...prev, headerRow: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <h5 className={cn(TYPOGRAPHY.label, 'mb-2')}>{t('import.columnMappingFileHeader')}</h5>
                <div className="grid grid-cols-2 gap-3">
                  {STANDARD_FIELDS.map(field => (
                    <div key={field.key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-28 shrink-0">
                        {t(field.labelKey)}
                        {field.required && <span className="text-destructive ml-0.5">*</span>}
                      </span>
                      <ChevronRight className="w-3 h-3 text-border shrink-0" />
                      <input
                        value={(editingMapping.mappings as Record<string, string>)?.[field.key] ?? ''}
                        onChange={e => setEditingMapping(prev => ({
                          ...prev,
                          mappings: { ...(prev?.mappings as Record<string, string> ?? {}), [field.key]: e.target.value }
                        }))}
                        placeholder={t('import.fileHeaderName')}
                        className="flex-1 px-2.5 py-1.5 border border-border rounded text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingMapping.isDefault ?? false}
                    onChange={e => setEditingMapping(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="w-4 h-4 rounded border-border text-primary"
                  />
                  {t('import.setAsDefaultMapping')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingMapping(null)}
                    className={cn(BUTTON_VARIANTS.secondary, BUTTON_SIZES.md)}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={saveMapping}
                    disabled={savingMapping || !editingMapping.name}
                    className={cn('inline-flex items-center gap-1.5', BUTTON_VARIANTS.primary, BUTTON_SIZES.md, 'disabled:opacity-50')}
                  >
                    <Save className="w-4 h-4" aria-hidden="true" />
                    {savingMapping ? tCommon('loading') : tCommon('save')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab: History */}
        <TabsContent value="history" className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{t('company')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('import.colPeriod')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('import.colFile')}</th>
                <th className={TABLE_STYLES.headerCellRight}>{t('import.colPersonCount')}</th>
                <th className={TABLE_STYLES.headerCellRight}>{t('import.colTotalAmount')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('status.title')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('import.colUploadDate')}</th>
              </tr>
            </thead>
            <tbody>
              {loadingLogs ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">{tCommon('loading')}</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7}><EmptyState size="sm" title={t('import.noHistory')} sub="" /></td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className={TABLE_STYLES.row}>
                    <td className={cn(TABLE_STYLES.cell, "font-medium")}>{log.company.code}</td>
                    <td className={TABLE_STYLES.cellMuted}>{t('import.yearMonth', { year: log.year, month: log.month })}</td>
                    <td className={TABLE_STYLES.cellMuted}>
                      <div className="truncate max-w-[180px]" title={log.fileName}>{log.fileName}</div>
                    </td>
                    <td className={TABLE_STYLES.cellRight}>{t('import.personCount', { count: log.employeeCount.toLocaleString(locale) })}</td>
                    <td className={cn(TABLE_STYLES.cellRight, "font-mono tabular-nums")}>
                      {Number(log.totalGross).toLocaleString(locale)} {log.currency}
                    </td>
                    <td className={TABLE_STYLES.cell}>{statusBadge(log.status)}</td>
                    <td className={cn(TABLE_STYLES.cellMuted, "text-xs")}>
                      {new Date(log.createdAt).toLocaleDateString(locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>

      {/* Toast */}
      {toastState && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white z-50
          ${toastState.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toastState.msg}
        </div>
      )}
    </div>
  )
}
