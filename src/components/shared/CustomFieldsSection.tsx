'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CustomFieldsSection
// 엔티티 폼 하단에 추가되는 커스텀 필드 섹션
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Types ──────────────────────────────────────────────────

interface CustomFieldDef {
  id: string
  fieldKey: string
  fieldLabel: string
  fieldType: string
  isRequired: boolean
  options: unknown
  sortOrder: number
}

interface CustomFieldValue {
  valueText: string | null
  valueNumber: unknown
  valueDate: Date | null
  valueBoolean: boolean | null
  valueJson: unknown
}

interface CustomFieldsSectionProps {
  companyId: string
  entityType: string
  entityId?: string
  mode: 'view' | 'edit'
  onChange?: (fieldKey: string, value: string | number | boolean | null) => void
}

// ─── Component ──────────────────────────────────────────────

export function CustomFieldsSection({
  companyId,
  entityType,
  entityId,
  mode,
  onChange,
}: CustomFieldsSectionProps) {
  const [fields, setFields] = useState<CustomFieldDef[]>([])
  const [values, setValues] = useState<Record<string, CustomFieldValue>>({})
  const [loading, setLoading] = useState(true)

  // Load field definitions and values
  useEffect(() => {
    async function loadFields() {
      setLoading(true)
      try {
        // Fetch field definitions
        const fieldRes = await fetch(
          `/api/v1/custom-fields?companyId=${companyId}&entityType=${entityType}`,
        )
        if (fieldRes.ok) {
          const fieldData = (await fieldRes.json()) as { data: CustomFieldDef[] }
          setFields(fieldData.data ?? [])
        }

        // Fetch values if entityId exists
        if (entityId) {
          const valRes = await fetch(
            `/api/v1/custom-fields/values?entityId=${entityId}`,
          )
          if (valRes.ok) {
            const valData = (await valRes.json()) as {
              data: Record<string, CustomFieldValue>
            }
            setValues(valData.data ?? {})
          }
        }
      } catch {
        // Silently fail — custom fields are optional
      } finally {
        setLoading(false)
      }
    }

    void loadFields()
  }, [companyId, entityType, entityId])

  const handleChange = useCallback(
    (fieldKey: string, value: string | number | boolean | null) => {
      onChange?.(fieldKey, value)
    },
    [onChange],
  )

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }

  if (fields.length === 0) {
    return null
  }

  // Get display value for view mode
  function getDisplayValue(field: CustomFieldDef): string {
    const val = values[field.fieldKey]
    if (!val) return '-'

    switch (field.fieldType) {
      case 'TEXT':
        return val.valueText ?? '-'
      case 'NUMBER':
        return val.valueNumber != null ? String(val.valueNumber) : '-'
      case 'DATE':
        return val.valueDate
          ? new Date(val.valueDate).toLocaleDateString('ko-KR')
          : '-'
      case 'BOOLEAN':
        return val.valueBoolean ? '예' : '아니오'
      case 'SELECT': {
        return val.valueText ?? '-'
      }
      default:
        return val.valueText ?? '-'
    }
  }

  // Get current value for edit mode
  function getCurrentValue(field: CustomFieldDef): string | number | boolean | null {
    const val = values[field.fieldKey]
    if (!val) return null

    switch (field.fieldType) {
      case 'TEXT':
      case 'SELECT':
        return val.valueText
      case 'NUMBER':
        return val.valueNumber != null ? Number(val.valueNumber) : null
      case 'DATE':
        return val.valueDate
          ? new Date(val.valueDate).toISOString().split('T')[0]
          : null
      case 'BOOLEAN':
        return val.valueBoolean
      default:
        return val.valueText
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground">추가 필드</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          if (mode === 'view') {
            return (
              <div key={field.id}>
                <Label className="text-xs text-muted-foreground">
                  {field.fieldLabel}
                </Label>
                <p className="mt-1 text-sm">{getDisplayValue(field)}</p>
              </div>
            )
          }

          // Edit mode — render by field type
          const currentVal = getCurrentValue(field)

          return (
            <div key={field.id}>
              <Label className="text-xs">
                {field.fieldLabel}
                {field.isRequired && (
                  <span className="ml-0.5 text-red-500">*</span>
                )}
              </Label>

              {field.fieldType === 'TEXT' && (
                <Input
                  className="mt-1"
                  defaultValue={typeof currentVal === 'string' ? currentVal : ''}
                  onChange={(e) => handleChange(field.fieldKey, e.target.value)}
                  required={field.isRequired}
                />
              )}

              {field.fieldType === 'NUMBER' && (
                <Input
                  className="mt-1"
                  type="number"
                  defaultValue={
                    typeof currentVal === 'number' ? currentVal : ''
                  }
                  onChange={(e) =>
                    handleChange(
                      field.fieldKey,
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  required={field.isRequired}
                />
              )}

              {field.fieldType === 'DATE' && (
                <Input
                  className="mt-1"
                  type="date"
                  defaultValue={typeof currentVal === 'string' ? currentVal : ''}
                  onChange={(e) =>
                    handleChange(field.fieldKey, e.target.value || null)
                  }
                  required={field.isRequired}
                />
              )}

              {field.fieldType === 'SELECT' && (
                <Select
                  defaultValue={typeof currentVal === 'string' ? currentVal : undefined}
                  onValueChange={(val) => handleChange(field.fieldKey, val)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(field.options) &&
                      (field.options as string[]).map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}

              {field.fieldType === 'BOOLEAN' && (
                <div className="mt-2 flex items-center gap-2">
                  <Checkbox
                    defaultChecked={
                      typeof currentVal === 'boolean' ? currentVal : false
                    }
                    onCheckedChange={(checked) =>
                      handleChange(field.fieldKey, checked === true)
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {field.fieldLabel}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
