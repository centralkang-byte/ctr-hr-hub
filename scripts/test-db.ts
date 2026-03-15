import { prisma } from '@/lib/prisma'

async function main() {
  const managerStr = 'test_mgr@ctr.com'
  const managerUser = await (prisma as any).user.findUnique({ where: { email: managerStr } })
  console.log('Manager User:', managerUser?.id, managerUser?.employeeId)

  if (!managerUser?.employeeId) return

  const asgn = await prisma.employeeAssignment.findFirst({
    where: { employeeId: managerUser.employeeId, isPrimary: true, endDate: null },
    select: { positionId: true },
  })
  console.log('Manager Position:', asgn?.positionId)

  if (!asgn?.positionId) return

  const reports = await prisma.employeeAssignment.findMany({
    where: {
      position: { reportsToPositionId: asgn.positionId },
      isPrimary: true,
      endDate: null,
    },
    select: { employeeId: true, employee: { select: { name: true, email: true } } },
  })
  console.log('Direct Reports:', JSON.stringify(reports, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
