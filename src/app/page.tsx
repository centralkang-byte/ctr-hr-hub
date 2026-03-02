import { redirect } from 'next/navigation'

// 루트는 항상 /login으로 리디렉션.
// 로그인 성공 시 NextAuth callbackUrl(=/employees)로 이동.
export default function RootPage() {
  redirect('/login')
}
