// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Custom Fields Helper (v3.2)
// 엔티티(employee/applicant 등)에 동적 필드 정의/값 관리
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { CustomFieldType } from '@/types'

// ─── Types ───────────────────────────────────────────────

export interface CustomFieldDefinition {
  id: string
  companyId: string
  entityType: string
  fieldKey: string
  fieldLabel: string
  fieldType: CustomFieldType
  isRequired: boolean
  options: unknown | null
  sortOrder: number
}

export interface CustomFieldWithValue extends CustomFieldDefinition {
  valueText: string | null
  valueNumber: number | null
  valueDate: Date | null
  valueBoolean: boolean | null
  valueJson: unknown | null
}

// ─── Get Custom Field Definitions ────────────────────────

export async function getCustomFields(
  companyId: string,
  entityType: string,
): Promise<CustomFieldDefinition[]> {
  const fields = await prisma.customField.findMany({
    where: {
      companyId,
      entityType,
      deletedAt: null,
    },
    orderBy: { sortOrder: 'asc' },
  })

  return fields.map((field) => ({
    id: field.id,
    companyId: field.companyId,
    entityType: field.entityType,
    fieldKey: field.fieldKey,
    fieldLabel: field.fieldLabel,
    fieldType: field.fieldType as CustomFieldType,
    isRequired: field.isRequired,
    options: field.options,
    sortOrder: field.sortOrder,
  }))
}

// ─── Get Custom Field Values ─────────────────────────────

export async function getCustomFieldValues(
  entityId: string,
): Promise<
  Record<
    string,
    {
      valueText: string | null
      valueNumber: unknown
      valueDate: Date | null
      valueBoolean: boolean | null
      valueJson: unknown
    }
  >
> {
  const values = await prisma.customFieldValue.findMany({
    where: {
      entityId,
    },
    include: {
      field: true,
    },
  })

  const result: Record<
    string,
    {
      valueText: string | null
      valueNumber: unknown
      valueDate: Date | null
      valueBoolean: boolean | null
      valueJson: unknown
    }
  > = {}
  for (const v of values) {
    result[v.field.fieldKey] = {
      valueText: v.valueText,
      valueNumber: v.valueNumber,
      valueDate: v.valueDate,
      valueBoolean: v.valueBoolean,
      valueJson: v.valueJson,
    }
  }
  return result
}

// ─── Get Fields with Values ──────────────────────────────

export async function getCustomFieldsWithValues(
  companyId: string,
  entityType: string,
  entityId: string,
): Promise<CustomFieldWithValue[]> {
  const fields = await getCustomFields(companyId, entityType)
  const values = await getCustomFieldValues(entityId)

  return fields.map((field) => {
    const val = values[field.fieldKey]
    return {
      ...field,
      valueText: val?.valueText ?? null,
      valueNumber: val?.valueNumber != null ? Number(val.valueNumber) : null,
      valueDate: val?.valueDate ?? null,
      valueBoolean: val?.valueBoolean ?? null,
      valueJson: val?.valueJson ?? null,
    }
  })
}

// ─── Save Custom Field Values ────────────────────────────

export async function saveCustomFieldValues(
  entityId: string,
  companyId: string,
  entityType: string,
  values: Record<string, { valueText?: string | null; valueNumber?: number | null; valueDate?: string | null; valueBoolean?: boolean | null }>,
): Promise<void> {
  // Get field definitions to validate
  const fieldKeys = Object.keys(values)

  const fields = await prisma.customField.findMany({
    where: {
      fieldKey: { in: fieldKeys },
      companyId,
      entityType,
      deletedAt: null,
    },
  })

  const fieldMap = new Map<string, string>()
  for (const field of fields) {
    fieldMap.set(field.fieldKey, field.id)
  }

  // Upsert each value
  const operations = fieldKeys
    .filter((key) => fieldMap.has(key))
    .map((key) => {
      const fieldId = fieldMap.get(key)!
      const val = values[key]

      return prisma.customFieldValue.upsert({
        where: {
          fieldId_entityId: {
            fieldId,
            entityId,
          },
        },
        update: {
          valueText: val.valueText ?? null,
          valueNumber: val.valueNumber ?? null,
          valueDate: val.valueDate ? new Date(val.valueDate) : null,
          valueBoolean: val.valueBoolean ?? null,
        },
        create: {
          fieldId,
          entityId,
          valueText: val.valueText ?? null,
          valueNumber: val.valueNumber ?? null,
          valueDate: val.valueDate ? new Date(val.valueDate) : null,
          valueBoolean: val.valueBoolean ?? null,
        },
      })
    })

  await prisma.$transaction(operations)
}

// ─── Delete Custom Field Values ──────────────────────────

export async function deleteCustomFieldValues(
  entityId: string,
): Promise<void> {
  await prisma.customFieldValue.deleteMany({
    where: {
      entityId,
    },
  })
}
