import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { locales, defaultLocale, type Locale } from './config'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get('NEXT_LOCALE')?.value
  const locale: Locale = raw && locales.includes(raw as Locale)
    ? (raw as Locale)
    : defaultLocale

  const messages = (await import(`../../messages/${locale}.json`)).default

  return { locale, messages }
})
