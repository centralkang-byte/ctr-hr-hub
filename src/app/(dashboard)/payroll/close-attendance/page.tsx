import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import CloseAttendanceClient from './CloseAttendanceClient'

export const metadata = {
    title: '근태 마감 | CTR HR Hub',
    description: '월별 근태를 마감하여 급여 계산을 시작합니다.',
}

export default async function CloseAttendancePage() {
    const session = await getServerSession(authOptions)
    if (!session?.user) redirect('/login')
    const user = session.user as SessionUser
    return <CloseAttendanceClient user={user} />
}
