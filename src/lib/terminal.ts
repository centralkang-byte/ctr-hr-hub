// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Terminal (Attendance Device) Integration
// DB-based per-terminal authentication
// ═══════════════════════════════════════════════════════════

import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { unauthorized } from '@/lib/errors'

// ─── Types ────────────────────────────────────────────────

interface VerifiedTerminal {
  id: string
  companyId: string
  terminalCode: string
  terminalType: string
  locationName: string
}

// ─── Generate Terminal Secret ─────────────────────────────

export function generateTerminalSecret(): string {
  return `tsec_${crypto.randomUUID().replace(/-/g, '')}`
}

// ─── Verify Terminal (DB-based) ───────────────────────────

export async function verifyTerminal(
  headers: Headers,
): Promise<VerifiedTerminal> {
  const terminalId = headers.get('X-Terminal-ID')
  const terminalSecret = headers.get('X-Terminal-Secret')

  if (!terminalId || !terminalSecret) {
    throw unauthorized('단말기 인증 헤더가 누락되었습니다.')
  }

  const terminal = await prisma.attendanceTerminal.findFirst({
    where: {
      id: terminalId,
      apiSecret: terminalSecret,
      isActive: true,
    },
    select: {
      id: true,
      companyId: true,
      terminalCode: true,
      terminalType: true,
      locationName: true,
    },
  })

  if (!terminal) {
    throw unauthorized('잘못된 단말기 인증 정보입니다.')
  }

  return terminal
}

// ─── Update Terminal Heartbeat ───────────────────────────

export async function updateTerminalHeartbeat(
  terminalId: string,
): Promise<void> {
  await prisma.attendanceTerminal.update({
    where: { id: terminalId },
    data: {
      lastHeartbeatAt: new Date(),
    },
  })
}

// ─── Check Terminal Online Status ────────────────────────

export async function checkTerminalStatus(
  companyId: string,
): Promise<
  {
    id: string
    locationName: string
    terminalCode: string
    isActive: boolean
    isOnline: boolean
    lastHeartbeatAt: Date | null
  }[]
> {
  const terminals = await prisma.attendanceTerminal.findMany({
    where: { companyId },
    select: {
      id: true,
      locationName: true,
      terminalCode: true,
      isActive: true,
      lastHeartbeatAt: true,
    },
  })

  const heartbeatInterval = env.TERMINAL_HEARTBEAT_INTERVAL * 1000
  const now = Date.now()

  return terminals.map((t) => {
    const isOnline =
      t.isActive &&
      t.lastHeartbeatAt !== null &&
      now - t.lastHeartbeatAt.getTime() < heartbeatInterval * 3

    return {
      id: t.id,
      locationName: t.locationName,
      terminalCode: t.terminalCode,
      isActive: t.isActive,
      isOnline,
      lastHeartbeatAt: t.lastHeartbeatAt,
    }
  })
}

// ─── Mark offline terminals ──────────────────────────────

export async function markOfflineTerminals(): Promise<number> {
  const threshold = new Date(
    Date.now() - env.TERMINAL_HEARTBEAT_INTERVAL * 3 * 1000,
  )

  const result = await prisma.attendanceTerminal.updateMany({
    where: {
      isActive: true,
      lastHeartbeatAt: { lt: threshold },
    },
    data: { isActive: false },
  })

  return result.count
}
