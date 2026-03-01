import { NextRequest, NextResponse } from 'next/server'
import { locales, type Locale } from '@/i18n/config'

export async function POST(req: NextRequest) {
  try {
    const { locale } = (await req.json()) as { locale: string }

    if (!locales.includes(locale as Locale)) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
    }

    const res = NextResponse.json({ locale })
    res.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    })

    return res
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}
