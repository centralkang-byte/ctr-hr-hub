import type { Metadata } from 'next'
import PulseRespondClient from './PulseRespondClient'

export const metadata: Metadata = { title: '설문 응답 | CTR HR Hub' }
export default function Page() { return <PulseRespondClient /> }
