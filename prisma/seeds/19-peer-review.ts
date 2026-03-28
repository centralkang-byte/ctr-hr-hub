// ================================================================
// CTR HR Hub — Seed Data: GP#4 Session C — Peer Review
// prisma/seeds/19-peer-review.ts
//
// Creates:
//   10 PeerReviewNomination records (5 employees × 2 reviewers)
//   8 PeerReviewAnswer records (2 still pending)
// ================================================================

import { NominationSource, NominationStatus, PrismaClient } from '../../src/generated/prisma/client'

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

function sr(seed: number): number {
    const x = Math.sin(seed * 9301 + 49297) * 233280
    return x - Math.floor(x)
}

// 5 target employees and 10 unique reviewers
const NOMINATIONS: Array<{
    empNo: string
    reviewers: string[]
}> = [
        { empNo: 'CTR-KR-3001', reviewers: ['CTR-KR-3002', 'CTR-KR-3003'] },
        { empNo: 'CTR-KR-3006', reviewers: ['CTR-KR-3007', 'CTR-KR-3008'] },
        { empNo: 'CTR-KR-3010', reviewers: ['CTR-KR-3011', 'CTR-KR-3012'] },
        { empNo: 'CTR-KR-3017', reviewers: ['CTR-KR-3018', 'CTR-KR-3019'] },
        { empNo: 'CTR-KR-3029', reviewers: ['CTR-KR-3030', 'CTR-KR-3031'] },
    ]

const OVERALL_COMMENTS = [
    '동료로서 항상 신뢰할 수 있는 팀원입니다. 업무 효율이 높고 소통이 원활합니다.',
    '도전하는 자세가 인상적이었습니다. 새로운 방법론을 적극 도입하여 팀에 기여했습니다.',
    '책임감이 강하고 맡은 업무를 꼼꼼히 마무리합니다. 다만 커뮤니케이션 빈도를 높이면 좋겠습니다.',
    '존중하는 태도로 팀 분위기를 좋게 만드는 분입니다. 업무 전문성도 우수합니다.',
    '프로젝트 기간 동안 많은 도움을 주셨습니다. 특히 기술적 멘토링이 유익했습니다.',
    '팀 내 갈등 상황에서 중재 역할을 잘 해주셨습니다. 의견 조율 능력이 뛰어납니다.',
    '야근이나 주말 근무에도 자발적으로 참여하며 팀 목표 달성에 헌신했습니다.',
    '비즈니스 관점에서의 판단력이 우수하고, 실행력도 높습니다.',
]

export async function seedGP4PeerReview(prisma: PrismaClient): Promise<void> {
    console.log('\n👥 Session C: Seeding peer review nominations and answers...\n')

    // Find the 2025-H2 cycle (which has evaluations completed = CLOSED)
    const cycle2025H2Id = deterministicUUID('cycle', 'CTR-KR:2025:H2')

    const cycle = await prisma.performanceCycle.findFirst({ where: { id: cycle2025H2Id } })
    if (!cycle) {
        console.log('  ⚠️ 2025-H2 cycle not found, skipping peer review seed')
        return
    }

    const hrManager = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0002' } })
    if (!hrManager) {
        console.log('  ⚠️ HR manager not found, skipping peer review seed')
        return
    }

    let nominationCount = 0
    let answerCount = 0

    for (let ni = 0; ni < NOMINATIONS.length; ni++) {
        const nom = NOMINATIONS[ni]

        const employee = await prisma.employee.findFirst({ where: { employeeNo: nom.empNo } })
        if (!employee) continue

        for (let ri = 0; ri < nom.reviewers.length; ri++) {
            const reviewer = await prisma.employee.findFirst({ where: { employeeNo: nom.reviewers[ri] } })
            if (!reviewer) continue

            const nomId = deterministicUUID('peer-nom', `2025H2:${nom.empNo}:${nom.reviewers[ri]}`)

            // Create nomination
            const existing = await prisma.peerReviewNomination.findFirst({ where: { id: nomId } })
            if (!existing) {
                // 8 of 10 are completed, 2 are pending (last employee's reviewers)
                const isCompleted = ni < 4  // first 4 employees completed
                const isPending = ni === 4  // last employee pending

                await prisma.peerReviewNomination.create({
                    data: {
                        id: nomId,
                        cycleId: cycle2025H2Id,
                        employeeId: employee.id,
                        nomineeId: reviewer.id,
                        nominationSource: 'MANAGER_ASSIGNED' as NominationSource,
                        status: (isPending ? 'NOMINATION_APPROVED' : 'NOMINATION_COMPLETED') as NominationStatus,
                        approvedById: hrManager.id,
                        approvedAt: new Date('2025-12-05'),
                    },
                })
                nominationCount++

                // Create answer for completed nominations (8 out of 10)
                if (isCompleted) {
                    const seed = ni * 100 + ri * 37
                    const answerId = deterministicUUID('peer-ans', `2025H2:${nom.empNo}:${nom.reviewers[ri]}`)

                    const existingAns = await prisma.peerReviewAnswer.findFirst({ where: { id: answerId } })
                    if (!existingAns) {
                        await prisma.peerReviewAnswer.create({
                            data: {
                                id: answerId,
                                nominationId: nomId,
                                scoreChallenge: Math.round(2.5 + sr(seed + 1) * 2.5),
                                scoreTrust: Math.round(2.5 + sr(seed + 2) * 2.5),
                                scoreResponsibility: Math.round(2.5 + sr(seed + 3) * 2.5),
                                scoreRespect: Math.round(2.5 + sr(seed + 4) * 2.5),
                                overallComment: OVERALL_COMMENTS[(ni * 2 + ri) % OVERALL_COMMENTS.length],
                                submittedAt: new Date(`2025-12-${10 + ni * 2 + ri}`),
                            },
                        })
                        answerCount++
                    }
                }
            }
        }
    }

    console.log(`  ✅ ${nominationCount} peer review nominations created`)
    console.log(`  ✅ ${answerCount} peer review answers created (2 pending)`)
    console.log('')
}
