'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — QuickActionsMenu
// 헤더 (+) 버튼 → 역할별 빠른 실행 드롭다운
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
    Plus,
    UserPlus,
    CalendarDays,
    Briefcase,
    MessageSquare,
    Heart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Role hierarchy ──────────────────────────────────────────────────────────

const ROLE_LEVEL: Record<string, number> = {
    EMPLOYEE: 1,
    MANAGER: 2,
    HR_ADMIN: 3,
    SUPER_ADMIN: 4,
}

function hasMinRole(userRole: string, minRole: string): boolean {
    return (ROLE_LEVEL[userRole] ?? 0) >= (ROLE_LEVEL[minRole] ?? 99)
}

// ─── Action definitions ─────────────────────────────────────────────────────

interface QuickAction {
    labelKey: string
    icon: React.ElementType
    route: string
    minRole: string
}

const QUICK_ACTIONS: QuickAction[] = [
    {
        labelKey: 'registerEmployee',
        icon: UserPlus,
        route: '/employees/new',
        minRole: 'HR_ADMIN',
    },
    {
        labelKey: 'requestLeave',
        icon: CalendarDays,
        route: '/leave?action=new',
        minRole: 'EMPLOYEE',
    },
    {
        labelKey: 'createPosting',
        icon: Briefcase,
        route: '/recruitment/new',
        minRole: 'HR_ADMIN',
    },
    {
        labelKey: 'scheduleOneOnOne',
        icon: MessageSquare,
        route: '/performance/one-on-one?action=new',
        minRole: 'MANAGER',
    },
    {
        labelKey: 'sendRecognition',
        icon: Heart,
        route: '/performance/recognition?action=new',
        minRole: 'EMPLOYEE',
    },
]

// ─── Component ───────────────────────────────────────────────────────────────

interface QuickActionsMenuProps {
    userRole: string
}

export function QuickActionsMenu({ userRole }: QuickActionsMenuProps) {
    const router = useRouter()
    const t = useTranslations('header')
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Filter actions by role
    const visibleActions = QUICK_ACTIONS.filter((action) =>
        hasMinRole(userRole, action.minRole),
    )

    // Close on outside click
    useEffect(() => {
        if (!open) return
        const handleClick = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    // Close on Escape
    useEffect(() => {
        if (!open) return
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [open])

    const handleAction = (route: string) => {
        setOpen(false)
        router.push(route)
    }

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger */}
            <Button
                variant="ghost"
                size="icon"
                aria-label={t('quickActions')}
                title={t('quickActions')}
                onClick={() => setOpen((v) => !v)}
                className="relative rounded-full !bg-primary/10 text-primary hover:!bg-primary/20"
            >
                <Plus className="h-5 w-5" strokeWidth={1.5} />
            </Button>

            {/* Dropdown */}
            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-xl border border-border bg-card p-2 shadow-lg"
                >
                    {/* Header */}
                    <p className="mb-1 px-3 pb-1 pt-0.5 text-xs font-medium text-muted-foreground">
                        {t('quickActions')}
                    </p>

                    {/* Divider */}
                    <div className="mb-1 border-t border-border" />

                    {/* Actions */}
                    {visibleActions.map((action) => {
                        const Icon = action.icon
                        return (
                            <button
                                key={action.labelKey}
                                type="button"
                                role="menuitem"
                                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
                                onClick={() => handleAction(action.route)}
                            >
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span>{t(`actions.${action.labelKey}`)}</span>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
