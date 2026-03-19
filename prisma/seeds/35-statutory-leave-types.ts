// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Seed: Statutory Leave Types per Country (S-Fix-4)
// Adds maternity, paternity, sick, marriage, bereavement, menstrual
// for countries that currently only inherit global defaults
// (VN, MX, RU, EU). CN/US/KR already have company-specific types.
// ═══════════════════════════════════════════════════════════

import type { PrismaClient } from '../../src/generated/prisma/client'

interface LeaveTypeSeed {
  code: string
  name: string
  nameEn: string
  isPaid: boolean
  allowHalfDay: boolean
  requiresProof: boolean
  maxConsecutiveDays?: number
  displayOrder: number
}

interface CompanyLeaveTypes {
  companyCode: string
  types: LeaveTypeSeed[]
}

// ── Statutory leave types per country ────────────────────────

const COMPANY_LEAVE_TYPES: CompanyLeaveTypes[] = [
  // ── CTR-VN: Vietnam statutory leave types ─────────────────
  {
    companyCode: 'CTR-VN',
    types: [
      { code: 'annual', name: 'Nghỉ phép năm', nameEn: 'Annual Leave', isPaid: true, allowHalfDay: true, requiresProof: false, displayOrder: 1 },
      { code: 'sick', name: 'Nghỉ ốm', nameEn: 'Sick Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 30, displayOrder: 2 },
      { code: 'maternity', name: 'Nghỉ thai sản', nameEn: 'Maternity Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 180, displayOrder: 3 },
      { code: 'paternity', name: 'Nghỉ cha', nameEn: 'Paternity Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 14, displayOrder: 4 },
      { code: 'marriage', name: 'Nghỉ kết hôn', nameEn: 'Marriage Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3, displayOrder: 5 },
      { code: 'bereavement', name: 'Nghỉ tang', nameEn: 'Bereavement Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3, displayOrder: 6 },
      { code: 'unpaid', name: 'Nghỉ không lương', nameEn: 'Unpaid Leave', isPaid: false, allowHalfDay: true, requiresProof: false, displayOrder: 7 },
    ],
  },
  // ── CTR-MX: Mexico statutory leave types ──────────────────
  {
    companyCode: 'CTR-MX',
    types: [
      { code: 'annual', name: 'Vacaciones', nameEn: 'Annual Leave', isPaid: true, allowHalfDay: true, requiresProof: false, displayOrder: 1 },
      { code: 'maternity', name: 'Licencia de maternidad', nameEn: 'Maternity Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 84, displayOrder: 2 },
      { code: 'paternity', name: 'Licencia de paternidad', nameEn: 'Paternity Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 5, displayOrder: 3 },
      { code: 'bereavement', name: 'Licencia por duelo', nameEn: 'Bereavement Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3, displayOrder: 4 },
      { code: 'unpaid', name: 'Licencia sin goce', nameEn: 'Unpaid Leave', isPaid: false, allowHalfDay: true, requiresProof: false, displayOrder: 5 },
    ],
  },
  // ── CTR-RU: Russia statutory leave types ──────────────────
  {
    companyCode: 'CTR-RU',
    types: [
      { code: 'annual', name: 'Ежегодный отпуск', nameEn: 'Annual Leave', isPaid: true, allowHalfDay: false, requiresProof: false, displayOrder: 1 },
      { code: 'sick', name: 'Больничный', nameEn: 'Sick Leave', isPaid: true, allowHalfDay: false, requiresProof: true, displayOrder: 2 },
      { code: 'maternity', name: 'Декретный отпуск', nameEn: 'Maternity Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 140, displayOrder: 3 },
      { code: 'bereavement', name: 'Отпуск по семейным', nameEn: 'Bereavement Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 5, displayOrder: 4 },
      { code: 'marriage', name: 'Свадебный отпуск', nameEn: 'Marriage Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 5, displayOrder: 5 },
      { code: 'unpaid', name: 'Отпуск без содержания', nameEn: 'Unpaid Leave', isPaid: false, allowHalfDay: false, requiresProof: false, displayOrder: 6 },
    ],
  },
  // ── CTR-EU: Poland statutory leave types ──────────────────
  {
    companyCode: 'CTR-EU',
    types: [
      { code: 'annual', name: 'Urlop wypoczynkowy', nameEn: 'Annual Leave', isPaid: true, allowHalfDay: true, requiresProof: false, displayOrder: 1 },
      { code: 'sick', name: 'Zwolnienie lekarskie', nameEn: 'Sick Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 33, displayOrder: 2 },
      { code: 'maternity', name: 'Urlop macierzyński', nameEn: 'Maternity Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 140, displayOrder: 3 },
      { code: 'paternity', name: 'Urlop ojcowski', nameEn: 'Paternity Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 14, displayOrder: 4 },
      { code: 'bereavement', name: 'Urlop okolicznościowy', nameEn: 'Bereavement Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 2, displayOrder: 5 },
      { code: 'marriage', name: 'Urlop ślubny', nameEn: 'Marriage Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 2, displayOrder: 6 },
      { code: 'on_demand', name: 'Urlop na żądanie', nameEn: 'On-Demand Leave', isPaid: true, allowHalfDay: true, requiresProof: false, maxConsecutiveDays: 4, displayOrder: 7 },
      { code: 'childcare', name: 'Urlop wychowawczy', nameEn: 'Childcare Leave', isPaid: false, allowHalfDay: false, requiresProof: true, displayOrder: 8 },
      { code: 'unpaid', name: 'Urlop bezpłatny', nameEn: 'Unpaid Leave', isPaid: false, allowHalfDay: false, requiresProof: false, displayOrder: 9 },
    ],
  },
  // ── CTR-KR: Add missing menstrual leave (생리휴가) ────────
  {
    companyCode: 'CTR-KR',
    types: [
      { code: 'menstrual', name: '생리휴가', nameEn: 'Menstrual Leave', isPaid: false, allowHalfDay: false, requiresProof: false, displayOrder: 9 },
      { code: 'marriage', name: '결혼휴가', nameEn: 'Marriage Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 5, displayOrder: 10 },
    ],
  },
]

export async function seedStatutoryLeaveTypes(p: PrismaClient) {
  console.log('  🏖 Seeding statutory leave types per country (S-Fix-4)...')

  const companies = await p.company.findMany({ select: { id: true, code: true } })
  const codeToId = new Map(companies.map((c) => [c.code, c.id]))

  let created = 0
  let skipped = 0

  for (const companyDef of COMPANY_LEAVE_TYPES) {
    const companyId = codeToId.get(companyDef.companyCode)
    if (!companyId) {
      console.log(`    ⚠️  Company ${companyDef.companyCode} not found, skipping`)
      continue
    }

    for (const lt of companyDef.types) {
      const existing = await p.leaveTypeDef.findFirst({
        where: { companyId, code: lt.code },
      })

      if (existing) {
        skipped++
        continue
      }

      await p.leaveTypeDef.create({
        data: {
          ...lt,
          companyId,
          isActive: true,
        },
      })
      created++
    }
  }

  console.log(`  ✅ Statutory leave types: ${created} created, ${skipped} already existed`)
}

// Standalone execution
if (require.main === module) {
  import('dotenv').then(dotenv => {
    import('path').then(path => {
      dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })
      dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

      import('../../src/generated/prisma/client').then(({ PrismaClient }) => {
        import('@prisma/adapter-pg').then(({ PrismaPg }) => {
          const connectionString = process.env.DATABASE_URL
          if (!connectionString) throw new Error('DATABASE_URL is not set')
          const adapter = new PrismaPg({ connectionString })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const prisma = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] }) as InstanceType<typeof PrismaClient>
          seedStatutoryLeaveTypes(prisma)
            .then(() => prisma.$disconnect())
            .catch((e: unknown) => {
              console.error(e)
              prisma.$disconnect()
              process.exit(1)
            })
        })
      })
    })
  })
}
