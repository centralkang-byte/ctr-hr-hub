// ═══════════════════════════════════════════════════════════
// Seed: Calibration QA Data
// ═══════════════════════════════════════════════════════════
// CALIBRATION 상태 사이클 + MANAGER 평가 + 세션 생성
// 배치 조정 UI QA 테스트용

import type { PrismaClient } from '../../src/generated/prisma/client'

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

// 9-block EMS distribution (3x3 grid)
// 1A=top-left(high perf, low potential) ... 3C=bottom-right(low perf, high potential)
const BLOCK_CODES = ['1A', '2A', '3A', '1B', '2B', '3B', '1C', '2C', '3C'] as const

export async function seedCalibrationQA(prisma: PrismaClient) {
  console.log('  🎯 Seeding Calibration QA data...')

  // Find CTR (주) company
  const ctr = await prisma.company.findFirst({ where: { code: 'CTR' } })
  if (!ctr) {
    console.log('    ⚠️ CTR company not found — skip')
    return { created: 0 }
  }

  // Find HR Admin (한지영) as creator
  const hrAdmin = await prisma.employee.findFirst({
    where: { email: 'hr@ctr.co.kr' },
  })
  if (!hrAdmin) {
    console.log('    ⚠️ HR Admin not found — skip')
    return { created: 0 }
  }

  // Create or update a CALIBRATION-status cycle
  const cycleId = deterministicUUID('calib-qa-cycle', 'CTR:2025H2:QA')
  const existingCycle = await prisma.performanceCycle.findFirst({ where: { id: cycleId } })

  if (!existingCycle) {
    await prisma.performanceCycle.create({
      data: {
        id: cycleId,
        companyId: ctr.id,
        name: '2025 H2 캘리브레이션 QA',
        year: 2025,
        half: 'H2',
        status: 'CALIBRATION',
        goalStart: new Date('2025-07-01'),
        goalEnd: new Date('2025-07-31'),
        evalStart: new Date('2025-11-01'),
        evalEnd: new Date('2025-12-15'),
      },
    })
    console.log('    ✅ CALIBRATION cycle created')
  } else if (existingCycle.status !== 'CALIBRATION') {
    await prisma.performanceCycle.update({
      where: { id: cycleId },
      data: { status: 'CALIBRATION' },
    })
    console.log('    ✅ Cycle status updated to CALIBRATION')
  } else {
    console.log('    ⏭️ CALIBRATION cycle already exists')
  }

  // Get CTR employees with active primary assignments
  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      resignDate: null,
      assignments: {
        some: { isPrimary: true, endDate: null, position: { companyId: ctr.id } },
      },
    },
    select: { id: true, name: true },
    take: 20,
    orderBy: { createdAt: 'asc' },
  })

  if (employees.length < 5) {
    console.log(`    ⚠️ Only ${employees.length} CTR employees — need at least 5`)
    return { created: 0 }
  }

  // Create MANAGER evaluations with emsBlock distribution
  let evalCreated = 0
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i]
    const evalId = deterministicUUID('calib-qa-eval', `${emp.id}:${cycleId}`)
    const blockCode = BLOCK_CODES[i % BLOCK_CODES.length]

    // Scores correlated with block position
    const perfScore = 3.0 + (2 - Math.floor(i % 3)) * 0.5
    const compScore = 3.0 + Math.floor((i % 9) / 3) * 0.4
    const existing = await prisma.performanceEvaluation.findFirst({ where: { id: evalId } })
    if (!existing) {
      await prisma.performanceEvaluation.create({
        data: {
          id: evalId,
          cycle: { connect: { id: cycleId } },
          employee: { connect: { id: emp.id } },
          evaluator: { connect: { id: hrAdmin.id } },
          company: { connect: { id: ctr.id } },
          evalType: 'MANAGER',
          status: 'SUBMITTED',
          emsBlock: blockCode,
          performanceScore: perfScore,
          competencyScore: compScore,
          submittedAt: new Date('2025-12-15'),
        },
      })
      evalCreated++
    }
  }
  console.log(`    ✅ ${evalCreated} MANAGER evaluations (emsBlock assigned)`)

  // Create CalibrationSession (CALIBRATION_DRAFT)
  const sessionId = deterministicUUID('calib-qa-session', 'CTR:2025H2:QA:SESS1')
  const existingSession = await prisma.calibrationSession.findFirst({ where: { id: sessionId } })

  if (!existingSession) {
    await prisma.calibrationSession.create({
      data: {
        id: sessionId,
        cycleId,
        companyId: ctr.id,
        name: 'QA 배치 조정 테스트 세션',
        status: 'CALIBRATION_DRAFT',
        createdById: hrAdmin.id,
      },
    })
    console.log('    ✅ CalibrationSession (CALIBRATION_DRAFT) created')
  } else {
    console.log('    ⏭️ CalibrationSession already exists')
  }

  console.log(`    📊 Summary: cycle=CALIBRATION, evals=${evalCreated}, session=1`)
  return { created: evalCreated + 2 }
}
