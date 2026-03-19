// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/[runId]/export/transfer
// 은행 이체 파일 CSV 생성 (feat. BOM for Korean Excel)
// ═══════════════════════════════════════════════════════════
//
// BankTransferBatch + BankTransferItem 모델을 활용.
// Employee에 bankCode/accountNumber 가 없는 경우 → 기본값 사용
// 실제 계좌 정보는 BankTransferItem에서 생성 시 입력받도록 설계.
//
// CSV 형식:
//   성명,은행코드,계좌번호,이체금액,비고
// BOM 포함: \uFEFF (한글 Excel 호환)
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiError } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

// Settings-connected: transfer note format (default: YYYY-MM 급여)
const TRANSFER_NOTE_FORMAT = (yearMonth: string) => `${yearMonth} 급여`

export const GET = withRateLimit(withPermission(
    async (req: NextRequest, context, user) => {
        try {
            const { runId } = await context.params

            const run = await prisma.payrollRun.findUnique({
                where: { id: runId, companyId: user.companyId },
            })
            if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
            if (!['APPROVED', 'PAID'].includes(run.status)) {
                throw badRequest('APPROVED 또는 PAID 상태에서만 이체 파일을 생성할 수 있습니다.')
            }

            // PayrollItem + Employee 정보 조회
            const items = await prisma.payrollItem.findMany({
                where: { runId },
                include: {
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            employeeNo: true,
                            // Employee 모델에 bankCode/accountNumber 필드 없음
                            // BankTransferItem에서 조회하거나 기본값 사용
                        },
                    },
                },
                orderBy: { employee: { name: 'asc' } },
            })

            // 기존 BankTransferBatch에서 계좌 정보 조회 (이전 이체 이력)
            const prevBatchItems = await prisma.bankTransferItem.findMany({
                where: {
                    batch: { payrollRunId: runId },
                },
                orderBy: { createdAt: 'desc' },
            })
            const bankInfoMap = new Map(
                prevBatchItems.map((bi) => [bi.employeeId, {
                    bankCode: bi.bankCode,
                    accountNumber: bi.accountNumber,
                }]),
            )

            // BankTransferBatch 생성 또는 upsert
            const totalNet = items.reduce((s, i) => s + Number(i.netPay), 0)
            const batch = await prisma.bankTransferBatch.create({
                data: {
                    companyId: user.companyId,
                    payrollRunId: runId,
                    bankCode: 'MULTI',  // 다중 은행
                    bankName: '급여이체',
                    format: 'CSV',
                    status: 'DRAFT',
                    totalAmount: totalNet,
                    totalCount: items.length,
                    createdBy: user.employeeId,
                    note: TRANSFER_NOTE_FORMAT(run.yearMonth),
                    items: {
                        create: items.map((item) => {
                            const info = bankInfoMap.get(item.employeeId)
                            return {
                                employeeId: item.employeeId,
                                employeeName: item.employee.name,
                                employeeNo: item.employee.employeeNo ?? '',
                                bankCode: info?.bankCode ?? '004',    // Settings-connected: default bank code (KB: 004)
                                accountNumber: info?.accountNumber ?? '000-000-000000',
                                accountHolder: item.employee.name,
                                amount: item.netPay,
                                status: 'PENDING',
                            }
                        }),
                    },
                },
                include: { items: true },
            })

            // CSV 생성 (BOM + 헤더 + 데이터)
            const BOM = '\uFEFF'
            const header = '성명,은행코드,계좌번호,이체금액,비고'
            const rows = batch.items.map((bi) => {
                const cols = [
                    `"${bi.employeeName}"`,
                    bi.bankCode,
                    bi.accountNumber,
                    Math.round(Number(bi.amount)).toString(),
                    `"${TRANSFER_NOTE_FORMAT(run.yearMonth)}"`,
                ]
                return cols.join(',')
            })
            const csv = BOM + [header, ...rows].join('\r\n')

            // 감사 로그 (계좌정보 포함 파일이므로 반드시 기록)
            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'PAYROLL_TRANSFER_CSV_DOWNLOAD',
                resourceType: 'PayrollRun',
                resourceId: runId,
                companyId: run.companyId,
                changes: {
                    yearMonth: run.yearMonth,
                    totalCount: items.length,
                    totalAmount: totalNet,
                    batchId: batch.id,
                },
                ip,
                userAgent,
            })

            const [yr, mn] = run.yearMonth.split('-')
            const filename = `${yr}년${mn}월_급여이체파일.csv`

            return new NextResponse(csv, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
                },
            })
        } catch (err) {
            return apiError(err)
        }
    },
    perm(MODULE.PAYROLL, ACTION.VIEW),
), RATE_LIMITS.EXPORT)
