// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/dashboard — 급여 파이프라인 통합 현황
// ═══════════════════════════════════════════════════════════
// Query: { year, month }  (default: current month)
// Response: { pipelines[], summary{} }
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { getPayrollSetting, getSettingValue } from '@/lib/settings/get-setting'

// ─── Status → Pipeline Step Mapping ────────────────────────

// Settings-connected: reads from PAYROLL/pipeline-steps, falls back to defaults
const DEFAULT_STATUS_TO_STEP: Record<string, number> = {
    DRAFT: 1,  // STEP 1: 근태 마감 前
    ATTENDANCE_CLOSED: 2,  // STEP 1: 근태 마감 완료
    CALCULATING: 3,  // STEP 2: 자동 계산 진행중
    ADJUSTMENT: 4,  // STEP 2.5: 수동 조정
    REVIEW: 5,  // STEP 3: 이상 검토
    PENDING_APPROVAL: 6,  // STEP 4: 결재 대기
    APPROVED: 7,  // STEP 5: 승인 완료 (명세서 발행)
    PAID: 8,  // STEP 5: 지급 완료
    CANCELLED: 0,
}

// ─── Payroll Calendar (법인별 마감/지급일) ──────────────────
// Settings-connected: reads from PAYROLL/pay-schedule, falls back to defaults
const DEFAULT_PAYROLL_CALENDAR: Record<string, { closingDay: number; payDay: number; payDayNextMonth?: boolean }> = {
    'CTR-CN': { closingDay: 5, payDay: 10 },
    'CTR-US': { closingDay: 15, payDay: 20 },
    'CTR-KR': { closingDay: 20, payDay: 25 },
    'CTR-VN': { closingDay: 25, payDay: 30 },
    'CTR-MX': { closingDay: 28, payDay: 5, payDayNextMonth: true },
    'CTR-RU': { closingDay: 31, payDay: 10, payDayNextMonth: true },
}

// ─── Helper: compute D-day from closing deadline ────────────

function computeDDay(targetDate: Date, now: Date): number {
    const diff = Math.ceil((targetDate.getTime() - now.getTime()) / 86400_000)
    return diff
}

// ─── Route ─────────────────────────────────────────────────

export const GET = withPermission(
    async (req: NextRequest, _context, _user) => {
        const { searchParams } = req.nextUrl
        const now = new Date()
        const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()), 10)
        const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1), 10)
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`

        // ── 1. Fetch all companies for this HR admin ─────────────

        const companies = await prisma.company.findMany({
            where: { isActive: true },
            select: {
                id: true, code: true, name: true, countryCode: true,
                payrollRuns: {
                    where: { yearMonth },
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        status: true,
                        headcount: true,
                        totalNet: true,
                        totalGross: true,
                        anomalyCount: true,
                        allAnomaliesResolved: true,
                        payDate: true,
                        payrollApproval: {
                            select: { status: true, currentStep: true, totalSteps: true },
                        },
                    },
                },
            },
            orderBy: { code: 'asc' },
        })

        // ── 2. Build pipeline entries ─────────────────────────────

        // Settings-connected: pre-fetch pay schedule and pipeline steps
        const payScheduleSettings = await getPayrollSetting<Record<string, { closingDay: number; payDay: number; payDayNextMonth?: boolean }>>(
            'pay-calendar',
        )
        const calendarMap = payScheduleSettings ?? DEFAULT_PAYROLL_CALENDAR
        const statusStepSettings = await getSettingValue<Record<string, number>>('PAYROLL', 'pipeline-steps')
        const statusToStep = statusStepSettings ?? DEFAULT_STATUS_TO_STEP

        const pipelines = companies.map((co) => {
            const run = co.payrollRuns[0] ?? null
            const calDef = calendarMap[co.code ?? ''] ?? DEFAULT_PAYROLL_CALENDAR[co.code ?? '']

            // Compute deadlines
            const closingDeadline = calDef
                ? new Date(year, month - 1, calDef.closingDay)
                : null
            const payDay = calDef
                ? new Date(
                    year,
                    calDef.payDayNextMonth ? month : month - 1,
                    calDef.payDay,
                )
                : null

            const dDayClosing = closingDeadline ? computeDDay(closingDeadline, now) : null
            const dDayPay = payDay ? computeDDay(payDay, now) : null

            // Alert level: 'red' D≤0, 'amber' D≤3, 'normal'
            const alertLevel: 'red' | 'amber' | 'normal' =
                dDayClosing != null && dDayClosing <= 0 ? 'red'
                    : dDayClosing != null && dDayClosing <= 3 ? 'amber'
                        : 'normal'

            return {
                companyId: co.id,
                companyCode: co.code,
                companyName: co.name,
                countryCode: co.countryCode,
                payrollRunId: run?.id ?? null,
                currentStep: run ? (statusToStep[run.status] ?? DEFAULT_STATUS_TO_STEP[run.status] ?? 0) : 0,
                status: run?.status ?? 'NOT_STARTED',
                employeeCount: run?.headcount ?? 0,
                totalNetPay: run?.totalNet ? Number(run.totalNet) : 0,
                totalGrossPay: run?.totalGross ? Number(run.totalGross) : 0,
                anomalyCount: run?.anomalyCount ?? 0,
                allAnomaliesResolved: run?.allAnomaliesResolved ?? false,
                pendingApproval: run?.status === 'PENDING_APPROVAL',
                approvalStep: run?.payrollApproval?.currentStep ?? null,
                approvalTotal: run?.payrollApproval?.totalSteps ?? null,
                calDef: calDef ?? null,
                closingDeadline: closingDeadline?.toISOString() ?? null,
                payDay: payDay?.toISOString() ?? null,
                dDayClosing,
                dDayPay,
                alertLevel,
            }
        })

        // ── 3. Aggregate summary ──────────────────────────────────

        // Previous month runs for MoM
        const prevYearMonth = month === 1
            ? `${year - 1}-12`
            : `${year}-${String(month - 1).padStart(2, '0')}`

        const [prevRuns] = await Promise.all([
            prisma.payrollRun.findMany({
                where: {
                    yearMonth: prevYearMonth,
                    status: { in: ['APPROVED', 'PAID'] },
                },
                select: { totalNet: true },
            }),
        ])

        const totalNetPay = pipelines.reduce((s, p) => s + p.totalNetPay, 0)
        const prevTotalNet = prevRuns.reduce((s, r) => s + Number(r.totalNet ?? 0), 0)
        const momChangePercent = prevTotalNet > 0
            ? Math.round(((totalNetPay - prevTotalNet) / prevTotalNet) * 1000) / 10
            : 0

        const openAnomalies = pipelines.reduce((s, p) => s + (p.anomalyCount > 0 && !p.allAnomaliesResolved ? p.anomalyCount : 0), 0)
        const pendingApprovals = pipelines.filter((p) => p.pendingApproval).length
        const alertCount = pipelines.filter((p) => p.alertLevel !== 'normal' && p.currentStep < 7).length

        const summary = {
            yearMonth,
            year,
            month,
            totalNetPay,
            prevTotalNet,
            momChangePercent,
            openAnomalies,
            pendingApprovals,
            alertCount,
            totalCompanies: companies.length,
            completedCompanies: pipelines.filter((p) => p.currentStep >= 7).length,
        }

        return apiSuccess({ pipelines, summary }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.VIEW),
)
