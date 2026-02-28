'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Login Page
// 좌: CTR 브랜딩 / 우: 로그인 폼 (M365 SSO + 테스트 계정)
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { signIn } from 'next-auth/react'
import { ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ko } from '@/lib/i18n/ko'

// ─── Test accounts ───────────────────────────────────────

interface TestAccount {
  name: string
  role: string
  roleBadgeClass: string
  email: string
}

const TEST_ACCOUNTS: TestAccount[] = [
  {
    name: '이시스템',
    role: '시스템 관리자',
    roleBadgeClass: 'bg-purple-100 text-purple-700',
    email: 'admin@ctr.co.kr',
  },
  {
    name: '김인사',
    role: 'HR 담당자',
    roleBadgeClass: 'bg-blue-100 text-blue-700',
    email: 'hr@ctr.co.kr',
  },
  {
    name: '박매니저',
    role: '팀장',
    roleBadgeClass: 'bg-amber-100 text-amber-700',
    email: 'manager@ctr.co.kr',
  },
  {
    name: '최사원',
    role: '직원',
    roleBadgeClass: 'bg-gray-100 text-gray-600',
    email: 'employee@ctr.co.kr',
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
    void signIn('credentials', { email, callbackUrl: '/' })
  }, [])

  return (
    <div className="flex min-h-screen">
      {/* ─── Left: CTR Branding ─── */}
      <div className="hidden flex-1 flex-col items-center justify-center bg-ctr-primary p-12 lg:flex">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10">
            <span className="text-3xl font-bold text-white">CTR</span>
          </div>
          <h1 className="mb-4 text-3xl font-bold text-white">CTR HR Hub</h1>
          <p className="mb-2 text-lg text-white/80">통합 인사관리 시스템</p>
          <p className="text-sm text-white/60">{ko.auth.slogan}</p>
        </div>
      </div>

      {/* ─── Right: Login Form ─── */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto bg-white p-8">
        <div className="w-full max-w-md">
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
              {/* ── M365 SSO Button ── */}
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

              {/* ── Test Accounts ── */}
              <div className="relative py-1">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-muted-foreground whitespace-nowrap">
                  테스트 계정으로 빠른 로그인
                </span>
              </div>

              <div className="space-y-2">
                {TEST_ACCOUNTS.map((account) => {
                  const isLoading = loadingId === account.email
                  return (
                    <button
                      key={account.email}
                      onClick={() => handleDevLogin(account.email)}
                      disabled={loadingId !== null}
                      className="group w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {account.name}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${account.roleBadgeClass}`}
                            >
                              {account.role}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{account.email}</p>
                        </div>
                        <div className="flex items-center gap-0.5 text-xs text-muted-foreground transition-colors group-hover:text-gray-700">
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <span>클릭으로 입력</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Footer */}
              <p className="text-center text-[10px] text-muted-foreground">
                {ko.auth.notRegistered}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
