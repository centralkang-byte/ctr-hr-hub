'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Root Providers
// SessionProvider + ThemeProvider + Toaster
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/components/theme-provider'
import { ServiceWorkerRegistrar } from '@/components/shared/ServiceWorkerRegistrar'
import { Toaster } from '@/components/ui/toaster'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ThemeProvider>
        {children}
        <Toaster />
        {/* Mounted at the root so /login, /pre-hire, /offline can also
            activate pending SW updates instead of stranding old workers. */}
        <ServiceWorkerRegistrar />
      </ThemeProvider>
    </SessionProvider>
  )
}
