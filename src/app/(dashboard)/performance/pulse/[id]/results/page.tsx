import type { Metadata } from 'next'
import PulseResultsClient from './PulseResultsClient'

export const metadata: Metadata = { title: '설문 결과 | CTR HR Hub' }
export default function Page() { return <PulseResultsClient /> }
