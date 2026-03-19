// @ts-nocheck
import { PrismaClient } from '../src/generated/prisma/client'

const prisma = new PrismaClient({})
async function main() {
  console.log('Fetching policies...')
  const policies = await prisma.leavePolicy.findMany({
    where: { 
      name: { contains: '연차' },
      deletedAt: null
    }
  })

  const officialTarget = policies.find((p: { id: string, name: string }) => p.name.includes('연차유급휴가'))
  // Delete anything that has 연차 in the name but is NOT the official target
  const toDelete = policies.filter((p: { id: string, name: string }) => p.id !== officialTarget?.id)

  if (!officialTarget) {
    console.log('Official target not found.')
    return
  }

  for (const policy of toDelete) {
    console.log(`Processing redundant policy: ${policy.name} (${policy.id})`)
    
    await prisma.leaveBalance.updateMany({
      where: { policyId: policy.id },
      data: { policyId: officialTarget.id }
    })

    await prisma.leaveRequest.updateMany({
      where: { policyId: policy.id },
      data: { policyId: officialTarget.id }
    })

    await prisma.leavePolicy.update({
      where: { id: policy.id },
      data: { deletedAt: new Date() }
    })
    console.log(`- Soft-deleted policy ${policy.id}`)
  }
}

main().finally(() => prisma.$disconnect())
