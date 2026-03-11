'use client'

import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/animations/variants'
import { TRANSITIONS } from '@/lib/animations/transitions'

export function AnimatedList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className={className}>
      {children}
    </motion.div>
  )
}

export function AnimatedListItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} transition={TRANSITIONS.fast} className={className}>
      {children}
    </motion.div>
  )
}
