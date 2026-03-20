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
const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

const emails = [
  'super@ctr.co.kr','hr@ctr.co.kr','hr@ctr-cn.com',
  'manager@ctr.co.kr','manager2@ctr.co.kr',
  'employee-a@ctr.co.kr','employee-b@ctr.co.kr','employee-c@ctr.co.kr'
]

async function verify() {
  console.log('=== V1: Employee records ===')
  for (const email of emails) {
    const emp = await prisma.employee.findUnique({ where: { email } })
    console.log(email, emp ? '✅' : '❌')
  }

  console.log('\n=== V2: Assignment + Company + Department ===')
  for (const email of emails) {
    const emp = await prisma.employee.findUnique({ where: { email }, include: {
      assignments: { where: { isPrimary: true, endDate: null }, include: { company: true, department: true, position: true } }
    }})
    const a = emp?.assignments?.[0]
    console.log(email, '|', a?.company?.code ?? '-', '|', a?.department?.name ?? '-', '|', a?.position?.code ?? '-')
  }

  console.log('\n=== V3: EmployeeRole ===')
  for (const email of emails) {
    const emp = await prisma.employee.findUnique({ where: { email } })
    if (!emp) { console.log(email, '❌ no employee'); continue }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roles = await prisma.employeeRole.findMany({ where: { employeeId: emp.id }, include: { role: true } })
    console.log(email, '|', roles.map((r: { role: { code: string } }) => r.role.code).join(',') || '-')
  }

  console.log('\n=== V4: SsoIdentity ===')
  for (const email of emails) {
    const sso = await prisma.ssoIdentity.findFirst({ where: { email } })
    console.log(email, sso ? '✅' : '❌')
  }

  console.log('\n=== V5: Position reportsTo (manager chain) ===')
  for (const email of ['employee-a@ctr.co.kr', 'employee-b@ctr.co.kr', 'employee-c@ctr.co.kr']) {
    const emp = await prisma.employee.findUnique({ where: { email }, include: {
      assignments: { where: { isPrimary: true, endDate: null }, include: {
        position: { include: { reportsTo: { include: { assignments: { where: { isPrimary: true, endDate: null }, include: { employee: true } } } } } }
      }}
    }})
    const pos = emp?.assignments?.[0]?.position
    const mgrEmail = pos?.reportsTo?.assignments?.[0]?.employee?.email ?? 'none'
    console.log(email, '→ reports to:', mgrEmail)
  }

  await prisma.$disconnect()
}
verify()
