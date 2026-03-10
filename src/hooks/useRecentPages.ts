'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — useRecentPages
// pathname 기반 최근 방문 페이지 추적 (localStorage, max 5)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RecentPage {
    path: string
    title: string
    timestamp: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ctr-recent-pages'
const MAX_RECENT = 5

// Paths to exclude from tracking
const EXCLUDED_PATHS = new Set(['/', '/login', '/api'])

function isExcluded(path: string): boolean {
    if (EXCLUDED_PATHS.has(path)) return true
    if (path.startsWith('/api/')) return true
    return false
}

// ─── Helper: derive a human-readable title from pathname ─────────────────────

const PATH_TITLES: Record<string, string> = {
    '/home': '홈',
    '/employees': '직원 관리',
    '/employees/new': '직원 등록',
    '/org': '조직 관리',
    '/directory': '구성원 디렉토리',
    '/attendance': '근태 관리',
    '/attendance/team': '팀 근태',
    '/attendance/admin': '전체 근태',
    '/leave': '휴가 관리',
    '/leave/admin': '휴가 관리 (관리자)',
    '/recruitment': '채용 관리',
    '/recruitment/board': '채용 칸반 보드',
    '/performance': '성과 관리',
    '/performance/mbo': 'MBO 목표',
    '/performance/evaluations': '성과 평가',
    '/performance/one-on-one': '1:1 미팅',
    '/performance/recognition': '칭찬/인정',
    '/payroll': '급여 관리',
    '/compensation': '연봉/보상',
    '/onboarding': '온보딩',
    '/offboarding': '퇴직 관리',
    '/training': '교육 관리',
    '/benefits': '복리후생',
    '/talent/succession': '승계 계획',
    '/analytics': '분석 대시보드',
    '/analytics/predictive': 'HR 예측 애널리틱스',
    '/discipline': '징계·포상',
    '/manager-hub': '매니저 허브',
    '/approvals/attendance': '승인함',
    '/settings': '설정',
    '/notifications': '알림',
    '/my/profile': '내 프로필',
    '/my/attendance': '내 근태',
    '/my/leave': '내 휴가',
    '/my/payroll': '내 급여',
    '/my/onboarding': '내 온보딩',
    '/my/offboarding': '내 퇴직 처리',
}

function deriveTitle(path: string): string {
    // Exact match
    if (PATH_TITLES[path]) return PATH_TITLES[path]
    // Dynamic segments — strip trailing ID
    const base = path.replace(/\/[a-f0-9-]{20,}$/, '')
    if (PATH_TITLES[base]) return PATH_TITLES[base]
    // Fallback: last segment capitalized
    const last = path.split('/').filter(Boolean).pop() ?? ''
    return last.charAt(0).toUpperCase() + last.slice(1)
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

function readStorage(): RecentPage[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? (JSON.parse(raw) as RecentPage[]) : []
    } catch {
        return []
    }
}

function writeStorage(pages: RecentPage[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pages))
    } catch {
        // ignore
    }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRecentPages() {
    const pathname = usePathname()
    const [recentPages, setRecentPages] = useState<RecentPage[]>([])

    // Hydrate from localStorage on mount
    useEffect(() => {
        setRecentPages(readStorage())
    }, [])

    // Track page visit on pathname change
    useEffect(() => {
        if (!pathname || isExcluded(pathname)) return

        const title = deriveTitle(pathname)
        const newEntry: RecentPage = { path: pathname, title, timestamp: Date.now() }

        setRecentPages((prev) => {
            const deduped = prev.filter((p) => p.path !== pathname)
            const updated = [newEntry, ...deduped].slice(0, MAX_RECENT)
            writeStorage(updated)
            return updated
        })
    }, [pathname])

    const addPage = useCallback((path: string, title: string) => {
        if (isExcluded(path)) return
        const newEntry: RecentPage = { path, title, timestamp: Date.now() }
        setRecentPages((prev) => {
            const deduped = prev.filter((p) => p.path !== path)
            const updated = [newEntry, ...deduped].slice(0, MAX_RECENT)
            writeStorage(updated)
            return updated
        })
    }, [])

    return { recentPages, addPage }
}
