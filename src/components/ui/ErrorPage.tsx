'use client'

import { AlertTriangle, FileQuestion, ShieldX, Home, ArrowLeft } from 'lucide-react'

type ErrorType = '404' | '500' | '403'

const ERROR_CONFIG: Record<ErrorType, { icon: typeof AlertTriangle; title: string; description: string; color: string }> = {
  '404': {
    icon: FileQuestion,
    title: '페이지를 찾을 수 없습니다',
    description: '요청하신 페이지가 존재하지 않거나 이동되었습니다.',
    color: 'text-amber-500',
  },
  '500': {
    icon: AlertTriangle,
    title: '서버 오류가 발생했습니다',
    description: '잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의하세요.',
    color: 'text-red-500',
  },
  '403': {
    icon: ShieldX,
    title: '접근 권한이 없습니다',
    description: '이 페이지에 대한 접근 권한이 없습니다. 권한이 필요하면 관리자에게 문의하세요.',
    color: 'text-rose-500',
  },
}

interface ErrorPageProps {
  type?: ErrorType
  title?: string
  description?: string
  showHomeButton?: boolean
  showBackButton?: boolean
}

export function ErrorPage({ type = '500', title, description, showHomeButton = true, showBackButton = true }: ErrorPageProps) {
  const config = ERROR_CONFIG[type]
  const Icon = config.icon
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <Icon className={`w-16 h-16 ${config.color} mb-6`} />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title || config.title}</h1>
      <p className="text-sm text-gray-500 text-center max-w-md mb-8">{description || config.description}</p>
      <div className="flex items-center gap-3">
        {showBackButton && (
          <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <ArrowLeft className="w-4 h-4" /> 뒤로 가기
          </button>
        )}
        {showHomeButton && (
          <a href="/home" className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90">
            <Home className="w-4 h-4" /> 홈으로
          </a>
        )}
      </div>
    </div>
  )
}
