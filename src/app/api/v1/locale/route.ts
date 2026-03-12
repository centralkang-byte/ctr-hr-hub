// PUBLIC: no auth required — pre-login i18n locale switching
import { NextRequest, NextResponse } from 'next/server'
import { locales, type Locale } from '@/i18n/config'
import { apiError } from '@/lib/api'
import { badRequest } from '@/lib/errors'

export async function POST(req: NextRequest) {
  try {
    const { locale } = (await req.json()) as { locale: string }

    if (!locales.includes(locale as Locale)) {
      return apiError(badRequest('Invalid locale'))
    }

    // Cookie 설정이 필요해 NextResponse 직접 사용
    const res = NextResponse.json({ data: { locale } })
    res.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    })

    return res
  } catch {
    return apiError(badRequest('Bad request'))
  }
}
