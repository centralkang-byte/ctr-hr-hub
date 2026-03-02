import { type Metadata } from 'next'
import RecognitionClient from './RecognitionClient'

export const metadata: Metadata = { title: 'Recognition | CTR HR Hub' }
export default function Page() { return <RecognitionClient /> }
