import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const mgr = await prisma.employee.findFirst({ where: { email: 'manager@ctr.co.kr' } })
    if (!mgr) return NextResponse.json({ error: 'Manager not found' }, { status: 404 })
    
    const asgn = await prisma.employeeAssignment.findFirst({
      where: { employeeId: mgr.id, isPrimary: true, endDate: null },
      select: { positionId: true },
    })
    
    if (!asgn?.positionId) return NextResponse.json({ error: 'Manager has no position' })

    const reports = await prisma.employeeAssignment.findMany({
      where: {
        position: { reportsToPositionId: asgn.positionId },
        isPrimary: true,
        endDate: null,
      },
      select: { employee: { select: { email: true, name: true } } },
    })

    return NextResponse.json({ managerPos: asgn.positionId, reports })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 })
  }
}
