import type { Metadata } from 'next'
import PulseSurveyClient from './PulseSurveyClient'

export const metadata: Metadata = { title: '펄스 서베이 | CTR HR Hub' }
export default function Page() { return <PulseSurveyClient /> }
