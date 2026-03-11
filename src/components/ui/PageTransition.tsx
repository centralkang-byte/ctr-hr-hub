'use client'

import { motion } from 'framer-motion'
import { fadeIn } from '@/lib/animations/variants'
import { TRANSITIONS } from '@/lib/animations/transitions'

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div {...fadeIn} transition={TRANSITIONS.slow}>
      {children}
    </motion.div>
  )
}
