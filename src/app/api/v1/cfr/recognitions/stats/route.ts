// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recognition Statistics (HR Admin)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/cfr/recognitions/stats ──────────────────

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const companyId = user.companyId

    // Value distribution
    const valueDistribution = await prisma.recognition.groupBy({
      by: ['coreValue'],
      where: { companyId },
      _count: { id: true },
    })

    // Monthly trend (last 12 months)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const allRecognitions = await prisma.recognition.findMany({
      where: { companyId, createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true },
    })

    const monthlyTrend: Record<string, number> = {}
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyTrend[key] = 0
    }
    for (const r of allRecognitions) {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (key in monthlyTrend) monthlyTrend[key]++
    }

    // Department activity
    const deptRecognitions = await prisma.recognition.findMany({
      where: { companyId },
      select: {
        sender: {
          select: {
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              include: { department: { select: { id: true, name: true } } },
            },
          },
        },
        receiver: {
          select: {
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              include: { department: { select: { id: true, name: true } } },
            },
          },
        },
      },
    })

    const deptActivity: Record<string, { name: string; sent: number; received: number }> = {}
    for (const r of deptRecognitions) {
      const senderDept = r.sender.assignments?.[0]?.department
      const receiverDept = r.receiver.assignments?.[0]?.department
      const senderDeptId = senderDept?.id
      const receiverDeptId = receiverDept?.id
      if (senderDeptId) {
        if (!deptActivity[senderDeptId]) deptActivity[senderDeptId] = { name: senderDept!.name, sent: 0, received: 0 }
        deptActivity[senderDeptId].sent++
      }
      if (receiverDeptId) {
        if (!deptActivity[receiverDeptId]) deptActivity[receiverDeptId] = { name: receiverDept!.name, sent: 0, received: 0 }
        deptActivity[receiverDeptId].received++
      }
    }

    // Top recognizers & recognized
    const topSenders = await prisma.recognition.groupBy({
      by: ['senderId'],
      where: { companyId },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })

    const topReceivers = await prisma.recognition.groupBy({
      by: ['receiverId'],
      where: { companyId },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })

    const senderIds = topSenders.map((s) => s.senderId)
    const receiverIds = topReceivers.map((r) => r.receiverId)
    const allIds = [...new Set([...senderIds, ...receiverIds])]

    const employees = await prisma.employee.findMany({
      where: { id: { in: allIds } },
      select: { id: true, name: true },
    })
    const empMap = new Map(employees.map((e) => [e.id, e.name]))

    return apiSuccess({
      valueDistribution: valueDistribution.map((v) => ({
        value: v.coreValue,
        count: v._count.id,
      })),
      monthlyTrend: Object.entries(monthlyTrend)
        .map(([month, count]) => ({ month, count }))
        .reverse(),
      departmentActivity: Object.values(deptActivity),
      topRecognizers: topSenders.map((s) => ({
        name: empMap.get(s.senderId) ?? '',
        count: s._count.id,
      })),
      topRecognized: topReceivers.map((r) => ({
        name: empMap.get(r.receiverId) ?? '',
        count: r._count.id,
      })),
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
