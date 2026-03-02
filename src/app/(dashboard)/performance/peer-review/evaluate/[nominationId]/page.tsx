import type { Metadata } from 'next'
import PeerEvalFormClient from './PeerEvalFormClient'

export const metadata: Metadata = { title: '동료 평가 작성 | CTR HR Hub' }
export default function Page() { return <PeerEvalFormClient /> }
