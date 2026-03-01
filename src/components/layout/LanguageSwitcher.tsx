'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Language Switcher
// 법인별 main/sub 언어 전환 (쿠키 기반)
// ═══════════════════════════════════════════════════════════

import { useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { localeNames, localeFlags, type Locale } from '@/i18n/config'
import { getAvailableLocales } from '@/lib/i18n/locale-config'

interface LanguageSwitcherProps {
  countryCode: string
}

export function LanguageSwitcher({ countryCode }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const availableLocales = getAvailableLocales(countryCode)

  const handleLocaleChange = useCallback(
    (newLocale: Locale) => {
      if (newLocale === locale) return
      startTransition(async () => {
        await fetch('/api/v1/locale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: newLocale }),
        })
        router.refresh()
      })
    },
    [locale, router],
  )

  // Single language — hide switcher
  if (availableLocales.length <= 1) return null

  // Two languages — simple toggle button
  if (availableLocales.length === 2) {
    const otherLocale = availableLocales.find((l) => l !== locale) ?? availableLocales[1]!
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleLocaleChange(otherLocale)}
        disabled={isPending}
        className="gap-1.5 text-xs"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{localeFlags[otherLocale]} {localeNames[otherLocale]}</span>
      </Button>
    )
  }

  // 3+ languages — dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending} className="gap-1.5 text-xs">
          <Globe className="h-3.5 w-3.5" />
          <span>{localeFlags[locale]} {localeNames[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {availableLocales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => handleLocaleChange(l)}
            className={l === locale ? 'bg-accent' : ''}
          >
            <span className="mr-2">{localeFlags[l]}</span>
            {localeNames[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
