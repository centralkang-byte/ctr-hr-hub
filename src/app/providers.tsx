'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Root Providers
// SessionProvider + Toaster
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from '@/components/ui/toaster'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      {children}
      <Toaster />
    </SessionProvider>
  )
}
