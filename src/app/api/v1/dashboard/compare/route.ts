import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

type KpiKey = 'turnover_rate' | 'leave_usage' | 'training_completion' | 'payroll_cost'

async function calcKpiValue(kpi: KpiKey, companyId: string, year: number): Promise<number | null> {
  try {
    switch (kpi) {
      case 'turnover_rate': {
        const start = new Date(year, 0, 1)
        const end = new Date(year, 11, 31)
        const [terminated, base] = await Promise.all([
          prisma.employeeAssignment.count({
            where: { companyId, isPrimary: true, status: 'TERMINATED', endDate: { gte: start, lte: end } },
          }),
          prisma.employeeAssignment.count({
            where: {
              companyId,
              isPrimary: true,
              effectiveDate: { lte: start },
              OR: [{ endDate: null }, { endDate: { gt: start } }],
            },
          }),
        ])
        return base > 0 ? Math.round((terminated / base) * 1000) / 10 : null
      }
      case 'leave_usage': {
        const balances = await prisma.leaveYearBalance.findMany({
          where: {
            year,
            employee: { assignments: { some: { companyId, isPrimary: true, endDate: null } } },
            entitled: { gt: 0 },
          },
          select: { entitled: true, used: true },
        })
        if (balances.length === 0) return null
        const avg = balances.reduce((s, b) => s + b.used / b.entitled, 0) / balances.length
        return Math.round(avg * 1000) / 10
      }
      case 'training_completion': {
        const [total, done] = await Promise.all([
          prisma.trainingEnrollment.count({
            where: {
              enrolledAt: { gte: new Date(year, 0, 1) },
              employee: { assignments: { some: { companyId, isPrimary: true } } },
            },
          }),
          prisma.trainingEnrollment.count({
            where: {
              status: 'ENROLLMENT_COMPLETED',
              enrolledAt: { gte: new Date(year, 0, 1) },
              employee: { assignments: { some: { companyId, isPrimary: true } } },
            },
          }),
        ])
        return total > 0 ? Math.round((done / total) * 1000) / 10 : null
      }
      case 'payroll_cost': {
        const runs = await prisma.payrollRun.findMany({
          where: { companyId, yearMonth: { startsWith: year.toString() }, status: { in: ['APPROVED', 'PAID'] } },
          include: { items: { select: { grossPay: true } } },
        })
        const totalLocal = runs.reduce(
          (s, r) => s + r.items.reduce((ss, i) => ss + Number(i.grossPay), 0),
          0
        )
        const company = await prisma.company.findUnique({ where: { id: companyId }, select: { currency: true } })
        let rate = 1
        if (company?.currency && company.currency !== 'KRW') {
          const er = await prisma.exchangeRate.findFirst({
            where: { fromCurrency: company.currency, toCurrency: 'KRW', year },
            orderBy: { month: 'desc' },
          })
          rate = er ? Number(er.rate) : 1
        }
        return Math.round((totalLocal * rate) / 1000000)
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

export const GET = withPermission(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const kpi = (searchParams.get('kpi') ?? 'turnover_rate') as KpiKey
    const year = Number(searchParams.get('year') ?? new Date().getFullYear())

    const companies = await prisma.company.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    })

    const results = await Promise.all(
      companies.map(async (c) => ({
        companyId: c.id,
        company: c.code,
        name: c.name,
        value: await calcKpiValue(kpi, c.id, year),
      }))
    )

    const trendStart = new Date(year, 0, 1)
    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: { type: kpi, snapshotDate: { gte: trendStart } },
      orderBy: { snapshotDate: 'asc' },
      select: { companyId: true, snapshotDate: true, data: true },
    })

    return apiSuccess({ results, trend: snapshots, kpi, year })
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW)
)
