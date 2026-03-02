import type { Metadata } from 'next'
import PeerReviewClient from './PeerReviewClient'

export const metadata: Metadata = { title: '360° 동료 평가 | CTR HR Hub' }
export default function Page() { return <PeerReviewClient /> }
