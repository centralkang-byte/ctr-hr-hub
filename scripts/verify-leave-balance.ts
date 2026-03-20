import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) throw new Error('DATABASE_URL not set')
const adapter = new PrismaPg({ connectionString: dbUrl })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: PrismaClient = new (PrismaClient as any)({ adapter })

async function check() {
  const emails = ['employee-a@ctr.co.kr', 'employee-b@ctr.co.kr']
  for (const email of emails) {
    const emp = await prisma.employee.findUnique({ where: { email } })
    if (!emp) { console.log(email, 'NOT FOUND'); continue }
    const balances = await prisma.leaveYearBalance.findMany({
      where: { employeeId: emp.id, year: 2026 },
      include: { leaveTypeDef: { select: { name: true, code: true } } },
    })
    for (const b of balances) {
      console.log(`${email} | ${emp.name} | ${b.leaveTypeDef.name} | entitled: ${b.entitled} | used: ${b.used}`)
    }
  }
  await prisma.$disconnect()
}
check()
