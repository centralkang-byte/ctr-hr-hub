'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compliance Dashboard Landing Page
// Shows GDPR status summary + country-specific compliance cards
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ShieldCheck,
  Shield,
  Eye,
  FileSearch,
  Database,
  FileText,
  Scale,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react'
import { CARD_STYLES } from '@/lib/styles'
import type { SessionUser } from '@/types'

interface GdprStats {
  activeConsents: number
  pendingRequests: number
  retentionPolicies: number
  dpiaRecords: number
}

export default function ComplianceClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')

  const t = useTranslations('compliance')
  const [stats, setStats] = useState<GdprStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const [consentsRes, requestsRes, retentionRes, dpiaRes] = await Promise.all([
          fetch('/api/v1/compliance/gdpr/consents?page=1&limit=1'),
          fetch('/api/v1/compliance/gdpr/requests?status=GDPR_PENDING&page=1&limit=1'),
          fetch('/api/v1/compliance/gdpr/retention?page=1&limit=1'),
          fetch('/api/v1/compliance/gdpr/dpia?page=1&limit=1'),
        ])

        const [consents, requests, retention, dpia] = await Promise.all([
          consentsRes.ok ? consentsRes.json() : { pagination: { total: 0 } },
          requestsRes.ok ? requestsRes.json() : { pagination: { total: 0 } },
          retentionRes.ok ? retentionRes.json() : { pagination: { total: 0 } },
          dpiaRes.ok ? dpiaRes.json() : { pagination: { total: 0 } },
        ])

        setStats({
          activeConsents: consents.pagination?.total ?? 0,
          pendingRequests: requests.pagination?.total ?? 0,
          retentionPolicies: retention.pagination?.total ?? 0,
          dpiaRecords: dpia.pagination?.total ?? 0,
        })
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    void loadStats()
  }, [])

  const kpiCards = [
    { label: t('gdpr.consents'), value: stats?.activeConsents ?? 0, icon: Shield, color: 'text-emerald-600' },
    { label: t('gdpr.requests'), value: stats?.pendingRequests ?? 0, icon: FileSearch, color: 'text-amber-600' },
    { label: t('gdpr.retention'), value: stats?.retentionPolicies ?? 0, icon: Database, color: 'text-primary' },
    { label: t('gdpr.dpia'), value: stats?.dpiaRecords ?? 0, icon: FileSearch, color: 'text-primary' },
  ]

  const navCards = [
    {
      title: t('gdpr.title'),
      description: 'GDPR compliance management — consents, requests, DPIA',
      href: '/compliance/gdpr',
      icon: Shield,
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      title: t('gdpr.piiAudit'),
      description: t('gdpr.piiAuditDesc'),
      href: '/compliance/pii-audit',
      icon: Eye,
      color: 'bg-primary/10 text-primary',
    },
    {
      title: t('gdpr.retention'),
      description: t('gdpr.retentionDesc'),
      href: '/compliance/data-retention',
      icon: Database,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      title: t('gdpr.dpia'),
      description: t('gdpr.dpiaDesc'),
      href: '/compliance/dpia',
      icon: FileSearch,
      color: 'bg-indigo-100 text-primary',
    },
  ]

  const countryCards = [
    {
      title: t('ru.title'),
      description: t('ru.description'),
      href: '/compliance/ru',
      icon: FileText,
      flag: '🇷🇺',
    },
    {
      title: t('cn.title'),
      description: t('cn.description'),
      href: '/compliance/cn',
      icon: Scale,
      flag: '🇨🇳',
    },
    {
      title: t('kr.title'),
      description: t('kr.description'),
      href: '/compliance/kr',
      icon: ClipboardCheck,
      flag: '🇰🇷',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
      </div>

      {/* GDPR KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <div key={card.label} className={CARD_STYLES.padded}>
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${card.color} bg-opacity-10`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-xs text-[#666]">{card.label}</p>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '—' : card.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* GDPR Navigation */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">{t('gdpr.title')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {navCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`${CARD_STYLES.kpi} hover:transition-shadow group`}
            >
              <div className={`inline-flex rounded-lg p-2 ${card.color} mb-3`}>
                <card.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{card.title}</h3>
              <p className="text-xs text-[#666] mb-3">{card.description}</p>
              <div className="flex items-center text-xs font-medium text-primary group-hover:text-primary/90">
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Country-specific Compliance */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Country-specific Compliance</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {countryCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`${CARD_STYLES.kpi} hover:transition-shadow group`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{card.flag}</span>
                <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
              </div>
              <p className="text-xs text-[#666] mb-3">{card.description}</p>
              <div className="flex items-center text-xs font-medium text-primary group-hover:text-primary/90">
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
