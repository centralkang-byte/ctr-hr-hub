// ═══════════════════════════════════════════════════════════
// Fix 4-4: Supplementary Seed Data
// - [P2-18] Crossboarding global templates (DEPARTURE + ARRIVAL)
// - [P2-7]  Employee-A EmployeeLeaveBalance for 2026
// - [P2-33] CFR Settings (cfr-config + one-on-one-config)
//
// ★ Standalone script — do NOT run seed.ts master
// Run: npx tsx prisma/seeds/27-fix-4-data.ts
// ═══════════════════════════════════════════════════════════

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Check .env.local or .env')
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

function deterministicUUID(ns: string, key: string): string {
  const crypto = require('crypto')
  const hash = crypto.createHash('sha256').update(`${ns}:${key}`).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join('-')
}

async function main() {
  console.log('🔧 Fix 4-4: Seeding supplementary data...')

  // ── [P2-18] Crossboarding Global Templates ──────────────────
  // Check if they already exist (from 23-crossboarding.ts)
  const existingDep = await prisma.onboardingTemplate.findFirst({
    where: { companyId: null, planType: 'CROSSBOARDING_DEPARTURE' },
  })
  const existingArr = await prisma.onboardingTemplate.findFirst({
    where: { companyId: null, planType: 'CROSSBOARDING_ARRIVAL' },
  })

  if (!existingDep) {
    const depId = deterministicUUID('fix4-template', 'global:CROSSBOARDING_DEPARTURE')
    await prisma.onboardingTemplate.create({
      data: {
        id: depId,
        name: '크로스보딩 출발 체크리스트 (글로벌)',
        description: '법인 간 이동 시 출발 법인에서 수행할 글로벌 기본 체크리스트',
        planType: 'CROSSBOARDING_DEPARTURE',
        targetType: 'TRANSFER',
        companyId: null,
      },
    })
    console.log('  ✅ Crossboarding DEPARTURE template created')
  } else {
    console.log('  ✅ Crossboarding DEPARTURE template already exists')
  }

  if (!existingArr) {
    const arrId = deterministicUUID('fix4-template', 'global:CROSSBOARDING_ARRIVAL')
    await prisma.onboardingTemplate.create({
      data: {
        id: arrId,
        name: '크로스보딩 도착 체크리스트 (글로벌)',
        description: '법인 간 이동 시 도착 법인에서 수행할 글로벌 기본 체크리스트',
        planType: 'CROSSBOARDING_ARRIVAL',
        targetType: 'TRANSFER',
        companyId: null,
      },
    })
    console.log('  ✅ Crossboarding ARRIVAL template created')
  } else {
    console.log('  ✅ Crossboarding ARRIVAL template already exists')
  }

  // ── [P2-7] Employee-A EmployeeLeaveBalance ──────────────────
  const eaSso = await prisma.ssoIdentity.findFirst({
    where: { email: 'employee-a@ctr.co.kr' },
    select: { employeeId: true },
  })

  if (eaSso?.employeeId) {
    // Find a leave policy for CTR
    const krCompany = await prisma.company.findFirst({
      where: { code: 'CTR' },
      select: { id: true },
    })

    if (krCompany) {
      const policy = await prisma.leavePolicy.findFirst({
        where: { companyId: krCompany.id, deletedAt: null },
        select: { id: true },
      })

      if (policy) {
        await prisma.employeeLeaveBalance.upsert({
          where: {
            employeeId_policyId_year: {
              employeeId: eaSso.employeeId,
              policyId: policy.id,
              year: 2026,
            },
          },
          update: { grantedDays: 15 },
          create: {
            employeeId: eaSso.employeeId,
            policyId: policy.id,
            year: 2026,
            grantedDays: 15,
            usedDays: 0,
            pendingDays: 0,
            carryOverDays: 0,
          },
        })

        // Phase 6: Mirror to LeaveYearBalance
        const annualTypeDef = await prisma.leaveTypeDef.findFirst({
          where: { companyId: krCompany.id, code: 'annual' },
          select: { id: true },
        })
        if (annualTypeDef) {
          await prisma.leaveYearBalance.upsert({
            where: {
              employeeId_leaveTypeDefId_year: {
                employeeId: eaSso.employeeId,
                leaveTypeDefId: annualTypeDef.id,
                year: 2026,
              },
            },
            update: { entitled: 15 },
            create: {
              employeeId: eaSso.employeeId,
              leaveTypeDefId: annualTypeDef.id,
              year: 2026,
              entitled: 15,
              used: 0,
              pending: 0,
              carriedOver: 0,
              adjusted: 0,
            },
          })
        }
        console.log('  ✅ Employee-A (이민준) leave balance for 2026 created')
      } else {
        console.warn('  ⚠️ No active LeavePolicy found for CTR-KR')
      }
    }
  } else {
    console.warn('  ⚠️ Employee-A not found — skipping leave balance')
  }

  // ── [P2-33] CFR Settings ────────────────────────────────────
  // Check if already seeded by 26-process-settings.ts
  const existingCfr = await prisma.companyProcessSetting.findFirst({
    where: { companyId: null, settingType: 'PERFORMANCE', settingKey: 'cfr-config' },
  })

  if (!existingCfr) {
    await prisma.companyProcessSetting.create({
      data: {
        companyId: null,
        settingType: 'PERFORMANCE',
        settingKey: 'cfr-config',
        settingValue: {
          feedbackEnabled: true,
          recognitionEnabled: true,
          feedbackCategories: ['growth', 'collaboration', 'achievement', 'leadership'],
          recognitionBadges: ['star', 'teamwork', 'innovation', 'impact'],
          anonymousFeedbackAllowed: false,
          maxRecipientsPerRecognition: 5,
        },
        description: 'CFR(상시 피드백/인정) 기본 설정',
      },
    })
    console.log('  ✅ CFR config created')
  } else {
    console.log('  ✅ CFR config already exists')
  }

  const existingOneOnOne = await prisma.companyProcessSetting.findFirst({
    where: { companyId: null, settingType: 'PERFORMANCE', settingKey: 'one-on-one-config' },
  })

  if (!existingOneOnOne) {
    await prisma.companyProcessSetting.create({
      data: {
        companyId: null,
        settingType: 'PERFORMANCE',
        settingKey: 'one-on-one-config',
        settingValue: {
          defaultFrequency: 'BIWEEKLY',
          reminderDaysBefore: 1,
          autoScheduleEnabled: false,
          templateQuestions: [
            '지난 기간 주요 성과는?',
            '현재 직면한 어려움은?',
            '다음 기간 목표는?',
            '추가 지원이 필요한 사항은?',
          ],
        },
        description: '1:1 면담 기본 설정',
      },
    })
    console.log('  ✅ One-on-one config created')
  } else {
    console.log('  ✅ One-on-one config already exists')
  }

  console.log('✅ Fix 4-4 seed complete')
}

main()
  .catch((e) => {
    console.error('❌ Fix 4-4 seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
