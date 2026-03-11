'use client'

import { MotionConfig } from 'framer-motion'

const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true'

export function AppMotionConfig({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig transition={isTestMode ? { duration: 0 } : undefined}>
      {children}
    </MotionConfig>
  )
}
