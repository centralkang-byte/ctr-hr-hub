import { type Metadata } from 'next'
import OneOnOneClient from './OneOnOneClient'

export const metadata: Metadata = { title: '1:1 미팅 | CTR HR Hub' }
export default function Page() { return <OneOnOneClient /> }
