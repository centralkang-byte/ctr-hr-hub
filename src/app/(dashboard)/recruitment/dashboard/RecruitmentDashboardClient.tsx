'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recruitment Dashboard
// 채용 대시보드: KPI 카드 + 채용 퍼널 + 최근 공고
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  UserPlus,
  Users,
  Clock,
  Target,
  Loader2,
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

// ─── Constants ──────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  APPLIED: '지원',
  SCREENING: '서류심사',
  INTERVIEW_1: '1차면접',
  INTERVIEW_2: '2차면접',
  FINAL: '최종',
  OFFER: '오퍼',
  HIRED: '합격',
  REJECTED: '불합격',
}

const STAGE_COLORS: Record<string, string> = {
  APPLIED: '#999999',
  SCREENING: '#2196F3',
  INTERVIEW_1: '#2196F3',
  INTERVIEW_2: '#2196F3',
  FINAL: '#FF9800',
  OFFER: '#00C853',
  HIRED: '#00C853',
  REJECTED: '#F44336',
}

interface KpiCardConfig {
  label: string
  icon: LucideIcon
  color: string
  format: (kpis: DashboardKpis) => string
}

const KPI_CARDS: KpiCardConfig[] = [
  {
    label: '진행중 공고',
    icon: UserPlus,
    color: '#2196F3',
    format: (k) => String(k.activePostings),
  },
  {
    label: '총 지원자',
    icon: Users,
    color: '#00C853',
    format: (k) => String(k.totalApplicants),
  },
  {
    label: '평균 채용기간',
    icon: Clock,
    color: '#FF9800',
    format: (k) => (k.avgTimeToHire != null ? `${k.avgTimeToHire}일` : '-'),
  },
  {
    label: '합격률',
    icon: Target,
    color: '#00C853',
    format: (k) => `${k.hireRate}%`,
  },
]

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
            color: '#333',
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
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
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
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
        {data.payload.stageName}
      </p>
      <p style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
        {data.value}명
      </p>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────

export function RecruitmentDashboardClient(_props: {
  user: SessionUser
}) {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      try {
        const res = await apiClient.get<DashboardData>(
          '/api/v1/recruitment/dashboard',
        )
        setData(res.data)
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
        데이터를 불러올 수 없습니다.
      </div>
    )
  }

  // Prepare funnel chart data
  const funnelData = data.funnel.map((item) => ({
    stage: item.stage,
    stageName: STAGE_LABELS[item.stage] ?? item.stage,
    count: item.count,
    fill: STAGE_COLORS[item.stage] ?? '#999',
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="채용 대시보드"
        description="채용 현황 및 통계"
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
            color: '#333',
            marginBottom: 20,
            letterSpacing: '-0.02em',
          }}
        >
          채용 퍼널
        </h2>
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={funnelData}
              margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#F0F0F0"
                horizontal={false}
              />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#999' }} />
              <YAxis
                type="category"
                dataKey="stageName"
                width={80}
                tick={{ fontSize: 13, fill: '#333' }}
              />
              <Tooltip
                content={<CustomTooltip />}
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
            color: '#333',
            marginBottom: 16,
            letterSpacing: '-0.02em',
          }}
        >
          최근 공고
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid #E8E8E8',
              }}
            >
              <th
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: '#999',
                  fontWeight: 500,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                }}
              >
                공고 제목
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: '#999',
                  fontWeight: 500,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                }}
              >
                지원자수
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: '#999',
                  fontWeight: 500,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                }}
              >
                게시일
              </th>
            </tr>
          </thead>
          <tbody>
            {data.recentPostings.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  style={{
                    textAlign: 'center',
                    padding: 32,
                    color: '#999',
                    fontSize: 14,
                  }}
                >
                  최근 공고가 없습니다
                </td>
              </tr>
            ) : (
              data.recentPostings.slice(0, 5).map((posting) => (
                <tr
                  key={posting.id}
                  onClick={() => router.push(`/recruitment/${posting.id}`)}
                  style={{
                    borderBottom: '1px solid #F5F5F5',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FAFAFA'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <td
                    style={{
                      padding: '12px',
                      fontSize: 14,
                      color: '#333',
                      fontWeight: 500,
                    }}
                  >
                    {posting.title}
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      fontSize: 14,
                      color: '#333',
                      textAlign: 'right',
                    }}
                  >
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
                      {posting.applicantCount}명
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      fontSize: 14,
                      color: '#666',
                      textAlign: 'right',
                    }}
                  >
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
