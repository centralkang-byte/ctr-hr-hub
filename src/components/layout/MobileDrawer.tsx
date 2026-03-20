'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — MobileDrawer
// Slide-from-left overlay navigation drawer for mobile
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'

interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function MobileDrawer({ isOpen, onClose, children }: MobileDrawerProps) {
  const pathname = usePathname()

  // Close on route change
  useEffect(() => {
    if (isOpen) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Close on Escape + body scroll lock
  useEffect(() => {
    if (!isOpen) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 md:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-[280px] bg-white z-50
          transform transition-transform duration-200 ease-in-out md:hidden
          shadow-xl flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Close button (absolute positioned) */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3 z-10 p-1.5 rounded-lg text-[#8181A5] hover:bg-[#F5F5FA] transition-colors"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>

        {/* Sidebar content rendered as children */}
        {children}
      </aside>
    </>
  )
}
