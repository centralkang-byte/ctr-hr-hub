import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function SettingsHubPage() {
  let session
  try {
    session = await getServerSession(authOptions)
  } catch (err) {
    console.error('[settings] getServerSession failed:', err)
    redirect('/login')
  }
  if (!session?.user) redirect('/login')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#1C1D21]">설정</h1>
      <p className="text-sm text-[#8181A5]">시스템 설정을 카테고리별로 관리합니다</p>
      <p className="mt-4 text-xs text-[#8181A5]">User: {session.user.email}</p>
    </div>
  )
}

