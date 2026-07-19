export interface SalaryBandCandidate {
  id: string
  jobGradeId: string
  jobCategoryId: string | null
  effectiveFrom: Date
}

/**
 * Resolve the deterministic band for an assignment snapshot.
 * A category-specific band wins over the grade-wide fallback; within the same
 * dimension, the latest effective band wins.
 */
export function selectSalaryBand<T extends SalaryBandCandidate>(
  bands: readonly T[],
  jobGradeId: string,
  jobCategoryId: string | null,
): T | undefined {
  return bands
    .filter((band) =>
      band.jobGradeId === jobGradeId &&
      (band.jobCategoryId === jobCategoryId || band.jobCategoryId === null),
    )
    .sort((left, right) => {
      const leftExact = left.jobCategoryId === jobCategoryId ? 1 : 0
      const rightExact = right.jobCategoryId === jobCategoryId ? 1 : 0
      return (
        rightExact - leftExact ||
        right.effectiveFrom.getTime() - left.effectiveFrom.getTime() ||
        left.id.localeCompare(right.id)
      )
    })[0]
}
