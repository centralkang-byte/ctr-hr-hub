import { Suspense } from 'react'
import LoginPageContent from './LoginPageContent'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  )
}
