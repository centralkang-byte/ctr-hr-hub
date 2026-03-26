import { Suspense } from 'react'
import CompensationClient from './CompensationClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default function CompensationPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <CompensationClient />
    </Suspense>
  )
}
