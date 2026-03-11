'use client'

import React from 'react'
import { BarChart3 } from 'lucide-react'

export function EmptyChart({ message = '데이터가 없습니다' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <BarChart3 className="h-8 w-8 text-gray-300" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}
