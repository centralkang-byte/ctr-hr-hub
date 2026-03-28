// ═══════════════════════════════════════════════════════════
// GET /api/v1/dashboard/compare/export — 법인 비교 Excel 다운로드
// 클라이언트 필터와 동일한 파라미터를 받아 정확히 일치하는 데이터만 내보냄
// ═══════════════════════════════════════════════════════════
import { type NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { CompareKpiKey } from '@/lib/analytics/types'

// ─── Constants ──────────────────────────────────────────────

const ALL_KPI_KEYS: CompareKpiKey[] = [
  'turnover_rate', 'leave_usage', 'training_completion', 'payroll_cost',
  'headcount', 'avg_tenure', 'overtime_rate', 'training_hours',
]

const KPI_LABELS: Record<CompareKpiKey, string> = {
  turnover_rate: '이직률(%)',
  leave_usage: '연차 사용률(%)',
  training_completion: '교육 이수율(%)',
  payroll_cost: '인건비(백만 KRW)',
  headcount: '인원(명)',
  avg_tenure: '평균 근속(년)',
  overtime_rate: '초과근무 비율(%)',
  training_hours: '교육시간(시간/인)',
}

// ─── Route Handler ──────────────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { searchParams } = new URL(req.url)

    // 클라이언트 필터 파라미터 — compare API와 동일
    const kpiParam = searchParams.get('kpi') ?? 'all'
    const parsedYear = parseInt(searchParams.get('year') ?? '', 10)
    const year = !isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : new Date().getFullYear()
    const companiesParam = searchParams.get('companies')
    const yoy = searchParams.get('yoy') === 'true'

    // compare API를 내부 호출하여 동일 데이터 가져오기
    const origin = req.nextUrl.origin
    const params = new URLSearchParams({
      kpi: kpiParam,
      year: year.toString(),
      yoy: yoy.toString(),
    })
    if (companiesParam) params.set('companies', companiesParam)

    // 내부 API 호출 (쿠키/헤더 전달)
    const internalRes = await fetch(`${origin}/api/v1/dashboard/compare?${params}`, {
      headers: { cookie: req.headers.get('cookie') ?? '' },
    })

    if (!internalRes.ok) {
      return new NextResponse('데이터 조회 실패', { status: 500 })
    }

    const json = await internalRes.json()
    const { results, kpis, yoyResults } = json.data as {
      results: { company: string; name: string; values: Record<string, number | null>; percentiles: Record<string, number | null> }[]
      kpis: CompareKpiKey[]
      yoyResults?: { company: string; name: string; values: Record<string, number | null> }[]
    }

    const activeKpis = kpis ?? ALL_KPI_KEYS

    // ─── Sheet 1: 법인별 KPI
    const kpiRows = results.map(r => {
      const row: Record<string, string | number | null> = { 법인코드: r.company, 법인명: r.name }
      for (const kpi of activeKpis) {
        row[KPI_LABELS[kpi]] = r.values[kpi] ?? null
      }
      return row
    })

    // ─── Sheet 2: 백분위 순위
    const pctRows = results.map(r => {
      const row: Record<string, string | number | null> = { 법인코드: r.company, 법인명: r.name }
      for (const kpi of activeKpis) {
        row[`${KPI_LABELS[kpi]} 백분위`] = r.percentiles[kpi] != null ? `P${r.percentiles[kpi]}` : null
      }
      return row
    })

    // ─── Sheet 3: YoY 비교 (yoy=true일 때만)
    const yoyRows = yoy && yoyResults
      ? results.map(r => {
          const yoyR = yoyResults.find(y => y.company === r.company)
          const row: Record<string, string | number | null> = { 법인코드: r.company, 법인명: r.name }
          for (const kpi of activeKpis) {
            const cur = r.values[kpi]
            const prev = yoyR?.values[kpi] ?? null
            row[`${KPI_LABELS[kpi]} ${year}년`] = cur
            row[`${KPI_LABELS[kpi]} ${year - 1}년`] = prev
            if (cur != null && prev != null && prev !== 0) {
              row[`${KPI_LABELS[kpi]} 변화율`] = `${Math.round(((cur - prev) / Math.abs(prev)) * 100)}%`
            } else {
              row[`${KPI_LABELS[kpi]} 변화율`] = null
            }
          }
          return row
        })
      : null

    // ─── Excel 생성
    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.json_to_sheet(kpiRows)
    XLSX.utils.book_append_sheet(wb, ws1, '법인별 KPI')

    const ws2 = XLSX.utils.json_to_sheet(pctRows)
    XLSX.utils.book_append_sheet(wb, ws2, '백분위 순위')

    if (yoyRows) {
      const ws3 = XLSX.utils.json_to_sheet(yoyRows)
      XLSX.utils.book_append_sheet(wb, ws3, 'YoY 비교')
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="company_compare_${year}.xlsx"`,
      },
    })
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW)
)
