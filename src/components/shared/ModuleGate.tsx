'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — ModuleGate
// 모듈 활성화 체크 후 children 렌더 또는 fallback/null
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, type ReactNode } from 'react'

interface ModuleGateProps {
  module: string
  companyId: string
  children: ReactNode
  fallback?: ReactNode
}

export function ModuleGate({
  module,
  companyId,
  children,
  fallback = null,
}: ModuleGateProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkModule() {
      try {
        const res = await fetch(
          `/api/v1/tenant-settings/module-check?companyId=${companyId}&module=${module}`,
        )
        if (res.ok) {
          const data = (await res.json()) as { data: { enabled: boolean } }
          setEnabled(data.data.enabled)
        } else {
          setEnabled(false)
        }
      } catch {
        setEnabled(false)
      }
    }

    void checkModule()
  }, [companyId, module])

  // Still loading
  if (enabled === null) {
    return null
  }

  if (enabled) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
