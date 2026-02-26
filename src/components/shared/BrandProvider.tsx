'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — BrandProvider
// 테넌트 브랜딩 CSS 변수 주입 Provider
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_BRAND_COLORS } from '@/lib/constants'
import type { BrandColors } from '@/types'

interface BrandProviderProps {
  companyId: string
  children: ReactNode
}

export function BrandProvider({ companyId, children }: BrandProviderProps) {
  const [colors, setColors] = useState<BrandColors>({
    primary: DEFAULT_BRAND_COLORS.primary,
    secondary: DEFAULT_BRAND_COLORS.secondary,
    accent: DEFAULT_BRAND_COLORS.accent,
  })

  useEffect(() => {
    async function loadBrandColors() {
      try {
        const res = await fetch(
          `/api/v1/tenant-settings/brand-colors?companyId=${companyId}`,
        )
        if (res.ok) {
          const data = (await res.json()) as { data: BrandColors }
          if (data.data) {
            setColors(data.data)
          }
        }
      } catch {
        // Use defaults on error
      }
    }

    void loadBrandColors()
  }, [companyId])

  const style = {
    '--brand-primary': colors.primary,
    '--brand-secondary': colors.secondary ?? DEFAULT_BRAND_COLORS.secondary,
    '--brand-accent': colors.accent,
  } as React.CSSProperties

  return <div style={style}>{children}</div>
}
