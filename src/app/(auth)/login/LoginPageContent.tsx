'use client'

import { useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ko } from '@/lib/i18n/ko'

interface QAAccount {
  email: string
  name: string
  roleBadge: string
  color: string
}

interface QAGroup {
  group: string
  accounts: QAAccount[]
}

const QA_ACCOUNT_GROUPS: QAGroup[] = [
  {
    group: '전사관리',
    accounts: [
      { email: 'super@ctr.co.kr', name: '최상우 (전사관리)', roleBadge: 'SA', color: 'bg-purple-100 text-purple-700' },
    ],
  },
  {
    group: '인사팀',
    accounts: [
      { email: 'hr@ctr.co.kr', name: '한지영 (인사팀·KR)', roleBadge: 'HR', color: 'bg-primary/10 text-primary' },
      { email: 'hr@ctr-cn.com', name: '陈美玲 (人事部·CN)', roleBadge: 'HR', color: 'bg-primary/10 text-primary' },
    ],
  },
  {
    group: '생산기술팀 (KR)',
    accounts: [
      { email: 'manager@ctr.co.kr', name: '박준혁 (생산기술팀장)', roleBadge: 'MGR', color: 'bg-tertiary-container/20 text-tertiary' },
      { email: 'employee-a@ctr.co.kr', name: '이민준 (생산기술팀)', roleBadge: 'EMP', color: 'bg-muted text-foreground' },
      { email: 'employee-b@ctr.co.kr', name: '정다은 (생산기술팀)', roleBadge: 'EMP', color: 'bg-muted text-foreground' },
    ],
  },
  {
    group: '품질관리팀 (KR)',
    accounts: [
      { email: 'manager2@ctr.co.kr', name: '김서연 (품질관리팀장)', roleBadge: 'MGR', color: 'bg-tertiary-container/20 text-tertiary' },
      { email: 'employee-c@ctr.co.kr', name: '송현우 (품질관리팀)', roleBadge: 'EMP', color: 'bg-muted text-foreground' },
    ],
  },
]

const SHOW_TEST_ACCOUNTS = process.env.NEXT_PUBLIC_SHOW_TEST_ACCOUNTS?.trim() === 'true'

const SSO_ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: 'M365 로그인 시작 중 오류가 발생했습니다.',
  OAuthCallback: 'M365 인증 콜백 처리 중 오류가 발생했습니다.',
  OAuthCreateAccount: '계정 생성 중 오류가 발생했습니다.',
  Callback: '인증 콜백 오류가 발생했습니다.',
  AccessDenied: '이메일 또는 비밀번호가 올바르지 않습니다.',
  CredentialsSignin: '이메일 또는 비밀번호가 올바르지 않습니다.',
  TooManyAttempts: '로그인 시도가 너무 많습니다. 1분 후 다시 시도하세요.',
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
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-xl bg-white/10">
            <span className="text-3xl font-bold text-white">CTR</span>
          </div>
          <h1 className="mb-4 text-3xl font-bold text-white">CTR HR Hub</h1>
          <p className="mb-2 text-lg text-white/80">통합 인사관리 시스템</p>
          <p className="text-sm text-white/60">{ko.auth.slogan}</p>
        </div>
      </div>

      {/* ─── Right: Login Form ─── */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto bg-card p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-ctr-primary">
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
                <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* ── M365 SSO Button ── */}
              <Button
                onClick={handleM365Login}
                disabled={loadingId !== null}
                className="w-full bg-card text-[#333] border border-border hover:bg-muted shadow-sm"
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

              {/* ── QA Test Accounts (Dev Only) ── */}
              {SHOW_TEST_ACCOUNTS && (
                <>
                  <div className="relative py-1">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground whitespace-nowrap">
                      QA Test Accounts (Dev Only)
                    </span>
                  </div>

                  <div className="space-y-3">
                    {QA_ACCOUNT_GROUPS.map((group) => (
                      <div key={group.group}>
                        <p className="mb-1.5 ml-1 text-[11px] font-medium text-muted-foreground">
                          {group.group}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {group.accounts.map((account) => {
                            const isLoading = loadingId === account.email
                            return (
                              <button
                                key={account.email}
                                onClick={() => handleDevLogin(account.email)}
                                disabled={loadingId !== null}
                                className="group rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:border-primary hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${account.color}`}>
                                    {account.roleBadge}
                                  </span>
                                  {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                </div>
                                <div className="mt-1 text-xs font-medium text-foreground">{account.name}</div>
                                <div className="text-[10px] text-muted-foreground">{account.email}</div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Footer */}
              <div className="mt-4 rounded-lg bg-muted px-4 py-3 text-center">
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
