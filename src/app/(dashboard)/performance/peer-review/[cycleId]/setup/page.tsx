import type { Metadata } from 'next'
import PeerNominationSetupClient from './PeerNominationSetupClient'

export const metadata: Metadata = { title: '동료 평가 지정 | CTR HR Hub' }
export default function Page() { return <PeerNominationSetupClient /> }
