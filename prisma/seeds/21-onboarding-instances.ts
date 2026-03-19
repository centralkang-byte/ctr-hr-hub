// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Seed: Active Onboarding Instances
// prisma/seeds/21-onboarding-instances.ts
//
// E-1: GP#2 Onboarding Pipeline
// Creates 4-5 active onboarding instances with tasks + checkins
// ═══════════════════════════════════════════════════════════

import type { PrismaClient } from '../../src/generated/prisma/client'
import { randomUUID } from 'crypto'

export async function seedOnboardingInstances(prisma: PrismaClient) {
    console.log('🟢 Seeding onboarding instances...')

    // ── Find required references ────────────────────────────

    const template = await prisma.onboardingTemplate.findFirst({
        where: { planType: 'ONBOARDING', isActive: true },
        include: { onboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!template) {
        console.warn('⚠️ No active onboarding template found. Skipping onboarding instance seeding.')
        return
    }

    const ctrKr = await prisma.company.findFirst({ where: { code: 'CTR' } })
    const ctrUs = await prisma.company.findFirst({ where: { code: 'CTR-US' } })
    const ctrVn = await prisma.company.findFirst({ where: { code: 'CTR-VN' } })

    if (!ctrKr) {
        console.warn('⚠️ CTR-KR company not found. Skipping.')
        return
    }

    // Find employees without existing onboarding records
    const existingOnboardings = await prisma.employeeOnboarding.findMany({
        select: { employeeId: true },
    })
    const existingIds = new Set(existingOnboardings.map((o) => o.employeeId))

    const candidates = await prisma.employee.findMany({
        where: {
            id: { notIn: Array.from(existingIds) },
            deletedAt: null,
        },
        include: {
            assignments: {
                where: { isPrimary: true, endDate: null },
                select: { companyId: true },
                take: 1,
            },
        },
        take: 10,
        orderBy: { hireDate: 'desc' },
    })

    if (candidates.length < 4) {
        console.warn(`⚠️ Only ${candidates.length} employees available for onboarding seeding. Need at least 4.`)
        return
    }

    // Find an HR admin for sign-off
    const hrAdminRole = await prisma.employeeRole.findFirst({
        where: { role: { code: 'HR_ADMIN' }, endDate: null },
        select: { employeeId: true },
    })

    const now = new Date()

    // ── Helper: create instance + tasks ─────────────────────

    async function createInstance(
        employee: typeof candidates[0],
        companyId: string,
        daysAgo: number,
        taskStatusOverrides: Record<number, { status: string; blockedReason?: string; blockedAt?: Date }>,
        onboardingStatus: string,
        signOff?: { by: string; at: Date; note: string },
    ) {
        const hireDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
        const onboardingId = randomUUID()

        // Create onboarding instance
        await prisma.employeeOnboarding.create({
            data: {
                id: onboardingId,
                employeeId: employee.id,
                templateId: template!.id,
                companyId,
                planType: 'ONBOARDING',
                status: onboardingStatus as 'IN_PROGRESS' | 'COMPLETED' | 'NOT_STARTED',
                startedAt: hireDate,
                completedAt: signOff ? signOff.at : null,
                signOffBy: signOff?.by ?? null,
                signOffAt: signOff?.at ?? null,
                signOffNote: signOff?.note ?? null,
            },
        })

        // Create tasks individually
        for (let index = 0; index < template!.onboardingTasks.length; index++) {
            const task = template!.onboardingTasks[index]
            const override = taskStatusOverrides[index]
            const dueDate = new Date(hireDate.getTime() + task.dueDaysAfter * 24 * 60 * 60 * 1000)

            await prisma.employeeOnboardingTask.create({
                data: {
                    id: randomUUID(),
                    employeeOnboardingId: onboardingId,
                    taskId: task.id,
                    status: (override?.status ?? 'PENDING') as 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'SKIPPED',
                    dueDate,
                    blockedReason: override?.blockedReason ?? null,
                    blockedAt: override?.blockedAt ?? null,
                },
            })
        }

        return { onboardingId, hireDate }
    }

    // ── Instance 1: Day 3 (just started) ────────────────────
    const emp1 = candidates[0]
    const overrides1: Record<number, { status: string }> = {}
    for (let i = 0; i < Math.min(4, template.onboardingTasks.length); i++) {
        overrides1[i] = { status: 'DONE' }
    }
    const inst1 = await createInstance(emp1, ctrKr.id, 3, overrides1, 'IN_PROGRESS')
    console.log(`  ✅ Instance 1: ${emp1.name} (Day 3, 4 tasks done)`)

    // ── Instance 2: Day 35 (mid-onboarding, 1 blocked) ──────
    const emp2 = candidates[1]
    const overrides2: Record<number, { status: string; blockedReason?: string; blockedAt?: Date }> = {}
    const totalTasks = template.onboardingTasks.length
    for (let i = 0; i < Math.min(10, totalTasks); i++) {
        overrides2[i] = { status: 'DONE' }
    }
    if (totalTasks > 10) {
        overrides2[10] = { status: 'BLOCKED', blockedReason: 'IT 장비 수급 지연', blockedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) }
    }
    const inst2 = await createInstance(emp2, ctrUs?.id ?? ctrKr.id, 35, overrides2, 'IN_PROGRESS')
    console.log(`  ✅ Instance 2: ${emp2.name} (Day 35, 10 done, 1 blocked)`)

    // ── Instance 3: Day 85 (near sign-off) ──────────────────
    const emp3 = candidates[2]
    const overrides3: Record<number, { status: string }> = {}
    for (let i = 0; i < totalTasks - 1; i++) {
        overrides3[i] = { status: 'DONE' }
    }
    const inst3 = await createInstance(emp3, ctrKr.id, 85, overrides3, 'IN_PROGRESS')
    console.log(`  ✅ Instance 3: ${emp3.name} (Day 85, sign-off pending)`)

    // ── Instance 4: Transfer (Day 10) ───────────────────────
    const emp4 = candidates[3]
    const overrides4: Record<number, { status: string }> = {}
    for (let i = 0; i < Math.min(5, totalTasks); i++) {
        overrides4[i] = { status: 'DONE' }
    }
    const inst4 = await createInstance(emp4, ctrKr.id, 10, overrides4, 'IN_PROGRESS')
    console.log(`  ✅ Instance 4: ${emp4.name} (Day 10, transfer)`)

    // ── Instance 5: Completed (Day 92, signed off) ──────────
    if (candidates.length >= 5) {
        const emp5 = candidates[4]
        const overrides5: Record<number, { status: string }> = {}
        for (let i = 0; i < totalTasks; i++) {
            overrides5[i] = { status: 'DONE' }
        }
        const signOffDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
        await createInstance(emp5, ctrVn?.id ?? ctrKr.id, 92, overrides5, 'COMPLETED', {
            by: hrAdminRole?.employeeId ?? emp5.id,
            at: signOffDate,
            note: '온보딩 정상 완료. 적응 원활.',
        })
        console.log(`  ✅ Instance 5: ${emp5.name} (Completed, signed off)`)
    }

    // ── Emotion Checkins ────────────────────────────────────

    const checkinData: Array<{
        onboardingId: string
        employeeId: string
        companyId: string
        hireDate: Date
        milestone: string
        checkinWeek: number
        mood: string
        energy: number
        belonging: number
        daysAfterHire: number
    }> = [
            { onboardingId: inst1.onboardingId, employeeId: emp1.id, companyId: ctrKr.id, hireDate: inst1.hireDate, milestone: 'DAY_7', checkinWeek: 1, mood: 'GREAT', energy: 3, belonging: 3, daysAfterHire: 7 },
            { onboardingId: inst2.onboardingId, employeeId: emp2.id, companyId: ctrUs?.id ?? ctrKr.id, hireDate: inst2.hireDate, milestone: 'DAY_7', checkinWeek: 1, mood: 'NEUTRAL', energy: 3, belonging: 4, daysAfterHire: 7 },
            { onboardingId: inst2.onboardingId, employeeId: emp2.id, companyId: ctrUs?.id ?? ctrKr.id, hireDate: inst2.hireDate, milestone: 'DAY_30', checkinWeek: 4, mood: 'NEUTRAL', energy: 2, belonging: 3, daysAfterHire: 30 },
            { onboardingId: inst3.onboardingId, employeeId: emp3.id, companyId: ctrKr.id, hireDate: inst3.hireDate, milestone: 'DAY_7', checkinWeek: 1, mood: 'GREAT', energy: 4, belonging: 4, daysAfterHire: 7 },
            { onboardingId: inst3.onboardingId, employeeId: emp3.id, companyId: ctrKr.id, hireDate: inst3.hireDate, milestone: 'DAY_30', checkinWeek: 4, mood: 'NEUTRAL', energy: 3, belonging: 3, daysAfterHire: 30 },
            { onboardingId: inst3.onboardingId, employeeId: emp3.id, companyId: ctrKr.id, hireDate: inst3.hireDate, milestone: 'DAY_90', checkinWeek: 13, mood: 'GREAT', energy: 4, belonging: 4, daysAfterHire: 85 },
            { onboardingId: inst4.onboardingId, employeeId: emp4.id, companyId: ctrKr.id, hireDate: inst4.hireDate, milestone: 'DAY_7', checkinWeek: 1, mood: 'NEUTRAL', energy: 3, belonging: 2, daysAfterHire: 7 },
        ]

    for (const c of checkinData) {
        await prisma.onboardingCheckin.create({
            data: {
                id: randomUUID(),
                employeeId: c.employeeId,
                companyId: c.companyId,
                onboardingId: c.onboardingId,
                checkinWeek: c.checkinWeek,
                milestone: c.milestone as 'DAY_1' | 'DAY_7' | 'DAY_30' | 'DAY_90',
                mood: c.mood as 'GREAT' | 'GOOD' | 'NEUTRAL' | 'STRUGGLING' | 'BAD',
                energy: c.energy,
                belonging: c.belonging,
                submittedAt: new Date(c.hireDate.getTime() + c.daysAfterHire * 24 * 60 * 60 * 1000),
            },
        })
    }

    console.log(`  ✅ ${checkinData.length} emotion checkins created`)
    console.log('🟢 Onboarding instances seeded successfully!')
}
