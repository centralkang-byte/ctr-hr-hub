'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — useFavorites Hook
// localStorage 기반 즐겨찾기 핀 관리
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'sidebar-favorites'
const MAX_FAVORITES = 8

// IA 리팩터링으로 제거된 nav item 키 → null(삭제) 매핑
// 앱 로드 시 localStorage에서 자동 정리
const DEPRECATED_NAV_KEYS = new Set([
  'my-directory',            // My Space → 제거 (중복)
  'my-org',                  // My Space → 제거 (중복)
  'my-internal-jobs',        // My Space → 채용 섹션으로 이동
  'my-notification-settings',// My Space → My Profile 탭으로
  'compliance-gdpr',         // Compliance → 허브 탭으로 흡수
  'data-retention',          // Compliance → 허브 탭으로 흡수
  'pii-audit',               // Compliance → 허브 탭으로 흡수
  'dpia',                    // Compliance → 허브 탭으로 흡수
  'compliance-kr',           // Compliance → 허브 탭으로 흡수
  'compliance-cn',           // Compliance → 허브 탭으로 흡수
  'compliance-ru',           // Compliance → 허브 탭으로 흡수
  'performance-goals',       // 성과/보상 → 허브 탭으로 흡수
  'performance-results',     // 성과/보상 → 허브 탭으로 흡수
  'peer-review',             // 성과/보상 → 허브 탭으로 흡수
  'people-directory',        // 인사 관리 → 제거 (직원관리 중복)
  'exit-interview-stats',    // 인사 관리 → 온보딩 탭으로 흡수
  'team-attendance',         // 팀 관리 → team-time으로 통합
  'team-leave',              // 팀 관리 → team-time으로 통합
  'manager-eval',            // 팀 관리 → 성과 허브로 흡수
  'leave-admin',             // 인사 관리 → leave-loa-admin으로 통합
  'loa-admin',               // 인사 관리 → leave-loa-admin으로 통합
])

function readFromStorage(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeToStorage(keys: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // storage write failed — silent
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])

  // Hydrate from localStorage on mount + 제거된 키 자동 정리
  useEffect(() => {
    const stored = readFromStorage()
    const cleaned = stored.filter((key) => !DEPRECATED_NAV_KEYS.has(key))
    if (cleaned.length !== stored.length) {
      writeToStorage(cleaned)
    }
    setFavorites(cleaned)
  }, [])

  const isFavorite = useCallback(
    (key: string) => favorites.includes(key),
    [favorites],
  )

  const toggleFavorite = useCallback((key: string) => {
    setFavorites((prev) => {
      let next: string[]
      if (prev.includes(key)) {
        next = prev.filter((k) => k !== key)
      } else {
        if (prev.length >= MAX_FAVORITES) {
          // Max reached — drop oldest (front of array)
          next = [...prev.slice(1), key]
        } else {
          next = [...prev, key]
        }
      }
      writeToStorage(next)
      return next
    })
  }, [])

  const reorderFavorites = useCallback((keys: string[]) => {
    setFavorites(keys)
    writeToStorage(keys)
  }, [])

  return { favorites, isFavorite, toggleFavorite, reorderFavorites }
}
