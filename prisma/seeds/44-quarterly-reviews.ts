// ================================================================
// CTR HR Hub — Phase B: QuarterlyReview Seed Data
// prisma/seeds/44-quarterly-reviews.ts
//
// Creates sample quarterly reviews for QA accounts:
//   - 2026 Q1: COMPLETED (직원+매니저 모두 제출)
//   - 2026 Q2: IN_PROGRESS (직원만 제출, 매니저 미제출)
//
// QA 계정: employee-a, employee-b → manager@ctr.co.kr
//          employee-c → manager2@ctr.co.kr
//
// Idempotent: uses upsert. Safe to re-run.
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

function deterministicUUID(namespace: string, key: string): string {
    const str = `${namespace}:${key}`
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + chr
        hash |= 0
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0')
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(0, 3)}-${hex.padEnd(12, '0').slice(0, 12)}`
}

interface QRSeed {
    employeeEmail: string
    managerEmail: string
    year: number
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
    status: 'DRAFT' | 'IN_PROGRESS' | 'EMPLOYEE_DONE' | 'MANAGER_DONE' | 'COMPLETED'
    employeeSections?: {
        goalHighlights: string
        challenges: string
        developmentNeeds: string
        employeeComments: string
    }
    managerSections?: {
        managerFeedback: string
        coachingNotes: string
        developmentPlan: string
        overallSentiment: 'POSITIVE' | 'NEUTRAL' | 'CONCERN'
    }
}

const SEED_DATA: QRSeed[] = [
    // ── 2026 Q1: COMPLETED ──
    {
        employeeEmail: 'employee-a@ctr.co.kr',
        managerEmail: 'manager@ctr.co.kr',
        year: 2026,
        quarter: 'Q1',
        status: 'COMPLETED',
        employeeSections: {
            goalHighlights: 'ERP 마이그레이션 1차 완료. 데이터 정합성 99.7% 달성.',
            challenges: '레거시 시스템 API 문서 부재로 리버스 엔지니어링에 시간 소요.',
            developmentNeeds: 'MSA 아키텍처 설계 역량 강화 희망.',
            employeeComments: '다음 분기에는 성능 최적화에 집중하고 싶습니다.',
        },
        managerSections: {
            managerFeedback: '1분기 핵심 과제인 ERP 마이그레이션을 성공적으로 완수. 기술적 리더십 우수.',
            coachingNotes: '팀원 코드 리뷰 참여를 높여주세요. 기술 전파 역할 기대.',
            developmentPlan: 'Q2에 사내 MSA 스터디 그룹 리드 역할 부여 예정.',
            overallSentiment: 'POSITIVE',
        },
    },
    {
        employeeEmail: 'employee-b@ctr.co.kr',
        managerEmail: 'manager@ctr.co.kr',
        year: 2026,
        quarter: 'Q1',
        status: 'COMPLETED',
        employeeSections: {
            goalHighlights: '채용 프로세스 자동화 완료. 지원서 처리 시간 40% 단축.',
            challenges: '외부 채용 플랫폼 API 변경으로 연동 재작업 필요.',
            developmentNeeds: '프로젝트 매니지먼트 역량 향상 희망.',
            employeeComments: '팀 내 소통이 원활해서 협업이 수월했습니다.',
        },
        managerSections: {
            managerFeedback: '자동화 과제 목표치 초과 달성. 주도적 문제 해결 역량 인상적.',
            coachingNotes: '문서화 습관을 더 강화하면 좋겠습니다. 인수인계 시 큰 도움.',
            developmentPlan: 'PMP 자격증 취득 지원 논의 예정.',
            overallSentiment: 'POSITIVE',
        },
    },
    {
        employeeEmail: 'employee-c@ctr.co.kr',
        managerEmail: 'manager2@ctr.co.kr',
        year: 2026,
        quarter: 'Q1',
        status: 'COMPLETED',
        employeeSections: {
            goalHighlights: '고객 응대 매뉴얼 개정 완료. CS 응답 시간 20% 개선.',
            challenges: '다국어 매뉴얼 번역 품질 관리가 어려웠습니다.',
            developmentNeeds: '데이터 분석 역량 (SQL, 대시보드 구축)',
            employeeComments: '해외 법인과의 협업 경험이 유익했습니다.',
        },
        managerSections: {
            managerFeedback: 'CS 매뉴얼 프로젝트 기한 내 완료. 다국어 대응 노력 우수.',
            coachingNotes: '데이터 기반 의사결정 역량을 키워보세요. SQL 교육 추천.',
            developmentPlan: 'Q2에 사내 SQL 부트캠프 수강 예정.',
            overallSentiment: 'NEUTRAL',
        },
    },
    // ── 2026 Q2: IN_PROGRESS (다양한 상태) ──
    {
        employeeEmail: 'employee-a@ctr.co.kr',
        managerEmail: 'manager@ctr.co.kr',
        year: 2026,
        quarter: 'Q2',
        status: 'EMPLOYEE_DONE',
        employeeSections: {
            goalHighlights: 'MSA 전환 설계 문서 초안 완성. API Gateway 선정 완료.',
            challenges: '기존 모놀리스와의 호환성 유지가 과제.',
            developmentNeeds: 'Kubernetes 운영 경험 필요.',
            employeeComments: '아키텍처 결정에 대한 팀 합의 과정이 좋았습니다.',
        },
    },
    {
        employeeEmail: 'employee-b@ctr.co.kr',
        managerEmail: 'manager@ctr.co.kr',
        year: 2026,
        quarter: 'Q2',
        status: 'DRAFT',
    },
    {
        employeeEmail: 'employee-c@ctr.co.kr',
        managerEmail: 'manager2@ctr.co.kr',
        year: 2026,
        quarter: 'Q2',
        status: 'MANAGER_DONE',
        managerSections: {
            managerFeedback: 'SQL 교육 성과가 눈에 띕니다. 간단한 대시보드 구축 시작.',
            coachingNotes: '분석 결과를 팀에 공유하는 습관을 들이면 좋겠습니다.',
            developmentPlan: '하반기 데이터 분석 프로젝트 리드 역할 검토.',
            overallSentiment: 'POSITIVE',
        },
    },
]

export async function seedQuarterlyReviews(prisma: PrismaClient) {
    console.log('\n📋 Phase B: Seeding quarterly reviews...\n')

    const ctrCompany = await prisma.company.findFirst({ where: { code: 'CTR' } })
    if (!ctrCompany) {
        console.log('  ⚠️  CTR company not found, skipping quarterly review seed')
        return
    }

    // Find QA employees and managers
    const emailToEmployee = new Map<string, { id: string; employeeNo: string }>()
    const qaEmails = [
        'employee-a@ctr.co.kr', 'employee-b@ctr.co.kr', 'employee-c@ctr.co.kr',
        'manager@ctr.co.kr', 'manager2@ctr.co.kr',
    ]

    for (const email of qaEmails) {
        const user = await prisma.user.findFirst({
            where: { email },
            select: { employee: { select: { id: true, employeeNo: true } } },
        })
        if (user?.employee) {
            emailToEmployee.set(email, user.employee)
        }
    }

    if (emailToEmployee.size < 5) {
        console.log(`  ⚠️  Only ${emailToEmployee.size}/5 QA employees found, skipping`)
        return
    }

    // Find existing goals for snapshot
    const employeeIds = [...emailToEmployee.values()].map(e => e.id)
    const goals = await prisma.mboGoal.findMany({
        where: {
            employeeId: { in: employeeIds },
            status: { in: ['APPROVED', 'DRAFT', 'PENDING_APPROVAL'] },
        },
        select: { id: true, employeeId: true, title: true, weight: true, targetValue: true },
    })

    const goalsByEmployee = new Map<string, typeof goals>()
    for (const g of goals) {
        const arr = goalsByEmployee.get(g.employeeId) || []
        arr.push(g)
        goalsByEmployee.set(g.employeeId, arr)
    }

    // Find 2026-H1 cycle for optional linking
    const cycleId = deterministicUUID('cycle', 'CTR-KR:2026:H1')
    const cycle = await prisma.performanceCycle.findUnique({ where: { id: cycleId } })

    let created = 0
    let skipped = 0

    for (const seed of SEED_DATA) {
        const emp = emailToEmployee.get(seed.employeeEmail)
        const mgr = emailToEmployee.get(seed.managerEmail)
        if (!emp || !mgr) {
            console.log(`  ⚠️  Skip: ${seed.employeeEmail} or ${seed.managerEmail} not found`)
            skipped++
            continue
        }

        const reviewId = deterministicUUID('qr', `${seed.employeeEmail}:${seed.year}:${seed.quarter}`)

        const now = new Date()
        const employeeSubmittedAt = ['EMPLOYEE_DONE', 'COMPLETED'].includes(seed.status)
            ? new Date(seed.year, seed.quarter === 'Q1' ? 2 : 5, 15) // Q1→Mar 15, Q2→Jun 15
            : null
        const managerSubmittedAt = ['MANAGER_DONE', 'COMPLETED'].includes(seed.status)
            ? new Date(seed.year, seed.quarter === 'Q1' ? 2 : 5, 20) // Q1→Mar 20, Q2→Jun 20
            : null

        try {
            await prisma.quarterlyReview.upsert({
                where: {
                    employeeId_companyId_year_quarter: {
                        employeeId: emp.id,
                        companyId: ctrCompany.id,
                        year: seed.year,
                        quarter: seed.quarter,
                    },
                },
                update: {},
                create: {
                    id: reviewId,
                    companyId: ctrCompany.id,
                    employeeId: emp.id,
                    managerId: mgr.id,
                    year: seed.year,
                    quarter: seed.quarter,
                    cycleId: cycle?.id ?? null,
                    status: seed.status,
                    // Employee sections
                    goalHighlights: seed.employeeSections?.goalHighlights ?? null,
                    challenges: seed.employeeSections?.challenges ?? null,
                    developmentNeeds: seed.employeeSections?.developmentNeeds ?? null,
                    employeeComments: seed.employeeSections?.employeeComments ?? null,
                    employeeSubmittedAt,
                    // Manager sections
                    managerFeedback: seed.managerSections?.managerFeedback ?? null,
                    coachingNotes: seed.managerSections?.coachingNotes ?? null,
                    developmentPlan: seed.managerSections?.developmentPlan ?? null,
                    overallSentiment: seed.managerSections?.overallSentiment ?? null,
                    managerSubmittedAt,
                    // Action items
                    actionItems: seed.status === 'COMPLETED' ? [
                        { item: '다음 분기 목표 수립', assignee: 'EMPLOYEE', dueDate: `${seed.year}-${seed.quarter === 'Q1' ? '04' : '07'}-15`, completed: false },
                        { item: '역량 개발 계획 확정', assignee: 'MANAGER', dueDate: `${seed.year}-${seed.quarter === 'Q1' ? '04' : '07'}-10`, completed: false },
                    ] : null,
                },
            })

            // Create QuarterlyGoalProgress for this review
            const empGoals = goalsByEmployee.get(emp.id) || []
            for (const goal of empGoals) {
                const qgpId = deterministicUUID('qgp', `${reviewId}:${goal.id}`)
                try {
                    await prisma.quarterlyGoalProgress.upsert({
                        where: {
                            quarterlyReviewId_goalId: {
                                quarterlyReviewId: reviewId,
                                goalId: goal.id,
                            },
                        },
                        update: {},
                        create: {
                            id: qgpId,
                            quarterlyReviewId: reviewId,
                            goalId: goal.id,
                            snapshotTitle: goal.title,
                            snapshotWeight: Number(goal.weight) || 0,
                            snapshotTarget: goal.targetValue,
                            progressPct: seed.status === 'COMPLETED'
                                ? Math.floor(Math.random() * 40) + 50 // 50-90%
                                : Math.floor(Math.random() * 30) + 20, // 20-50%
                            employeeComment: seed.employeeSections ? '순조롭게 진행 중입니다.' : null,
                            managerComment: seed.managerSections ? '계획대로 진행되고 있습니다.' : null,
                            trackingStatus: seed.status === 'COMPLETED' ? 'ON_TRACK' : null,
                        },
                    })
                } catch {
                    // Skip duplicate or FK error
                }
            }

            created++
        } catch (err) {
            console.log(`  ⚠️  Error for ${seed.employeeEmail} ${seed.year}-${seed.quarter}:`, err)
            skipped++
        }
    }

    console.log(`  ✅ Quarterly reviews: ${created} created/updated, ${skipped} skipped`)
}
