import { useEffect, useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — useAutoSave Hook
// 복잡한 폼의 데이터 손실 방지 — 1초 디바운스로 localStorage 자동 저장
// Phase 3: Session 3
// ═══════════════════════════════════════════════════════════

const DEBOUNCE_MS = 1000

interface UseAutoSaveReturn<T> {
  /** 저장된 초안 로드 (컴포넌트 마운트 시 호출) */
  loadSaved: () => T | null
  /** 저장된 초안 삭제 (폼 제출 성공 시 호출) */
  clearSaved: () => void
  /** 마지막 저장 시각 (null = 아직 저장 안 됨) */
  savedAt: Date | null
}

/**
 * 폼 데이터를 localStorage에 자동 저장하는 훅.
 *
 * @param formKey  고유 키 (예: `applicant-form-${postingId}`)
 * @param formData 저장할 폼 상태 객체
 */
export function useAutoSave<T extends object>(
  formKey: string,
  formData: T,
): UseAutoSaveReturn<T> {
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(formKey, JSON.stringify(formData))
        setSavedAt(new Date())
      } catch {
        // localStorage 쓰기 실패 (시크릿 모드 등) 시 무시
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, JSON.stringify(formData)])

  const loadSaved = (): T | null => {
    try {
      const raw = localStorage.getItem(formKey)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }

  const clearSaved = () => {
    try {
      localStorage.removeItem(formKey)
    } catch {
      // ignore
    }
    setSavedAt(null)
  }

  return { loadSaved, clearSaved, savedAt }
}
