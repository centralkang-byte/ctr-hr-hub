'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — useFavorites Hook
// localStorage 기반 즐겨찾기 핀 관리
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'sidebar-favorites'
const MAX_FAVORITES = 8

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

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    setFavorites(readFromStorage())
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
