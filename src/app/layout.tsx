// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Root Layout (Server Component)
// ═══════════════════════════════════════════════════════════

import type { Metadata } from 'next'
import localFont from 'next/font/local'
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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
