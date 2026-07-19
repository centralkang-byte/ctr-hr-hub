import { describe, expect, it } from 'vitest'
import { selectSalaryBand } from '@/lib/payroll/salary-band'

const band = (
  id: string,
  jobCategoryId: string | null,
  effectiveFrom: string,
) => ({
  id,
  jobGradeId: 'GRADE-1',
  jobCategoryId,
  effectiveFrom: new Date(effectiveFrom),
})

describe('selectSalaryBand', () => {
  it('prefers the assignment category over a newer generic fallback', () => {
    const selected = selectSalaryBand(
      [
        band('generic', null, '2026-07-01'),
        band('category', 'ENGINEERING', '2026-01-01'),
      ],
      'GRADE-1',
      'ENGINEERING',
    )

    expect(selected?.id).toBe('category')
  })

  it('uses the latest generic band when no category-specific band exists', () => {
    const selected = selectSalaryBand(
      [
        band('old', null, '2025-01-01'),
        band('new', null, '2026-01-01'),
        band('other-category', 'SALES', '2026-07-01'),
      ],
      'GRADE-1',
      'ENGINEERING',
    )

    expect(selected?.id).toBe('new')
  })
})
