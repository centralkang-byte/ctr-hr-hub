'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

interface LatestReport {
  period: string
  content: string
  companyName: string
}

export function AiInsightBanner() {
  const [insight, setInsight] = useState<string | null>(null)
  const [period, setPeriod] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/v1/analytics/ai-report?limit=1')
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        const reports = json?.data?.data || json?.data || []
        if (reports.length > 0) {
          const report = reports[0] as LatestReport
          setPeriod(report.period)
          // Extract first meaningful insight from ⚠️ section
          const lines = report.content.split('\n')
          const riskIdx = lines.findIndex((l: string) => l.includes('⚠️') || l.includes('위험 신호'))
          if (riskIdx >= 0) {
            // Find the first bullet point after risk header
            for (let i = riskIdx + 1; i < Math.min(riskIdx + 5, lines.length); i++) {
              const line = lines[i].trim()
              if (line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./)) {
                setInsight(line.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 100))
                break
              }
            }
          }
          if (!insight) {
            // Fallback: first line of report
            const firstMeaningful = lines.find((l: string) => l.trim() && !l.startsWith('#'))
            if (firstMeaningful) setInsight(firstMeaningful.trim().slice(0, 100))
          }
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!loaded) return null

  return (
    <Link href="/analytics/ai-report" className="block">
      <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50 to-white p-4 mb-6 hover:shadow-md hover:border-[#5E81F4]/30 transition-all group cursor-pointer">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 rounded-lg bg-gradient-to-br from-[#5E81F4] to-[#8B5CF6] p-2">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {insight && period ? (
              <>
                <p className="text-sm font-medium text-gray-700 truncate">
                  🤖 {period} AI 인사이트: {insight}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  AI 월간 리포트에서 전체 분석 보기
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">
                  ✨ AI 인사이트를 활용하세요
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  리포트를 생성하면 핵심 변동 + 위험 신호를 AI가 요약합니다.
                </p>
              </>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-[#5E81F4] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </div>
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-blue-100/50 to-indigo-100/50" />
      </div>
    </Link>
  )
}
