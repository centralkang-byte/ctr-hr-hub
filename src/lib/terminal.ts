// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Terminal (Attendance Device) Integration
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { unauthorized } from '@/lib/errors'

// ─── Verify Terminal API Secret ──────────────────────────

export function verifyTerminalSecret(secret: string): void {
  if (!env.TERMINAL_API_SECRET || secret !== env.TERMINAL_API_SECRET) {
    throw unauthorized('잘못된 단말기 인증 정보입니다.')
  }
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
