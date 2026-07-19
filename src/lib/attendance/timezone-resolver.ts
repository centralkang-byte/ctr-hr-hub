import 'server-only'

import { prisma } from '@/lib/prisma'
import { AppError, notFound } from '@/lib/errors'
import {
  isSupportedAttendanceTimezone,
  type SupportedAttendanceTimezone,
} from '@/lib/timezone'

export type AttendanceDb = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export interface EffectiveAttendanceSettings {
  timezone: SupportedAttendanceTimezone
  workStartTime: string
  workEndTime: string
}

export async function resolveEffectiveAttendanceSettings(
  db: AttendanceDb,
  companyId: string,
): Promise<EffectiveAttendanceSettings> {
  const [setting, company] = await Promise.all([
    db.attendanceSetting.findUnique({
      where: { companyId },
      select: { timezone: true, workStartTime: true, workEndTime: true },
    }),
    db.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { timezone: true },
    }),
  ])
  if (!company) throw notFound('법인 정보를 찾을 수 없습니다.')

  const timezone = setting?.timezone ?? company.timezone
  if (!isSupportedAttendanceTimezone(timezone)) {
    throw new AppError(
      400,
      'ATTENDANCE_TIMEZONE_UNSUPPORTED',
      '지원하지 않는 근태 타임존입니다.',
    )
  }

  return {
    timezone,
    workStartTime: setting?.workStartTime ?? '08:30',
    workEndTime: setting?.workEndTime ?? '17:30',
  }
}
