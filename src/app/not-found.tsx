// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 404 Not Found Page
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ctr-gray-50 px-4">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
          <FileQuestion className="h-10 w-10 text-ctr-primary" />
        </div>
        <h1 className="text-4xl font-bold text-ctr-gray-900">404</h1>
        <h2 className="mt-2 text-xl font-semibold text-ctr-gray-700">
          페이지를 찾을 수 없습니다
        </h2>
        <p className="mt-2 text-sm text-ctr-gray-500">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
          <br />
          URL을 확인하거나 홈으로 돌아가세요.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button className="bg-ctr-primary hover:bg-ctr-primary/90">
              홈으로 돌아가기
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
