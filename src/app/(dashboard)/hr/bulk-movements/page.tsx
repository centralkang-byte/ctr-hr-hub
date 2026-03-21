import { Suspense } from 'react'
import BulkMovementsClient from './BulkMovementsClient'

export default function BulkMovementsPage() {
  return (
    <Suspense fallback={<div className="p-6">로딩 중...</div>}>
      <BulkMovementsClient />
    </Suspense>
  )
}
