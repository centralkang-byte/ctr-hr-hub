import { describe, it, expect } from 'vitest'
import { pickLocaleLabel } from '@/lib/codeMaster'

describe('codeMaster.pickLocaleLabel', () => {
  const full = {
    label: '기혼',
    labelEn: 'Married',
    labelZh: '已婚',
    labelVi: 'Đã kết hôn',
    labelEs: 'Casado',
  }

  it('returns ko label by default', () => {
    expect(pickLocaleLabel(full, 'ko')).toBe('기혼')
  })

  it('returns locale-specific label when available', () => {
    expect(pickLocaleLabel(full, 'en')).toBe('Married')
    expect(pickLocaleLabel(full, 'zh')).toBe('已婚')
    expect(pickLocaleLabel(full, 'vi')).toBe('Đã kết hôn')
    expect(pickLocaleLabel(full, 'es')).toBe('Casado')
  })

  it('falls back to ko when locale label is null', () => {
    const koOnly = { label: '기혼', labelEn: null, labelZh: null, labelVi: null, labelEs: null }
    expect(pickLocaleLabel(koOnly, 'en')).toBe('기혼')
    expect(pickLocaleLabel(koOnly, 'zh')).toBe('기혼')
    expect(pickLocaleLabel(koOnly, 'vi')).toBe('기혼')
    expect(pickLocaleLabel(koOnly, 'es')).toBe('기혼')
  })

  it('falls back per-locale independently', () => {
    const partial = {
      label: '미혼',
      labelEn: 'Single',
      labelZh: null,
      labelVi: null,
      labelEs: 'Soltero',
    }
    expect(pickLocaleLabel(partial, 'en')).toBe('Single')
    expect(pickLocaleLabel(partial, 'zh')).toBe('미혼') // fallback
    expect(pickLocaleLabel(partial, 'es')).toBe('Soltero')
  })
})

