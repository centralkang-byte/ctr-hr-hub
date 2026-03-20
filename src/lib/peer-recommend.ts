// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Peer Review Recommendation Engine
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

export interface PeerCandidate {
  employeeId: string
  name: string
  department: string
  totalScore: number
  scores: {
    type: string
    rawCount: number
    weightedScore: number
  }[]
}

const SCORE_WEIGHTS: Record<string, number> = {
  RECOGNITION: 3.0,
  ONE_ON_ONE: 2.0,
  SAME_DEPARTMENT: 1.0,
  INTERVIEW_PANEL: 2.5,
  CROSS_TRANSFER: 1.5,
}

/**
 * Generate peer review recommendations for an employee.
 * Uses CollaborationScore records to find the most relevant peers.
 */
export async function recommendPeers(
  employeeId: string,
  companyId: string,
  cycleId: string,
  limit = 5,
): Promise<PeerCandidate[]> {
  // Get the cycle period for scoping
  const cycle = await prisma.performanceCycle.findUnique({
    where: { id: cycleId },
    select: { goalStart: true, evalEnd: true },
  })
  if (!cycle) return []

  // Fetch collaboration scores where this employee is involved
  const scores = await prisma.collaborationScore.findMany({
    where: {
      employeeId,
      companyId,
      periodStart: { gte: cycle.goalStart },
      periodEnd: { lte: cycle.evalEnd },
    },
    include: {
      peer: {
        select: {
          id: true,
          name: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            include: { department: { select: { name: true } } },
          },
        },
      },
    },
  })

  // Aggregate scores per peer
  const peerMap = new Map<string, {
    name: string
    department: string
    scores: { type: string; rawCount: number; weightedScore: number }[]
    totalScore: number
  }>()

  for (const s of scores) {
    const peerId = s.peerId
    const weight = SCORE_WEIGHTS[s.scoreType] ?? 1.0
    const weighted = Number(s.weightedScore) * weight

    if (!peerMap.has(peerId)) {
      peerMap.set(peerId, {
        name: s.peer.name,
        department: extractPrimaryAssignment(s.peer.assignments ?? [])?.department?.name ?? '-',
        scores: [],
        totalScore: 0,
      })
    }

    const entry = peerMap.get(peerId)!
    entry.scores.push({
      type: s.scoreType,
      rawCount: s.rawCount,
      weightedScore: weighted,
    })
    entry.totalScore += weighted
  }

  // Also check for existing nominations to exclude
  const existingNominations = await prisma.peerReviewNomination.findMany({
    where: { cycleId, employeeId },
    select: { nomineeId: true },
  })
  const alreadyNominated = new Set(existingNominations.map((n) => n.nomineeId))

  // Sort by totalScore descending, exclude self and already nominated
  const candidates: PeerCandidate[] = Array.from(peerMap.entries())
    .filter(([peerId]) => peerId !== employeeId && !alreadyNominated.has(peerId))
    .sort((a, b) => b[1].totalScore - a[1].totalScore)
    .slice(0, limit)
    .map(([peerId, data]) => ({
      employeeId: peerId,
      name: data.name,
      department: data.department,
      totalScore: Math.round(data.totalScore * 100) / 100,
      scores: data.scores,
    }))

  // If we don't have enough candidates from collaboration scores,
  // fill with same-department employees
  if (candidates.length < limit) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: { departmentId: true },
        },
      },
    })

    const departmentId = (extractPrimaryAssignment(employee?.assignments ?? []) as Record<string, any>)?.departmentId

    if (departmentId) {
      const existingIds = new Set([
        employeeId,
        ...candidates.map((c) => c.employeeId),
        ...alreadyNominated,
      ])

      const deptPeers = await prisma.employee.findMany({
        where: {
          id: { notIn: Array.from(existingIds) },
          assignments: {
            some: {
              companyId,
              departmentId,
              status: 'ACTIVE',
              isPrimary: true,
              endDate: null,
            },
          },
        },
        select: {
          id: true,
          name: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            include: { department: { select: { name: true } } },
          },
        },
        take: limit - candidates.length,
      })

      for (const p of deptPeers) {
        candidates.push({
          employeeId: p.id,
          name: p.name,
          department: extractPrimaryAssignment(p.assignments ?? [])?.department?.name ?? '-',
          totalScore: 0,
          scores: [{ type: 'SAME_DEPARTMENT', rawCount: 1, weightedScore: 0 }],
        })
      }
    }
  }

  return candidates
}
