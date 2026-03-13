'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — MobileBottomNav
// Mobile-only fixed bottom navigation bar (hidden on md+)
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, CheckSquare, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/home', icon: Home, label: '홈' },
  { href: '/attendance', icon: CalendarDays, label: '근태' },
  { href: '/approvals', icon: CheckSquare, label: '승인함' },
  { href: '/my', icon: User, label: '내 정보' },
] as const

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 w-full z-50 bg-white border-t border-[#F0F0F3] flex justify-around py-3 md:hidden">
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1 min-w-[56px]"
          >
            <Icon
              size={22}
              className={isActive ? 'text-[#4F46E5]' : 'text-[#8181A5]'}
              strokeWidth={isActive ? 2 : 1.5}
            />
            <span
              className={`text-[10px] font-medium ${
                isActive ? 'text-[#4F46E5]' : 'text-[#8181A5]'
              }`}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
