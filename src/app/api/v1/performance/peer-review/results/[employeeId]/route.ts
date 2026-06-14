// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Peer Review Results
// GET /api/v1/performance/peer-review/results/:employeeId
//
// Semi-anonymous: Manager sees names, Employee sees "평가자 1/2/3"
// GEMINI FIX #1: Employee cannot see partial results during EVAL_OPEN
// GEMINI FIX #3: Deterministic shuffle prevents reviewer identification
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { determineViewerRole, maskPeerReviews, isResultPublishedForRole } from '@/lib/performance/data-masking'
import { isDirectManager } from '@/lib/auth/manager-check'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

const querySchema = z.object({
    cycleId: z.string().uuid(),
})

// ─── GET /api/v1/performance/peer-review/results/:employeeId

export const GET = withPermission(
    async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { employeeId } = await context.params
        const params = Object.fromEntries(req.nextUrl.searchParams.entries())
        const parsed = querySchema.safeParse(params)
        if (!parsed.success) {
            throw badRequest('cycleId 파라미터가 필요합니다.', { issues: parsed.error.issues })
        }

        const { cycleId } = parsed.data

        try {
            const cycle = await prisma.performanceCycle.findFirst({
                where: { id: cycleId, companyId: user.companyId },
                select: { id: true, status: true, companyId: true },
            })

            if (!cycle) throw badRequest('사이클을 찾을 수 없습니다.')

            // 현재 담당 매니저 판정 — 전임 매니저 영구 권한 결함 차단.
            // 과거 1:1 기록 1건 존재만으로 MANAGER 뷰어가 되던 문제(cycle·현재관계·상태 조건 부재)를
            // "현재 담당" 2-경로(OR)로 한정한다:
            //   (1) 활성 보고라인 — Position.reportsToPositionId(endDate:null) 기준 직속 매니저.
            //       isDirectManager는 offboarding 격리와 동일한 manager-of-record SSOT.
            //   (2) 해당 cycle 스코프 CFR — 이번 평가 주기에 연결된 1:1(OneOnOne.cycleId === cycleId).
            //       OneOnOne엔 endDate/active 개념이 없어 cycleId로 시간 범위를 한정(과거 주기·무관 주기 1:1 불인정).
            // 둘 다 불충족인 전임 매니저는 EMPLOYEE fallback → 아래 IDOR 게이트에서 403.
            // HR_ADMIN/EXECUTIVE/SUPER_ADMIN은 determineViewerRole로 우회(피플세션·캘리브레이션 감독 경로 보존).
            const [isReportingLineManager, cycleScopedCfrCount] = await Promise.all([
                isDirectManager(user.employeeId, employeeId),
                prisma.oneOnOne.count({
                    where: { managerId: user.employeeId, employeeId, cycleId },
                }),
            ])
            const isManager = isReportingLineManager || cycleScopedCfrCount > 0

            const viewerRole = determineViewerRole(
                user.employeeId,
                employeeId,
                user.role,
                isManager,
            )

            // 권한 게이트(IDOR 방지) — 본인·담당 매니저·HR/임원만 조회 가능.
            // determineViewerRole은 무관한 직원에게도 fallback 'EMPLOYEE'를 부여하므로(타인 익명 동료점수 열람 가능),
            // viewerRole==='EMPLOYEE'면 본인 여부를 명시 확인해 타 직원 조회를 차단한다.
            if (viewerRole === 'EMPLOYEE' && user.employeeId !== employeeId) {
                throw forbidden('본인 또는 담당자만 조회할 수 있습니다.')
            }

            // GEMINI FIX #1: Anti-Deduction Attack prevention
            // Employee cannot see partial results during EVAL_OPEN
            const totalNominations = await prisma.peerReviewNomination.count({
                where: {
                    cycleId, employeeId,
                    status: { in: ['NOMINATION_APPROVED', 'NOMINATION_COMPLETED'] },
                    nominee: { deletedAt: null },
                },
            })
            const completedNominations = await prisma.peerReviewNomination.count({
                where: {
                    cycleId, employeeId,
                    status: 'NOMINATION_COMPLETED',
                    nominee: { deletedAt: null },
                },
            })

            if (
                viewerRole === 'EMPLOYEE' &&
                cycle.status === 'EVAL_OPEN' &&
                completedNominations < totalNominations
            ) {
                throw badRequest('동료 평가가 진행 중입니다. 모든 평가 완료 후 확인하실 수 있습니다.')
            }

            // 결과 공개 게이트 — 본인(EMPLOYEE) 동료평가 결과는 등급 publication과 동일하게
            // 결과 통보(CLOSED) 이후에만 노출. CALIBRATION/COMP_REVIEW 등 미공개 단계에서
            // 직접 API 호출로 동료 점수가 새지 않도록 차단 (클라 UI는 cycle 필터로 이미 차단).
            // 매니저/HR은 viewerRole로 구분돼 영향 없음 (피플세션·캘리브레이션 감독 경로 보존).
            if (viewerRole === 'EMPLOYEE' && !isResultPublishedForRole(cycle.status, 'EMPLOYEE')) {
                throw badRequest('성과 결과가 아직 공개되지 않았습니다.')
            }

            // Fetch answers
            const nominations = await prisma.peerReviewNomination.findMany({
                where: {
                    cycleId, employeeId,
                    status: 'NOMINATION_COMPLETED',
                    nominee: { deletedAt: null },
                },
                select: {
                    answer: {
                        select: {
                            scoreChallenge: true,
                            scoreTrust: true,
                            scoreResponsibility: true,
                            scoreRespect: true,
                            commentChallenge: true,
                            commentTrust: true,
                            commentResponsibility: true,
                            commentRespect: true,
                            overallComment: true,
                            submittedAt: true,
                        },
                    },
                    nominee: {
                        select: {
                            name: true,
                            nameEn: true,
                            assignments: {
                                where: { isPrimary: true, endDate: null },
                                take: 1,
                                select: { department: { select: { name: true } } },
                            },
                        },
                    },
                },
            })

            const rawReviews = nominations
                .filter((n) => n.answer)
                .map((n) => ({
                    reviewerName: n.nominee.name,
                    reviewerDepartment: extractPrimaryAssignment(n.nominee.assignments)?.department?.name ?? '',
                    scoreChallenge: n.answer!.scoreChallenge,
                    scoreTrust: n.answer!.scoreTrust,
                    scoreResponsibility: n.answer!.scoreResponsibility,
                    scoreRespect: n.answer!.scoreRespect,
                    overallComment: n.answer!.overallComment,
                    submittedAt: n.answer!.submittedAt,
                }))

            // Calculate summary
            const count = rawReviews.length
            const summary = {
                averageChallenge: count > 0 ? rawReviews.reduce((s, r) => s + r.scoreChallenge, 0) / count : 0,
                averageTrust: count > 0 ? rawReviews.reduce((s, r) => s + r.scoreTrust, 0) / count : 0,
                averageResponsibility: count > 0 ? rawReviews.reduce((s, r) => s + r.scoreResponsibility, 0) / count : 0,
                averageRespect: count > 0 ? rawReviews.reduce((s, r) => s + r.scoreRespect, 0) / count : 0,
                overallAverage: 0,
                totalReviewers: totalNominations,
                completedReviewers: completedNominations,
            }
            summary.overallAverage = (summary.averageChallenge + summary.averageTrust +
                summary.averageResponsibility + summary.averageRespect) / 4

            // Round to 1 decimal
            summary.averageChallenge = Math.round(summary.averageChallenge * 10) / 10
            summary.averageTrust = Math.round(summary.averageTrust * 10) / 10
            summary.averageResponsibility = Math.round(summary.averageResponsibility * 10) / 10
            summary.averageRespect = Math.round(summary.averageRespect * 10) / 10
            summary.overallAverage = Math.round(summary.overallAverage * 10) / 10

            // Apply data masking (GEMINI FIX #3: deterministic shuffle for employee)
            const maskedReviews = maskPeerReviews(rawReviews, viewerRole, cycleId, employeeId)

            return apiSuccess({ summary, reviews: maskedReviews })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
