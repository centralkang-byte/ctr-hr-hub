'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Sparkles, FileText, Loader2, AlertCircle, RefreshCw,
  Calendar, Building2, ChevronDown, Clock,
} from 'lucide-react'
import { TABLE_STYLES } from '@/lib/styles'

interface AiReport {
  id: string
  companyId: string | null
  period: string
  content: string
  metadata: { generatedAt?: string; model?: string } | null
  status: string
  createdAt: string
  companyName: string
}

export default function AiReportClient() {
  const tCommon = useTranslations('common')
  const t = useTranslations('analytics')

  const [reports, setReports] = useState<AiReport[]>([])
  const [currentReport, setCurrentReport] = useState<AiReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  // Form state
  const now = new Date()
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod)
  const [selectedCompany, setSelectedCompany] = useState<string>('')

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const [reportsRes, compRes] = await Promise.all([
        fetch('/api/v1/analytics/ai-report'),
        fetch('/api/v1/companies'),
      ])
      if (reportsRes.ok) {
        const j = await reportsRes.json()
        const data = j.data?.data || j.data || []
        setReports(data)
        if (data.length > 0 && !currentReport) {
          setCurrentReport(data[0])
        }
      }
      if (compRes.ok) {
        const c = await compRes.json()
        setCompanies(c.data || [])
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [currentReport])

  useEffect(() => { fetchReports() }, [fetchReports])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/analytics/ai-report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: selectedPeriod,
          companyId: selectedCompany || undefined,
        }),
      })
      const json = await res.json()
      if (res.ok && json.data?.data) {
        setCurrentReport(json.data.data)
        await fetchReports()
      } else if (json.data?.message) {
        setError(json.data.message)
      } else {
        setError('리포트 생성에 실패했습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  // Generate period options (last 12 months)
  const periodOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Render markdown with deep link support
  const renderMarkdown = (content: string) => {
    // Split into lines and process
    const lines = content.split('\n')
    return lines.map((line, i) => {
      // Headers
      if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold text-gray-900 mb-4 mt-6">{line.slice(2)}</h1>
      if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-gray-800 mb-3 mt-5 pb-2 border-b border-gray-100">{line.slice(3)}</h2>
      if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-gray-700 mb-2 mt-4">{line.slice(4)}</h3>

      // Horizontal rule
      if (line.startsWith('---')) return <hr key={i} className="my-4 border-gray-200" />

      // Table headers
      if (line.startsWith('|') && line.includes('|')) {
        const cells = line.split('|').filter(Boolean).map((c) => c.trim())
        if (cells.every((c) => /^[-:]+$/.test(c))) return null // divider row
        const isHeader = i > 0 && lines[i + 1]?.startsWith('|') && lines[i + 1]?.includes('---')
        return (
          <div key={i} className="overflow-x-auto rounded-xl border border-[#F0F0F3] mb-4">
            <table className={TABLE_STYLES.table}>
              <tbody>
                <tr className={isHeader ? TABLE_STYLES.header : TABLE_STYLES.row}>
                  {cells.map((cell, j) => {
                    const Tag = isHeader ? 'th' : 'td'
                    return (
                      <Tag key={j} className={isHeader ? TABLE_STYLES.headerCell : TABLE_STYLES.cell}>
                        {renderInlineMarkdown(cell)}
                      </Tag>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )
      }

      // List items
      if (line.match(/^[-*]\s/) || line.match(/^\d+\.\s/)) {
        const text = line.replace(/^[-*]\s/, '').replace(/^\d+\.\s/, '')
        return (
          <div key={i} className="flex gap-2 py-1.5 pl-2">
            <span className="text-gray-400 flex-shrink-0">•</span>
            <span className="text-sm text-gray-700 leading-relaxed">{renderInlineMarkdown(text)}</span>
          </div>
        )
      }

      // Italic (footnote)
      if (line.startsWith('*') && line.endsWith('*')) {
        return <p key={i} className="text-xs text-gray-400 italic mt-4">{line.replace(/^\*|\*$/g, '')}</p>
      }

      // Empty line
      if (line.trim() === '') return <div key={i} className="h-2" />

      // Normal paragraph
      return <p key={i} className="text-sm text-gray-700 leading-relaxed py-0.5">{renderInlineMarkdown(line)}</p>
    })
  }

  // Inline markdown: bold, links
  const renderInlineMarkdown = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = []
    let remaining = text
    let keyIdx = 0

    while (remaining.length > 0) {
      // Deep link: [text](/path)
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (linkMatch && linkMatch.index !== undefined) {
        const before = remaining.slice(0, linkMatch.index)
        if (before) parts.push(<React.Fragment key={keyIdx++}>{renderBold(before)}</React.Fragment>)

        const linkText = linkMatch[1]
        const linkHref = linkMatch[2]
        parts.push(
          <Link
            key={keyIdx++}
            href={linkHref}
            className="text-[#5E81F4] hover:text-[#4B6DE0] underline underline-offset-2 font-medium"
          >
            {linkText}
          </Link>
        )
        remaining = remaining.slice((linkMatch.index || 0) + linkMatch[0].length)
        continue
      }

      // No more links — handle bold
      parts.push(<React.Fragment key={keyIdx++}>{renderBold(remaining)}</React.Fragment>)
      break
    }

    return <>{parts}</>
  }

  const renderBold = (text: string): React.ReactNode => {
    const parts = text.split(/\*\*([^*]+)\*\*/)
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="font-semibold text-gray-900">{part}</strong> : part
    )
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Generation Controls */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('period')}</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl bg-white appearance-none cursor-pointer hover:border-[#5E81F4] focus:border-[#5E81F4] focus:ring-2 focus:ring-[#5E81F4]/20 outline-none transition-all min-w-[140px]"
              >
                {periodOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('company')}</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl bg-white appearance-none cursor-pointer hover:border-[#5E81F4] focus:border-[#5E81F4] focus:ring-2 focus:ring-[#5E81F4]/20 outline-none transition-all min-w-[140px]"
              >
                <option value="">{t('kr_keca084ec')}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5E81F4] to-[#6B73E8] text-white text-sm font-medium hover:shadow-lg hover:shadow-[#5E81F4]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('kr_kec839dec_keca491')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {t('kr_keba6aced_kec839dec')}
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-2.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Generating animation */}
      {generating && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#5E81F4]/10 mb-4">
            <Sparkles className="h-8 w-8 text-[#5E81F4] animate-pulse" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('kr_aikeab080_keba6aced_kec839dec_')}</h3>
          <p className="text-sm text-gray-500">{t('kr_kec95bd_5_15kecb488_kec868cec_')}</p>
          <div className="mt-6 w-48 mx-auto">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#5E81F4] to-[#6B73E8] rounded-full animate-[progressBar_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      )}

      {/* Current Report */}
      {currentReport && !generating && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Report Header */}
          <div className="relative bg-gradient-to-br from-[#5E81F4]/5 to-[#6B73E8]/5 px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#5E81F4]/10">
                  <FileText className="h-5 w-5 text-[#5E81F4]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {currentReport.companyName} — {currentReport.period} 리포트
                  </h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(currentReport.createdAt).toLocaleDateString('ko-KR', {
                        year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {(currentReport.metadata as { model?: string })?.model && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#5E81F4]/10 text-[#5E81F4]">
                        {(currentReport.metadata as { model?: string }).model === 'template' ? '템플릿' : '🤖 AI'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedPeriod(currentReport.period)
                  setSelectedCompany(currentReport.companyId || '')
                  handleGenerate()
                }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title="리포트 재생성"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Report Content */}
          <div className="px-6 py-6 max-w-none prose prose-sm">
            {renderMarkdown(currentReport.content)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!currentReport && !generating && reports.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5E81F4]/10 to-[#6B73E8]/10 mb-4">
            <Sparkles className="h-8 w-8 text-[#5E81F4]" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('kr_kec9584ec_kec839dec_keba6aced_')}</h3>
          <p className="text-sm text-gray-500 mb-6">
            {t('kr_kec8381eb_quot_keba6aced_kec83')}
          </p>
        </div>
      )}

      {/* Report History */}
      {reports.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">{t('prev_keba6aced')}</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {reports.filter((r) => r.id !== currentReport?.id).map((report) => (
              <button
                key={report.id}
                onClick={() => setCurrentReport(report)}
                className="w-full px-6 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{report.period}</span>
                    <span className="text-xs text-gray-500 ml-2">{report.companyName}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(report.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
