// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Root Layout (Server Component)
// ═══════════════════════════════════════════════════════════

import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Providers } from '@/app/providers'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'CTR HR Hub',
  description: 'CTR 그룹 통합 인사관리 시스템 — Central to your safe mobility',
  manifest: '/manifest.json',
  themeColor: '#2563EB',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CTR HR Hub',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
