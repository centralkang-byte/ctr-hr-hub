import { redirect } from 'next/navigation'

// 루트 → /home 리디렉션.
// 미인증 사용자는 middleware에서 /login으로 리디렉션됨.
export default function RootPage() {
  redirect('/home')
}
