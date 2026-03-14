'use client'

import { useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ko } from '@/lib/i18n/ko'

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
    roleBadgeClass: 'bg-[#F3E8FF] text-[#7E22CE]',
    email: 'admin@ctr.co.kr',
  },
  {
    name: '김인사',
    role: 'HR 담당자',
    roleBadgeClass: 'bg-[#EDF1FE] text-[#4B6DE0]',
    email: 'hr@ctr.co.kr',
  },
  {
    name: '박매니저',
    role: '팀장',
    roleBadgeClass: 'bg-[#FEF3C7] text-[#B45309]',
    email: 'manager@ctr.co.kr',
  },
  {
    name: '최사원',
    role: '직원',
    roleBadgeClass: 'bg-[#F5F5F5] text-[#555]',
    email: 'employee@ctr.co.kr',
  },
]

const SHOW_TEST_ACCOUNTS = process.env.NEXT_PUBLIC_SHOW_TEST_ACCOUNTS?.trim() === 'true'

const SSO_ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: 'M365 로그인 시작 중 오류가 발생했습니다.',
  OAuthCallback: 'M365 인증 콜백 처리 중 오류가 발생했습니다.',
  OAuthCreateAccount: '계정 생성 중 오류가 발생했습니다.',
  Callback: '인증 콜백 오류가 발생했습니다.',
  AccessDenied: '접근이 거부되었습니다. 등록된 직원인지 확인하세요.',
  Configuration: '서버 설정 오류입니다. 관리자에게 문의하세요.',
}

export default function LoginPageContent() {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('error')
  const errorMessage = errorCode ? (SSO_ERROR_MESSAGES[errorCode] ?? `로그인 오류: ${errorCode}`) : null

  const handleM365Login = useCallback(() => {
    setLoadingId('m365')
    void signIn('azure-ad', { callbackUrl: '/home' })
  }, [])

  const handleDevLogin = useCallback((email: string) => {
    setLoadingId(email)
    void signIn('credentials', { email, callbackUrl: '/home' })
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

          <Card className="border-0 shadow-none lg:border lg:">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">{ko.auth.login}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ── Error Message ── */}
              {errorMessage && (
                <div className="flex items-start gap-2 rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-3 py-2.5 text-sm text-[#B91C1C]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* ── M365 SSO Button ── */}
              <Button
                onClick={handleM365Login}
                disabled={loadingId !== null}
                className="w-full bg-white text-[#333] border border-[#D4D4D4] hover:bg-[#F5F5FA] shadow-sm"
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

              {/* ── Test Accounts (개발/데모 전용) ── */}
              {SHOW_TEST_ACCOUNTS && (
                <>
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
                          className="group w-full rounded-xl border border-[#E8E8E8] bg-white px-4 py-3 text-left transition-colors hover:border-[#D4D4D4] hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-[#1A1A1A]">
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
                            <div className="flex items-center gap-0.5 text-xs text-muted-foreground transition-colors group-hover:text-[#333]">
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
                </>
              )}

              {/* Footer */}
              <div className="mt-4 rounded-lg bg-[#F5F5FA] px-4 py-3 text-center">
                <p className="text-xs text-[#555]">
                  계정이 없거나 로그인이 불가한 경우 <span className="font-semibold text-[#333]">HR 담당자</span>에게 문의해주세요.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
