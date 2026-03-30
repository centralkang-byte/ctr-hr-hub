'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recruitment Dashboard
// 채용 대시보드: KPI 카드 + 채용 퍼널 + 최근 공고
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import {
  UserPlus,
  Users,
  Clock,
  Target,
  Loader2,
  Briefcase,
  type LucideIcon,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import type { SessionUser } from '@/types'
import { TABLE_STYLES, CHART_THEME } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

interface DashboardKpis {
  activePostings: number
  totalApplicants: number
  avgTimeToHire: number | null
  hireRate: number
}

interface FunnelItem {
  stage: string
  count: number
}

interface RecentPosting {
  id: string
  title: string
  applicantCount: number
  publishedAt: string | null
}

interface DashboardData {
  kpis: DashboardKpis
  funnel: FunnelItem[]
  recentPostings: RecentPosting[]
}

interface VacancySummary {
  totalVacancies: number
  withActivePosting: number
  withoutPosting: number
  recentlyFilled: number
  avgFillDays: number | null
}

interface VacancyByCompany {
  companyId: string
  companyName: string
  total: number
  withActivePosting: number
  withoutPosting: number
}

// ─── Constants ──────────────────────────────────────────────

const STAGE_LABEL_KEYS: Record<string, string> = {
  APPLIED: 'stageShortAPPLIED',
  SCREENING: 'stageShortSCREENING',
  INTERVIEW_1: 'stageShortINTERVIEW_1',
  INTERVIEW_2: 'stageShortINTERVIEW_2',
  FINAL: 'stageShortFINAL',
  OFFER: 'stageShortOFFER',
  HIRED: 'stageShortHIRED',
  REJECTED: 'stageShortREJECTED',
}

const STAGE_COLORS: Record<string, string> = {
  APPLIED: '#999999',
  SCREENING: '#2196F3',
  INTERVIEW_1: '#2196F3',
  INTERVIEW_2: '#2196F3',
  FINAL: '#FF9800',
  OFFER: '#5E81F4',
  HIRED: '#5E81F4',
  REJECTED: '#F44336',
}

// ─── KPI Card Component ─────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  icon: LucideIcon
  color: string
}) {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E8E8E8',
        borderRadius: 12,
        padding: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: `${color}14`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#1A1A1A',
            lineHeight: 1.2,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#999',
            marginTop: 4,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

// ─── Custom Tooltip ─────────────────────────────────────────

interface TooltipPayloadEntry {
  value: number
  payload: { stageName: string; count: number }
}

function CustomTooltip({
  active,
  payload,
  t,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  if (!active || !payload || payload.length === 0) return null
  const data = payload[0]
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E8E8E8',
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
        {data.payload.stageName}
      </p>
      <p style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
        {t('countPeople', { count: data.value })}
      </p>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────

export function RecruitmentDashboardClient(_props: {
  user: SessionUser
}) {
  const router = useRouter()
  const t = useTranslations('recruitment')
  const [data, setData] = useState<DashboardData | null>(null)
  const [vacancySummary, setVacancySummary] = useState<VacancySummary | null>(null)
  const [vacancyByCompany, setVacancyByCompany] = useState<VacancyByCompany[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      try {
        const [dashRes, vacRes] = await Promise.all([
          apiClient.get<DashboardData>('/api/v1/recruitment/dashboard'),
          apiClient.get<{ summary: VacancySummary; byCompany: VacancyByCompany[] }>(
            '/api/v1/recruitment/positions/vacancies',
          ),
        ])
        setData(dashRes.data)
        setVacancySummary(vacRes.data.summary)
        setVacancyByCompany(vacRes.data.byCompany)
      } catch {
        // Error handled by apiClient
      } finally {
        setLoading(false)
      }
    }
    void loadDashboard()
  }, [])

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
        }}
      >
        <Loader2
          size={32}
          style={{ color: '#999', animation: 'spin 1s linear infinite' }}
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 48,
          color: '#999',
          fontSize: 14,
        }}
      >
        {'데이터를 불러올 수 없습니다.'}
      </div>
    )
  }

  // KPI cards config (inside component to access t())
  const KPI_CARDS: { label: string; icon: LucideIcon; color: string; format: (kpis: DashboardKpis) => string }[] = [
    {
      label: '진행중 공고',
      icon: UserPlus,
      color: '#2196F3',
      format: (k) => String(k.activePostings),
    },
    {
      label: '총 지원자',
      icon: Users,
      color: '#5E81F4',
      format: (k) => String(k.totalApplicants),
    },
    {
      label: '평균 채용기간',
      icon: Clock,
      color: '#FF9800',
      format: (k) => (k.avgTimeToHire != null ? t('avgTimeToHireDays', { days: k.avgTimeToHire }) : '-'),
    },
    {
      label: '합격률',
      icon: Target,
      color: '#5E81F4',
      format: (k) => t('hireRatePercent', { rate: k.hireRate }),
    },
  ]

  // Prepare funnel chart data
  const funnelData = data.funnel.map((item) => ({
    stage: item.stage,
    stageName: STAGE_LABEL_KEYS[item.stage] ? t(STAGE_LABEL_KEYS[item.stage]) : item.stage,
    count: item.count,
    fill: STAGE_COLORS[item.stage] ?? '#999',
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title={'채용 대시보드'}
        description={'채용 현황 및 통계'}
      />

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 24,
        }}
      >
        {KPI_CARDS.map((card) => (
          <KpiCard
            key={card.label}
            label={card.label}
            value={card.format(data.kpis)}
            icon={card.icon}
            color={card.color}
          />
        ))}
      </div>

      {/* Recruitment Funnel */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E8E8',
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#1A1A1A',
            marginBottom: 20,
            letterSpacing: '-0.02em',
          }}
        >
          {'채용 퍼널'}
        </h2>
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={funnelData}
              margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray}
                horizontal={false}
              />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#999' }} />
              <YAxis
                type="category"
                dataKey="stageName"
                width={80}
                tick={{ fontSize: 13, fill: '#1A1A1A' }}
              />
              <Tooltip
                content={<CustomTooltip t={t} />}
                cursor={{ fill: '#FAFAFA' }}
              />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                barSize={28}
                label={{
                  position: 'right',
                  fill: '#666',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {funnelData.map((entry) => (
                  <Cell key={entry.stage} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 공석 현황 (B4 + A2) */}
      {vacancySummary && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E8E8E8',
            borderRadius: 12,
            padding: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Briefcase size={18} style={{ color: '#5E81F4' }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
              {'공석 현황 (Position Vacancies)'}
            </h2>
          </div>

          {/* 요약 뱃지 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { label: '전체 공석', value: vacancySummary.totalVacancies, bg: '#F5F5F5', color: '#1A1A1A' },
              { label: '채용 진행 중', value: vacancySummary.withActivePosting, bg: '#EDF1FE', color: '#4B6DE0' },
              { label: '공고 없음', value: vacancySummary.withoutPosting, bg: '#FEF3C7', color: '#B45309' },
              { label: '30일 내 충원', value: vacancySummary.recentlyFilled, bg: '#E0E7FF', color: '#4B6DE0' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  backgroundColor: item.bg,
                  borderRadius: 10,
                  padding: '12px 16px',
                  minWidth: 110,
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
            {vacancySummary.avgFillDays !== null && (
              <div style={{ backgroundColor: '#F0F9FF', borderRadius: 10, padding: '12px 16px', minWidth: 110 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0369A1' }}>{vacancySummary.avgFillDays}일</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{'평균 채용 소요일'}</div>
              </div>
            )}
          </div>

          {/* 법인별 공석 테이블 */}
          {vacancyByCompany.length > 0 && (
            <div className={TABLE_STYLES.wrapper}>
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    {['법인', '전체 공석', '채용 진행', '공고 없음'].map((h) => (
                      <th key={h} className={h === '법인' ? TABLE_STYLES.headerCell : TABLE_STYLES.headerCellRight}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {!vacancyByCompany?.length && <EmptyState />}
                {vacancyByCompany?.map((row) => (
                    <tr key={row.companyId} className="hover:bg-background transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{row.companyName}</td>
                      <td className="px-4 py-3 text-sm text-foreground text-right">{row.total}</td>
                      <td className="px-4 py-3 text-sm text-primary/90 text-right">{row.withActivePosting}</td>
                      <td className="px-4 py-3 text-sm text-amber-700 text-right">{row.withoutPosting}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recent Postings */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E8E8',
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#1A1A1A',
            marginBottom: 16,
            letterSpacing: '-0.02em',
          }}
        >
          {'최근 공고'}
        </h2>
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{'공고 제목'}</th>
                <th className={TABLE_STYLES.headerCellRight}>{'지원자수'}</th>
                <th className={TABLE_STYLES.headerCellRight}>{'게시일'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.recentPostings.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-12 text-center text-sm text-[#999]"
                  >
                    {'최근 공고가 없습니다'}
                  </td>
                </tr>
              ) : (
                data.recentPostings.slice(0, 5).map((posting) => (
                  <tr
                    key={posting.id}
                    onClick={() => router.push(`/recruitment/${posting.id}`)}
                    className={TABLE_STYLES.rowClickable}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {posting.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground text-right">
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: '#E3F2FD',
                          color: '#2196F3',
                        }}
                      >
                        {t('countPeople', { count: posting.applicantCount })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#666] text-right">
                      {posting.publishedAt
                        ? format(new Date(posting.publishedAt), 'yyyy-MM-dd')
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Responsive styles via media query */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}
