'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PWA Install Banner (모바일 only)
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Only show on mobile
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (!isMobile) return

    // Check if already dismissed
    if (sessionStorage.getItem('pwa-banner-dismissed')) {
      setDismissed(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferredPrompt || dismissed) return null

  const handleInstall = async () => {
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem('pwa-banner-dismissed', 'true')
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
      <div className="bg-white rounded-xl shadow-lg border border-[#E8E8E8] p-4 flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-[#E8F5E9] rounded-lg flex items-center justify-center">
          <Download size={20} className="text-[#00C853]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1A1A1A]">CTR HR Hub 설치</p>
          <p className="text-xs text-[#666]">홈 화면에 추가하여 빠르게 접근하세요</p>
        </div>
        <button
          onClick={handleInstall}
          className="flex-shrink-0 px-3 py-1.5 bg-[#00C853] text-white text-sm font-medium rounded-lg hover:bg-[#00A844] transition-colors"
        >
          설치
        </button>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 text-[#999] hover:text-[#555]"
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
