import { prisma } from '@/lib/prisma'
import type { SettingType, ProcessSettingValue } from '@/types/process-settings'

// Returns company override if it exists, else global default, else null
export async function getProcessSetting(
  companyId: string,
  settingType: SettingType,
  settingKey: string
): Promise<ProcessSettingValue | null> {
  const [companyOverride, globalDefault] = await Promise.all([
    prisma.companyProcessSetting.findFirst({
      where: { companyId, settingType, settingKey },
    }),
    prisma.companyProcessSetting.findFirst({
      where: { companyId: null, settingType, settingKey },
    }),
  ])

  const row = companyOverride ?? globalDefault
  return row ? (row.settingValue as ProcessSettingValue) : null
}

// Get all settings for a type merged: global defaults, then company overrides on top
export async function getAllSettingsForType(
  companyId: string,
  settingType: SettingType
): Promise<Record<string, ProcessSettingValue>> {
  const rows = await prisma.companyProcessSetting.findMany({
    where: {
      settingType,
      OR: [{ companyId }, { companyId: null }],
    },
  })

  const merged: Record<string, ProcessSettingValue> = {}

  // Apply globals first, then company-specific overrides on top
  for (const row of rows.filter((r: { companyId: string | null }) => r.companyId === null)) {
    merged[row.settingKey] = row.settingValue as ProcessSettingValue
  }
  for (const row of rows.filter((r: { companyId: string | null }) => r.companyId !== null)) {
    merged[row.settingKey] = row.settingValue as ProcessSettingValue
  }

  return merged
}
