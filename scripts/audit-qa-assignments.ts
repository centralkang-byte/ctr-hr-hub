import dotenv from 'dotenv'
import path from 'path'
const repoRoot = path.resolve(__dirname, '..')
dotenv.config({ path: path.resolve(repoRoot, '.env.local') })
dotenv.config({ path: path.resolve(repoRoot, '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const QA_EMAILS = [
  'super@ctr.co.kr',
  'hr@ctr.co.kr',
  'hr@ctr-cn.com',
  'manager@ctr.co.kr',
  'manager2@ctr.co.kr',
  'employee-a@ctr.co.kr',
  'employee-b@ctr.co.kr',
  'employee-c@ctr.co.kr',
  'executive@ctr.co.kr',
]

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: PrismaClient = new (PrismaClient as any)({ adapter })
  const now = new Date()
  console.log('NOW (UTC):', now.toISOString())
  console.log('')

  for (const email of QA_EMAILS) {
    const emp = await prisma.employee.findFirst({
      where: { email },
      select: {
        id: true,
        name: true,
        assignments: {
          orderBy: { effectiveDate: 'desc' },
          select: { id: true, isPrimary: true, effectiveDate: true, endDate: true, status: true, changeType: true },
        },
      },
    })
    if (!emp) {
      console.log(`❌ ${email} — NOT FOUND`)
      continue
    }
    const activeNow = emp.assignments.find(
      (a) => a.isPrimary && a.endDate === null && a.effectiveDate <= now,
    )
    const symbol = activeNow ? '✅' : '⚠️'
    console.log(`${symbol} ${email} (${emp.name}) — ${emp.assignments.length} assignments, active-now: ${activeNow ? 'YES' : 'NO'}`)
    for (const a of emp.assignments) {
      const future = a.effectiveDate > now ? '🔮' : '  '
      const ended = a.endDate ? '🛑' : '  '
      console.log(`   ${future}${ended} id=${a.id.slice(0, 8)} eff=${a.effectiveDate.toISOString().slice(0, 10)} end=${a.endDate?.toISOString().slice(0, 10) ?? '---'}        primary=${a.isPrimary} status=${a.status} type=${a.changeType}`)
    }
    console.log('')
  }
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
