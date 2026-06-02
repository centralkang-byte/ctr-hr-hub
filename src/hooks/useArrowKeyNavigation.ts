'use client'

import {
  type KeyboardEventHandler,
  useCallback,
  useEffect,
  useRef,
} from 'react'

// ─── Types ──────────────────────────────────────────────────

export interface UseArrowKeyNavigationOptions {
  orientation?: 'horizontal' | 'vertical'
  loop?: boolean
  rtl?: boolean
}

export interface UseArrowKeyNavigationReturn {
  onKeyDown: KeyboardEventHandler<HTMLElement>
  itemProps: (index: number) => {
    ref: (el: HTMLElement | null) => void
    tabIndex: 0 | -1
  }
}

interface ResolvedOptions {
  orientation: 'horizontal' | 'vertical'
  loop: boolean
  rtl: boolean
}

// ─── Constants ──────────────────────────────────────────────

const PAGE_STEP = 5

const HANDLED_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

// ─── Pure helper (exported for unit tests) ──────────────────

/**
 * Compute the next focusable index for roving tabindex navigation.
 * Returns `null` when the key is not a navigation key, or when the input is invalid
 * (empty list, out-of-range active index). Callers use `null` to skip preventDefault.
 *
 * WCAG 2.1 / WAI-ARIA Authoring Practices — radiogroup / tablist (horizontal | vertical).
 */
export function computeNextIndex(
  key: string,
  activeIndex: number,
  itemCount: number,
  options: ResolvedOptions,
): number | null {
  if (!HANDLED_KEYS.has(key)) return null
  if (itemCount <= 0) return null
  if (activeIndex < 0 || activeIndex >= itemCount) return null

  const { orientation, loop, rtl } = options
  const last = itemCount - 1

  const step = (direction: 1 | -1): number => {
    const raw = activeIndex + direction
    if (loop) {
      // wrap: (-1 → last), (last+1 → 0)
      return (raw + itemCount) % itemCount
    }
    return Math.min(last, Math.max(0, raw))
  }

  switch (key) {
    case 'Home':
      return 0
    case 'End':
      return last
    case 'PageUp':
      return Math.max(0, activeIndex - PAGE_STEP)
    case 'PageDown':
      return Math.min(last, activeIndex + PAGE_STEP)
    case 'ArrowLeft':
      if (orientation !== 'horizontal') return null
      return step(rtl ? 1 : -1)
    case 'ArrowRight':
      if (orientation !== 'horizontal') return null
      return step(rtl ? -1 : 1)
    case 'ArrowUp':
      if (orientation !== 'vertical') return null
      return step(-1)
    case 'ArrowDown':
      if (orientation !== 'vertical') return null
      return step(1)
    default:
      return null
  }
}

// ─── Hook ───────────────────────────────────────────────────

/**
 * Roving tabindex keyboard navigation for radiogroup / tablist patterns.
 * Returns an `onKeyDown` handler for the container plus `itemProps(index)` for
 * each focusable child. Focus follows `activeIndex` after the consumer commits
 * the change via `onIndexChange`.
 *
 * Consumer must set `role="radiogroup"` (or equivalent) + an accessible label
 * on the container, and `role="radio"` + `aria-checked` on each item.
 */
export function useArrowKeyNavigation(
  itemCount: number,
  activeIndex: number,
  onIndexChange: (idx: number) => void,
  options: UseArrowKeyNavigationOptions = {},
): UseArrowKeyNavigationReturn {
  const { orientation = 'horizontal', loop = true, rtl = false } = options

  const itemRefs = useRef<Array<HTMLElement | null>>([])
  const focusPendingRef = useRef<number | null>(null)

  const onKeyDown = useCallback<KeyboardEventHandler<HTMLElement>>(
    (event) => {
      const next = computeNextIndex(event.key, activeIndex, itemCount, {
        orientation,
        loop,
        rtl,
      })
      if (next === null) return
      event.preventDefault()
      if (next !== activeIndex) {
        focusPendingRef.current = next
        onIndexChange(next)
      } else {
        // No state change needed — focus directly (e.g. Home pressed while at 0).
        itemRefs.current[next]?.focus()
      }
    },
    [activeIndex, itemCount, orientation, loop, rtl, onIndexChange],
  )

  useEffect(() => {
    if (
      focusPendingRef.current !== null &&
      focusPendingRef.current === activeIndex
    ) {
      itemRefs.current[activeIndex]?.focus()
      focusPendingRef.current = null
    }
  }, [activeIndex])

  const itemProps = useCallback(
    (index: number) => ({
      ref: (el: HTMLElement | null) => {
        itemRefs.current[index] = el
      },
      tabIndex: (index === activeIndex ? 0 : -1) as 0 | -1,
    }),
    [activeIndex],
  )

  return { onKeyDown, itemProps }
}
