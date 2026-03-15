/**
 * scripts/qa/get-test-emails.ts
 *
 * DB에서 역할별 테스트 계정 이메일을 조회하여 출력한다.
 * 실행: npx tsx scripts/qa/get-test-emails.ts
 */
import { prisma } from '@/lib/prisma'

async function main() {
  const roles = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'] as const

  const result: Record<string, string> = {}

  for (const roleCode of roles) {
    const er = await prisma.employeeRole.findFirst({
      where: { role: { code: roleCode } },
      include: {
        employee: {
          include: {
            ssoIdentities: { take: 1 },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    })

    const email = er?.employee?.ssoIdentities?.[0]?.email ?? null
    const name = er?.employee?.name ?? 'unknown'
    if (email) {
      result[roleCode] = email
      console.log(`${roleCode.padEnd(15)} → ${email} (${name})`)
    } else {
      console.warn(`⚠️  ${roleCode}: no SsoIdentity found`)
    }
  }

  // Write to file for use by capture script
  const fs = await import('fs')
  fs.writeFileSync(
    'scripts/qa/test-emails.json',
    JSON.stringify(result, null, 2),
  )
  console.log('\n✅ Saved to scripts/qa/test-emails.json')
}

main().catch(console.error).finally(() => prisma.$disconnect())
