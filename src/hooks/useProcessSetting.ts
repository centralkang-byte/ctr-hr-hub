/**
 * useProcessSetting — reusable hook for process settings tabs
 * Fetches, saves, and reverts a single setting key from the process-settings API.
 *
 * IMPORTANT: `defaults` and `merge` are captured on first render only (via ref)
 * to prevent infinite useEffect loops from inline object/function references.
 */
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

interface UseProcessSettingOptions<T> {
  category: string   // e.g. 'payroll', 'attendance', 'performance', 'system'
  key: string        // e.g. 'kr-social-insurance', 'anomaly-thresholds'
  companyId: string | null
  defaults: T
  description?: string
  /** Custom merge function to handle mapping API values → local state */
  merge?: (apiValue: Record<string, unknown>, defaults: T) => T
}

interface UseProcessSettingReturn<T> {
  settings: T
  setSettings: React.Dispatch<React.SetStateAction<T>>
  original: T
  loading: boolean
  saving: boolean
  isOverridden: boolean
  hasChanges: boolean
  save: () => Promise<void>
  revert: () => void
}

export function useProcessSetting<T>(opts: UseProcessSettingOptions<T>): UseProcessSettingReturn<T> {
  const { category, key, companyId, defaults, description, merge } = opts

  // ─── Stabilize references to prevent infinite re-render loops ────
  // `defaults` and `merge` are typically inline object/function literals.
  // If placed in useCallback deps, they'd trigger re-fetch every render.
  // Capture on first render via ref; update ref silently on subsequent renders.
  const defaultsRef = useRef(defaults)
  const mergeRef = useRef(merge)
  defaultsRef.current = defaults
  mergeRef.current = merge

  const [settings, setSettings] = useState<T>(() => structuredClone(defaults))
  const [original, setOriginal] = useState<T>(() => structuredClone(defaults))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOverridden, setIsOverridden] = useState(false)

  // Track serialized original for change detection
  const originalRef = useRef(JSON.stringify(defaults))

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const qs = companyId ? `?key=${key}&companyId=${companyId}` : `?key=${key}`
      const res = await apiClient.get(`/api/v1/process-settings/${category}${qs}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (res as any)?.data ?? res ?? []
      const setting = Array.isArray(items) ? items[0] : null

      if (setting?.settingValue) {
        setIsOverridden(!!setting.isOverridden)
        const raw = setting.settingValue as Record<string, unknown>
        const mergeFn = mergeRef.current
        const defs = defaultsRef.current
        const merged = mergeFn ? mergeFn(raw, defs) : (raw as unknown as T)
        setSettings(structuredClone(merged))
        setOriginal(structuredClone(merged))
        originalRef.current = JSON.stringify(merged)
      } else {
        const defs = defaultsRef.current
        setSettings(structuredClone(defs))
        setOriginal(structuredClone(defs))
        originalRef.current = JSON.stringify(defs)
        setIsOverridden(false)
      }
    } catch {
      const defs = defaultsRef.current
      setSettings(structuredClone(defs))
      setOriginal(structuredClone(defs))
      originalRef.current = JSON.stringify(defs)
    } finally {
      setLoading(false)
    }
  // Only re-fetch when category, key, or companyId truly changes
  // defaults and merge are accessed via stable refs
  }, [category, key, companyId])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await apiClient.put(`/api/v1/process-settings/${category}`, {
        key,
        value: settings,
        companyId: companyId ?? undefined,
        description,
      })
      toast({ title: '저장되었습니다' })
      setOriginal(structuredClone(settings))
      originalRef.current = JSON.stringify(settings)
    } catch {
      toast({ title: '저장 실패', description: '다시 시도해 주세요.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [category, key, companyId, settings, description])

  const revert = useCallback(() => {
    setSettings(structuredClone(original))
    toast({ title: '변경을 취소했습니다' })
  }, [original])

  const hasChanges = JSON.stringify(settings) !== originalRef.current

  return {
    settings,
    setSettings,
    original,
    loading,
    saving,
    isOverridden,
    hasChanges,
    save,
    revert,
  }
}
