'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offline Fallback Page
// ═══════════════════════════════════════════════════════════

import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-[#EDF1FE] rounded-full flex items-center justify-center mx-auto mb-6">
          <WifiOff size={36} className="text-[#5E81F4]" />
        </div>
        <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">
          오프라인 상태입니다
        </h1>
        <p className="text-[#666] mb-6">
          인터넷 연결이 끊어졌습니다.
          <br />
          네트워크 연결을 확인한 후 다시 시도해 주세요.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-[#5E81F4] text-white rounded-lg font-medium text-sm hover:bg-[#4B6DE0] transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}
