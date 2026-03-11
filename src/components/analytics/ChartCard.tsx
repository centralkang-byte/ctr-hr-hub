'use client'

import React from 'react'
import { RefreshCw } from 'lucide-react'

interface ChartCardProps {
  title: string
  children: React.ReactNode
  loading?: boolean
  error?: string
  onRetry?: () => void
  className?: string
  badge?: string
  badgeColor?: string
}

export function ChartCard({ title, children, loading, error, onRetry, className = '', badge, badgeColor = 'bg-red-50 text-red-700 border-red-200' }: ChartCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full border ${badgeColor}`}>{badge}</span>
        )}
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-32 w-full bg-gray-100 rounded-lg" />
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-48 gap-2">
          <p className="text-sm text-gray-500">데이터를 불러올 수 없습니다</p>
          {onRetry && (
            <button onClick={onRetry} className="flex items-center gap-1 text-xs text-[#5E81F4] hover:text-[#4A6BD4] transition-colors">
              <RefreshCw className="h-3 w-3" /> 다시 시도
            </button>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  )
}
