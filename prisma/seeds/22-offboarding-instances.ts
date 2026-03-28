// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Seed: Offboarding Instances + Exit Interviews + Assets
// prisma/seeds/10-offboarding-instances.ts
//
// E-2: GP#2 Offboarding Pipeline
// Creates 3 active offboarding instances, 8 exit interviews, 3 asset returns
// ═══════════════════════════════════════════════════════════

import type { PrismaClient } from '../../src/generated/prisma/client'
import { randomUUID } from 'crypto'

export async function seedOffboardingInstances(prisma: PrismaClient) {
    console.log('🔴 Seeding offboarding instances...')

    // ── Find required references ────────────────────────────
    const ctrKr = await prisma.company.findFirst({ where: { code: 'CTR' } })
    const ctrUs = await prisma.company.findFirst({ where: { code: 'CTR-US' } })

    if (!ctrKr) {
        console.warn('⚠️ CTR-KR company not found. Skipping offboarding seed.')
        return
    }

    // Find active offboarding checklists — need VOLUNTARY and INVOLUNTARY
    const voluntaryChecklist = await prisma.offboardingChecklist.findFirst({
        where: { targetType: 'VOLUNTARY', isActive: true },
        include: { offboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    })

    const involuntaryChecklist = await prisma.offboardingChecklist.findFirst({
        where: { targetType: 'INVOLUNTARY', isActive: true },
        include: { offboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!voluntaryChecklist) {
        console.warn('⚠️ No active VOLUNTARY offboarding checklist found. Creating one...')
        // Create a minimal voluntary checklist
        const cl = await prisma.offboardingChecklist.create({
            data: {
                id: randomUUID(),
                companyId: ctrKr.id,
                name: '표준 자발적 퇴직 체크리스트',
                targetType: 'VOLUNTARY',
                isActive: true,
            },
        })
        const tasks = [
            { title: '인수인계 대상자 확정', assigneeType: 'MANAGER' as const, dueDaysBefore: 30, sortOrder: 1, isRequired: true },
            { title: '퇴직금 산출 시작', assigneeType: 'HR' as const, dueDaysBefore: 30, sortOrder: 2, isRequired: true },
            { title: '인수인계 문서 작성', assigneeType: 'EMPLOYEE' as const, dueDaysBefore: 25, sortOrder: 3, isRequired: true },
            { title: '장비 반납 안내', assigneeType: 'IT' as const, dueDaysBefore: 14, sortOrder: 4, isRequired: true },
            { title: '인수인계 진행 확인', assigneeType: 'MANAGER' as const, dueDaysBefore: 14, sortOrder: 5, isRequired: true },
            { title: '미사용 연차 정산', assigneeType: 'HR' as const, dueDaysBefore: 14, sortOrder: 6, isRequired: true },
            { title: 'M365 비활성화 예약', assigneeType: 'IT' as const, dueDaysBefore: 7, sortOrder: 7, isRequired: false },
            { title: '퇴직 면담 일정 확정', assigneeType: 'HR' as const, dueDaysBefore: 7, sortOrder: 8, isRequired: true },
            { title: '최종 급여 정산 준비', assigneeType: 'FINANCE' as const, dueDaysBefore: 7, sortOrder: 9, isRequired: true },
            { title: '퇴직 면담 실시', assigneeType: 'HR' as const, dueDaysBefore: 3, sortOrder: 10, isRequired: true },
            { title: '사원증+장비 반납', assigneeType: 'EMPLOYEE' as const, dueDaysBefore: 1, sortOrder: 11, isRequired: true },
            { title: '퇴직 처리 완료', assigneeType: 'HR' as const, dueDaysBefore: 0, sortOrder: 12, isRequired: true },
        ]
        for (const t of tasks) {
            await prisma.offboardingTask.create({
                data: { id: randomUUID(), checklistId: cl.id, ...t },
            })
        }
        // Re-fetch with tasks
        const refetched = await prisma.offboardingChecklist.findUnique({
            where: { id: cl.id },
            include: { offboardingTasks: { orderBy: { sortOrder: 'asc' } } },
        })
        if (!refetched) return
        Object.assign(voluntaryChecklist ?? {}, refetched)
    }

    // Ensure we have the voluntary checklist now
    const volChecklist = voluntaryChecklist ?? await prisma.offboardingChecklist.findFirst({
        where: { targetType: 'VOLUNTARY', isActive: true },
        include: { offboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!volChecklist) {
        console.warn('⚠️ Still no voluntary checklist. Skipping.')
        return
    }

    // Find employees for offboarding — those without existing offboarding
    const existingOffboardings = await prisma.employeeOffboarding.findMany({
        select: { employeeId: true },
    })
    const existingIds = new Set(existingOffboardings.map((o) => o.employeeId))

    const candidates = await prisma.employee.findMany({
        where: {
            id: { notIn: Array.from(existingIds) },
            deletedAt: null,
        },
        include: {
            assignments: {
                where: { isPrimary: true, endDate: null, status: 'ACTIVE' },
                take: 1,
                include: { department: true, company: true },
            },
        },
        take: 10,
        orderBy: { hireDate: 'asc' },
    })

    if (candidates.length < 3) {
        console.warn(`⚠️ Only ${candidates.length} candidates for offboarding. Need at least 3.`)
        return
    }

    const now = new Date()

    // ── Instance 1: D-15, VOLUNTARY, mid-process ──────────
    const emp1 = candidates[0]
    const emp1CompanyId = emp1.assignments[0]?.companyId ?? ctrKr.id
    const lwd1 = new Date(now.getTime() + 15 * 86_400_000)
    const ob1Id = randomUUID()

    await prisma.employeeOffboarding.create({
        data: {
            id: ob1Id,
            employeeId: emp1.id,
            checklistId: volChecklist.id,
            resignType: 'VOLUNTARY',
            lastWorkingDate: lwd1,
            resignReasonCode: 'CAREER_GROWTH',
            resignReasonDetail: '더 좋은 기회를 찾아서',
            status: 'IN_PROGRESS',
            startedAt: new Date(now.getTime() - 15 * 86_400_000),
        },
    })

    // Create tasks with computed dueDates — 7/12 done
    for (let i = 0; i < volChecklist.offboardingTasks.length; i++) {
        const task = volChecklist.offboardingTasks[i]
        const dueDate = new Date(lwd1.getTime() - task.dueDaysBefore * 86_400_000)
        const isDone = i < 7 // First 7 tasks done
        await prisma.employeeOffboardingTask.create({
            data: {
                id: randomUUID(),
                employeeOffboardingId: ob1Id,
                taskId: task.id,
                status: isDone ? 'DONE' : 'PENDING',
                completedAt: isDone ? new Date(now.getTime() - (15 - i) * 86_400_000) : null,
                dueDate,
            },
        })
    }
    console.log(`  ✅ Instance 1: ${emp1.name} (D-15, VOLUNTARY, 7/${volChecklist.offboardingTasks.length} tasks done)`)

    // ── Instance 2: D-3, VOLUNTARY, urgent with 1 BLOCKED ──
    const emp2 = candidates[1]
    const emp2CompanyId = emp2.assignments[0]?.companyId ?? (ctrUs?.id ?? ctrKr.id)
    const lwd2 = new Date(now.getTime() + 3 * 86_400_000)
    const ob2Id = randomUUID()

    await prisma.employeeOffboarding.create({
        data: {
            id: ob2Id,
            employeeId: emp2.id,
            checklistId: volChecklist.id,
            resignType: 'VOLUNTARY',
            lastWorkingDate: lwd2,
            resignReasonCode: 'COMPENSATION',
            resignReasonDetail: '급여 불만족',
            status: 'IN_PROGRESS',
            startedAt: new Date(now.getTime() - 27 * 86_400_000),
            isExitInterviewCompleted: true,
        },
    })

    const totalTasks2 = volChecklist.offboardingTasks.length
    for (let i = 0; i < totalTasks2; i++) {
        const task = volChecklist.offboardingTasks[i]
        const dueDate = new Date(lwd2.getTime() - task.dueDaysBefore * 86_400_000)
        let status: 'DONE' | 'PENDING' | 'BLOCKED' = 'DONE'
        let blockedReason: string | null = null
        let blockedAt: Date | null = null

        if (i >= totalTasks2 - 3) status = 'PENDING' // last 3 pending
        if (i === totalTasks2 - 4) {
            status = 'BLOCKED'
            blockedReason = 'IT 장비 회수 지연 - 원격근무자'
            blockedAt = new Date(now.getTime() - 2 * 86_400_000)
        }

        await prisma.employeeOffboardingTask.create({
            data: {
                id: randomUUID(),
                employeeOffboardingId: ob2Id,
                taskId: task.id,
                status,
                completedAt: status === 'DONE' ? new Date(now.getTime() - (totalTasks2 - i) * 86_400_000) : null,
                dueDate,
                blockedReason,
                blockedAt,
            },
        })
    }
    console.log(`  ✅ Instance 2: ${emp2.name} (D-3, VOLUNTARY, ${totalTasks2 - 4}/${totalTasks2} done, 1 BLOCKED)`)

    // ── Instance 3: D-Day, INVOLUNTARY ────────────────────
    const emp3 = candidates[2]
    const lwd3 = new Date(now.getTime() - 1 * 86_400_000) // yesterday
    const ob3Id = randomUUID()

    const invChecklist = involuntaryChecklist ?? volChecklist // fallback to voluntary if no involuntary

    await prisma.employeeOffboarding.create({
        data: {
            id: ob3Id,
            employeeId: emp3.id,
            checklistId: invChecklist.id,
            resignType: 'INVOLUNTARY',
            lastWorkingDate: lwd3,
            resignReasonCode: 'PERFORMANCE',
            resignReasonDetail: '성과 미달',
            status: 'IN_PROGRESS',
            startedAt: lwd3,
        },
    })

    // All tasks DONE or SKIPPED
    for (let i = 0; i < invChecklist.offboardingTasks.length; i++) {
        const task = invChecklist.offboardingTasks[i]
        await prisma.employeeOffboardingTask.create({
            data: {
                id: randomUUID(),
                employeeOffboardingId: ob3Id,
                taskId: task.id,
                status: i < 3 ? 'DONE' : 'SKIPPED',
                completedAt: i < 3 ? lwd3 : null,
                dueDate: lwd3,
            },
        })
    }
    console.log(`  ✅ Instance 3: ${emp3.name} (D-Day, INVOLUNTARY)`)

    // ── Exit Interviews (8 total) ──────────────────────────

    // Find department IDs for 개발팀 and 영업팀
    const devDept = await prisma.department.findFirst({ where: { name: { contains: '개발' } } })
    const salesDept = await prisma.department.findFirst({ where: { name: { contains: '영업' } } })

    // Get various employees for exit interviews (distinct from offboarding candidates)
    const interviewCandidates = await prisma.employee.findMany({
        where: {
            deletedAt: null,
            ...(devDept ? { assignments: { some: { departmentId: devDept.id, isPrimary: true } } } : {}),
        },
        take: 6,
        orderBy: { createdAt: 'asc' },
    })

    const salesCandidates = await prisma.employee.findMany({
        where: {
            deletedAt: null,
            ...(salesDept ? { assignments: { some: { departmentId: salesDept.id, isPrimary: true } } } : {}),
        },
        take: 2,
        orderBy: { createdAt: 'asc' },
    })

    // Find an HR employee for interviewer
    const hrEmployee = await prisma.employee.findFirst({
        where: { assignments: { some: { department: { name: { contains: 'HR' } }, isPrimary: true, endDate: null } } },
    })
    const interviewerId = hrEmployee?.id ?? emp1.id

    const interviewData: Array<{
        employee: { id: string }
        reason: 'COMPENSATION' | 'CAREER_GROWTH' | 'WORK_LIFE_BALANCE' | 'MANAGEMENT' | 'CULTURE' | 'RELOCATION' | 'PERSONAL' | 'OTHER'
        satisfaction: number
        recommend: boolean
        company: string
    }> = []

    // 6 interviews in 개발팀
    if (interviewCandidates.length >= 6) {
        interviewData.push(
            { employee: interviewCandidates[0], reason: 'COMPENSATION', satisfaction: 2, recommend: false, company: ctrKr.id },
            { employee: interviewCandidates[1], reason: 'CAREER_GROWTH', satisfaction: 3, recommend: true, company: ctrKr.id },
            { employee: interviewCandidates[2], reason: 'WORK_LIFE_BALANCE', satisfaction: 2, recommend: false, company: ctrKr.id },
            { employee: interviewCandidates[3], reason: 'COMPENSATION', satisfaction: 3, recommend: false, company: ctrKr.id },
            { employee: interviewCandidates[4], reason: 'MANAGEMENT', satisfaction: 1, recommend: false, company: ctrKr.id },
            { employee: interviewCandidates[5], reason: 'CAREER_GROWTH', satisfaction: 4, recommend: true, company: ctrKr.id },
        )
    }

    // 2 interviews in 영업팀
    if (salesCandidates.length >= 2) {
        interviewData.push(
            { employee: salesCandidates[0], reason: 'RELOCATION', satisfaction: 3, recommend: true, company: ctrKr.id },
            { employee: salesCandidates[1], reason: 'PERSONAL', satisfaction: 4, recommend: true, company: ctrKr.id },
        )
    }

    // Create exit interviews (linked to Instance 2's offboarding or standalone)
    for (const iv of interviewData) {
        await prisma.exitInterview.create({
            data: {
                id: randomUUID(),
                employeeOffboardingId: ob2Id, // Link to Instance 2 (has exitInterviewCompleted=true)
                employeeId: iv.employee.id,
                interviewerId,
                interviewDate: new Date(now.getTime() - Math.floor(Math.random() * 30) * 86_400_000),
                primaryReason: iv.reason,
                satisfactionScore: iv.satisfaction,
                wouldRecommend: iv.recommend,
                feedbackText: `퇴직 사유: ${iv.reason}. 솔직한 피드백입니다.`,
                isConfidential: true,
                companyId: iv.company,
            },
        })
    }
    console.log(`  ✅ ${interviewData.length} exit interviews created`)

    // ── Asset Returns (3 records) ──────────────────────────

    // Asset 1: MacBook Pro (pending, for Instance 1)
    await prisma.assetReturn.create({
        data: {
            id: randomUUID(),
            employeeId: emp1.id,
            offboardingId: ob1Id,
            assetName: 'MacBook Pro 14"',
            assetTag: 'IT-2024-0312',
            purchasePrice: 2400000,
            residualValue: 800000,
            status: 'PENDING',
            consentDocExists: true,
            companyId: emp1CompanyId,
        },
    })

    // Asset 2: iPhone (unreturned, for Instance 2)
    await prisma.assetReturn.create({
        data: {
            id: randomUUID(),
            employeeId: emp2.id,
            offboardingId: ob2Id,
            assetName: 'iPhone 15 Pro',
            assetTag: 'IT-2024-0589',
            purchasePrice: 1500000,
            residualValue: 450000,
            status: 'UNRETURNED',
            consentDocExists: true,
            companyId: emp2CompanyId,
        },
    })

    // Asset 3: 사원증 (returned, for Instance 1)
    await prisma.assetReturn.create({
        data: {
            id: randomUUID(),
            employeeId: emp1.id,
            offboardingId: ob1Id,
            assetName: '사원증',
            status: 'RETURNED',
            returnedAt: new Date(now.getTime() - 5 * 86_400_000),
            consentDocExists: false,
            companyId: emp1CompanyId,
        },
    })

    console.log('  ✅ 3 asset returns created')
    console.log('🔴 Offboarding instances seeded successfully!')
}
