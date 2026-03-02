import { type Metadata } from 'next'
import OneOnOneDetailClient from './OneOnOneDetailClient'

export const metadata: Metadata = { title: '1:1 미팅 기록 | CTR HR Hub' }
export default function Page() { return <OneOnOneDetailClient /> }
