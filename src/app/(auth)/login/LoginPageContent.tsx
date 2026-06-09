'use client'

import { useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

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
      { email: 'super@ctr.co.kr', name: '대조영 (전사관리)', roleBadge: 'SA', color: 'bg-wt-4/15 text-wt-4' },
    ],
  },
  {
    group: '경영진',
    accounts: [
      { email: 'executive@ctr.co.kr', name: '강대표 (경영리더)', roleBadge: 'EXE', color: 'bg-wt-4/15 text-wt-4' },
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

const SSO_ERROR_CODES = [
  'OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount', 'Callback',
  'AccessDenied', 'CredentialsSignin', 'TooManyAttempts', 'Configuration',
] as const

export default function LoginPageContent() {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const t = useTranslations('auth')
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('error')
  const errorMessage = errorCode
    ? (SSO_ERROR_CODES.includes(errorCode as typeof SSO_ERROR_CODES[number])
        ? t(`ssoError.${errorCode as typeof SSO_ERROR_CODES[number]}`)
        : t('ssoError.fallback', { code: errorCode }))
    : null

  const handleM365Login = useCallback(() => {
    setLoadingId('m365')
    void signIn('azure-ad', { callbackUrl: '/home' })
  }, [])

  const handleDevLogin = useCallback((email: string) => {
    setLoadingId(email)
    void signIn('credentials', { email, callbackUrl: '/home' })
  }, [])

  return (
    <div className="flex min-h-screen bg-card">
      {/* ─── Left: CTR Branding ─── */}
      <div className="hidden flex-1 flex-col justify-between bg-ctr-primary p-16 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
            <span className="text-sm font-bold text-white tracking-tight">CTR</span>
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">CTR HR Hub</span>
        </div>

        <div className="max-w-lg">
          <h1 className="text-5xl xl:text-6xl font-bold text-white leading-[1.05] tracking-tighter">
            {t('integratedHrSystem')}
          </h1>
          <p className="mt-6 text-lg text-white/70 tracking-tight">{t('brandSlogan')}</p>
        </div>

        <p className="text-xs text-white/50 tracking-tight">© {new Date().getFullYear()} CTR Group</p>
      </div>

      {/* ─── Right: Login Form ─── */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-10 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-ctr-primary">
              <span className="text-xl font-bold text-white tracking-tight">CTR</span>
            </div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">CTR HR Hub</h1>
          </div>

          <Card className="border-0 shadow-none">
            <CardHeader className="px-0 pb-6 text-left">
              <CardTitle className="text-3xl font-bold tracking-tighter">{t('login')}</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground tracking-tight">
                {t('integratedHrSystem')}
              </p>
            </CardHeader>
            <CardContent className="space-y-4 px-0">
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
                className="w-full bg-[#2F2F2F] text-white hover:bg-[#1a1a1a] shadow-none border-0"
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
                {t('loginWithM365')}
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
              <p className="mt-6 text-center text-xs text-muted-foreground tracking-tight">
                {t.rich('contactHr', {
                  emphasis: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
                })}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
