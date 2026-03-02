import type { Metadata } from 'next'
import PeerReviewResultsClient from './PeerReviewResultsClient'

export const metadata: Metadata = { title: '동료 평가 결과 | CTR HR Hub' }
export default function Page() { return <PeerReviewResultsClient /> }
