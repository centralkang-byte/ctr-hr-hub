// ================================================================
// CTR HR Hub — Seed Data: Session B.3 — Peer Review Nominations
// prisma/seeds/15-peer-review.ts
//
// Creates:
//   ~20 PeerReviewNomination records for 2025-H2 cycle
// ================================================================

import { PrismaClient, NominationSource, NominationStatus } from '../../src/generated/prisma/client'

function deterministicUUID(ns: string, key: string): string {
    const str = `${ns}:${key}`
    let h = 0
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0 }
    const hex = Math.abs(h).toString(16).padStart(8, '0')
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(0, 3)}-${hex.padEnd(12, '0').slice(0, 12)}`
}

function sr(seed: number): number {
    const x = Math.sin(seed * 9301 + 49297) * 233280
    return x - Math.floor(x)
}

// ────────────────────────────────────────────────────────────
export async function seedPeerReview(prisma: PrismaClient): Promise<void> {
    console.log('\n👥 Session B.3: Seeding peer review nominations...\n')

    const krCo = await prisma.company.findFirst({ where: { code: 'CTR' } })
    if (!krCo) { console.error('  ❌ CTR-KR not found'); return }
    const krId = krCo.id

    // Find 2025-H2 cycle (CLOSED)
    const cycle = await prisma.performanceCycle.findFirst({
        where: { companyId: krId, year: 2025, half: 'H2' },
        orderBy: { createdAt: 'desc' },
    })
    if (!cycle) {
        console.log('  ⚠ No 2025-H2 performance cycle found, skipping peer review')
        return
    }
    const cycleId = cycle.id
    console.log(`  ✅ Using cycle: ${cycle.name} (${cycleId})`)

    // HR approver
    const hrEmp = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0001' } })
    const hrId = hrEmp?.id

    // Get active KR employees for nominations
    // Need at least 12 employees to create 10 nominators × 2 nominees
    const assignments = await prisma.employeeAssignment.findMany({
        where: { companyId: krId, isPrimary: true, endDate: null, status: { not: 'TERMINATED' } },
        select: { employeeId: true },
        take: 20,
    })

    if (assignments.length < 4) {
        console.log('  ⚠ Not enough employees for peer review nominations')
        return
    }

    const empIds = assignments.map(a => a.employeeId)

    // Nomination source distribution
    const SOURCES: NominationSource[] = ['AI_RECOMMENDED', 'AI_RECOMMENDED', 'MANAGER_ASSIGNED', 'MANAGER_ASSIGNED', 'SELF_NOMINATED']
    // Status distribution: COMPLETED 60%, NOMINATION_APPROVED 20%, PROPOSED 20%
    const STATUSES: NominationStatus[] = [
        'NOMINATION_COMPLETED', 'NOMINATION_COMPLETED', 'NOMINATION_COMPLETED',
        'NOMINATION_APPROVED', 'PROPOSED',
    ]

    let nomCount = 0

    // Create ~20 nominations: 10 employees × 2 nominations each
    const nominatorCount = Math.min(10, Math.floor(empIds.length / 2))

    for (let i = 0; i < nominatorCount; i++) {
        const employeeId = empIds[i]

        for (let ni = 0; ni < 2; ni++) {
            // Pick a nominee that is NOT the employee (offset by nominatorCount)
            const nomineeIdx = (i + nominatorCount + ni + 1) % empIds.length
            const nomineeId = empIds[nomineeIdx]

            if (nomineeId === employeeId) continue

            const source = SOURCES[(i + ni) % SOURCES.length]
            const status = STATUSES[(i * 2 + ni) % STATUSES.length]
            const isCompleted = status === 'NOMINATION_COMPLETED'
            const isApproved = isCompleted || status === 'NOMINATION_APPROVED'

            // Collaboration score for completed nominations (3.0~5.0)
            const collabScore = isCompleted
                ? Math.round((3.0 + sr(i * 17 + ni * 7) * 2.0) * 10) / 10
                : null

            const nomId = deterministicUUID('peernom', `${cycleId}:${employeeId}:${nomineeId}`)

            // Check for existing (cycle+employee+nominee must be unique per schema)
            const existing = await prisma.peerReviewNomination.findFirst({
                where: { cycleId, employeeId, nomineeId },
            })
            if (existing) continue

            await prisma.peerReviewNomination.create({
                data: {
                    id: nomId,
                    cycleId,
                    employeeId,
                    nomineeId,
                    nominationSource: source,
                    collaborationTotalScore: collabScore,
                    status,
                    approvedById: isApproved ? hrId : null,
                    approvedAt: isApproved ? new Date('2025-12-15') : null,
                },
            })
            nomCount++
        }
    }

    const totalNoms = await prisma.peerReviewNomination.count()

    console.log('\n======================================')
    console.log('👥 Peer Review Seed Complete!')
    console.log('======================================')
    console.log(`  PeerReviewNominations: ${totalNoms} (new: ${nomCount})`)
    console.log('======================================\n')
}
