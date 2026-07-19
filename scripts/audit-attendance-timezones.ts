import dotenv from 'dotenv'
import path from 'path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { isSupportedAttendanceTimezone } from '../src/lib/timezone'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set.')
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })
const intentionalOverrideCompanyCodes = new Set(
  (process.env.ATTENDANCE_TIMEZONE_OVERRIDE_ALLOWLIST ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
)

async function main() {
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: {
      code: true,
      timezone: true,
      attendanceSettings: { select: { timezone: true }, take: 1 },
    },
    orderBy: { code: 'asc' },
  })

  const failures: string[] = []
  for (const company of companies) {
    const settingTimezone = company.attendanceSettings[0]?.timezone
    const effectiveTimezone = settingTimezone ?? company.timezone

    if (!isSupportedAttendanceTimezone(effectiveTimezone)) {
      failures.push(`${company.code}: unsupported ${effectiveTimezone}`)
      continue
    }

    if (
      settingTimezone &&
      settingTimezone !== company.timezone &&
      !intentionalOverrideCompanyCodes.has(company.code)
    ) {
      failures.push(
        `${company.code}: AttendanceSetting=${settingTimezone}, Company=${company.timezone}`,
      )
    }
  }

  if (failures.length > 0) {
    console.error('Attendance timezone audit failed:')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }

  console.log(`Attendance timezone audit passed (${companies.length} companies).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
