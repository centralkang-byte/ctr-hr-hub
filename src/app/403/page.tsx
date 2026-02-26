// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 403 Forbidden Page
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ctr-gray-50 px-4">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
          <ShieldAlert className="h-10 w-10 text-ctr-accent" />
        </div>
        <h1 className="text-4xl font-bold text-ctr-gray-900">403</h1>
        <h2 className="mt-2 text-xl font-semibold text-ctr-gray-700">
          접근 권한이 없습니다
        </h2>
        <p className="mt-2 text-sm text-ctr-gray-500">
          이 페이지에 접근할 권한이 없습니다.
          <br />
          관리자에게 문의하거나 홈으로 돌아가세요.
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
