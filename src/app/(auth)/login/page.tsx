'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Login Page
// 좌: CTR 브랜딩 / 우: 로그인 폼 (M365 SSO + Dev 모드)
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Shield, Users, UserCircle, Briefcase, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ko } from '@/lib/i18n/ko'

// ─── Dev mode test accounts ─────────────────────────────────

interface TestAccount {
  label: string
  email: string
  icon: React.ReactNode
  description: string
}

const TEST_ACCOUNTS: TestAccount[] = [
  {
    label: 'Super Admin',
    email: 'superadmin@ctr.com',
    icon: <Shield className="h-4 w-4" />,
    description: '전체 시스템 관리자',
  },
  {
    label: 'HR Admin',
    email: 'hradmin@ctr.com',
    icon: <Users className="h-4 w-4" />,
    description: 'HR 관리자',
  },
  {
    label: 'Manager',
    email: 'manager@ctr.com',
    icon: <Briefcase className="h-4 w-4" />,
    description: '팀장',
  },
  {
    label: 'Employee',
    email: 'employee@ctr.com',
    icon: <UserCircle className="h-4 w-4" />,
    description: '일반 직원',
  },
]

// ─── Component ──────────────────────────────────────────────

export default function LoginPage() {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleM365Login = useCallback(() => {
    setLoadingId('m365')
    void signIn('azure-ad', { callbackUrl: '/' })
  }, [])

  const handleDevLogin = useCallback((email: string) => {
    setLoadingId(email)
    void signIn('credentials', {
      email,
      callbackUrl: '/',
    })
  }, [])

  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className="flex min-h-screen">
      {/* ─── Left: CTR Branding ─── */}
      <div className="hidden flex-1 flex-col items-center justify-center bg-ctr-primary p-12 lg:flex">
        <div className="max-w-md text-center">
          {/* Logo */}
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10">
            <span className="text-3xl font-bold text-white">CTR</span>
          </div>

          <h1 className="mb-4 text-3xl font-bold text-white">CTR HR Hub</h1>
          <p className="mb-2 text-lg text-white/80">
            통합 인사관리 시스템
          </p>
          <p className="text-sm text-white/60">{ko.auth.slogan}</p>

          {/* Decorative elements */}
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-white/5 p-4 text-left">
              <Users className="h-8 w-8 shrink-0 text-white/80" />
              <div>
                <p className="text-sm font-medium text-white">13개 법인 통합 관리</p>
                <p className="text-xs text-white/60">
                  한국 본사 + 해외 12개 법인 인사 데이터 통합
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-white/5 p-4 text-left">
              <Shield className="h-8 w-8 shrink-0 text-white/80" />
              <div>
                <p className="text-sm font-medium text-white">역할 기반 접근 제어</p>
                <p className="text-xs text-white/60">
                  RBAC 기반 세밀한 권한 관리 + 법인별 데이터 격리
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right: Login Form ─── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ctr-primary">
              <span className="text-2xl font-bold text-white">CTR</span>
            </div>
            <h1 className="text-xl font-bold text-ctr-primary">CTR HR Hub</h1>
          </div>

          <Card className="border-0 shadow-none lg:border lg:shadow-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">{ko.auth.login}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* M365 SSO Button */}
              <Button
                onClick={handleM365Login}
                disabled={loadingId !== null}
                className="w-full bg-ctr-primary hover:bg-ctr-primary/90"
                size="lg"
              >
                {loadingId === 'm365' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg
                    className="mr-2 h-5 w-5"
                    viewBox="0 0 21 21"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                  </svg>
                )}
                {ko.auth.loginWithM365}
              </Button>

              {/* Dev Mode Section */}
              {isDev && (
                <>
                  <div className="relative">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-muted-foreground">
                      개발 모드
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-center text-xs text-muted-foreground">
                      테스트 계정으로 로그인
                    </p>
                    {TEST_ACCOUNTS.map((account) => (
                      <Button
                        key={account.email}
                        variant="outline"
                        className="w-full justify-start gap-3"
                        disabled={loadingId !== null}
                        onClick={() => handleDevLogin(account.email)}
                      >
                        {loadingId === account.email ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          account.icon
                        )}
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium">{account.label}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {account.description}
                          </span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </>
              )}

              {/* Footer notice */}
              <p className="mt-4 text-center text-[10px] text-muted-foreground">
                {ko.auth.notRegistered}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
