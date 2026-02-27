/**
 * EMS 9-Block Grid 계산 유틸리티
 *
 * 9-Block Grid는 두 축으로 직원을 매핑합니다:
 * - X축: 역량 (A=Low, B=Mid, C=High)
 * - Y축: 성과 (1=Low, 2=Mid, 3=High)
 *
 * 블록 번호 매핑 (스펙 기준):
 * 1=1A, 2=2A, 3=3A, 4=1B, 5=2B, 6=3B, 7=1C, 8=2C, 9=3C
 */

/** EMS 블록 계산 결과 */
export interface EmsBlockResult {
  /** 블록 코드 (예: "3C", "2B", "1A") */
  block: string
  /** 블록 번호 (1~9) */
  blockNumber: number
  /** 블록 라벨 (예: "Star", "Solid Contributor") */
  label: string
  /** 블록 색상 */
  color: string
  /** 성과 등급 */
  performanceBand: 'Low' | 'Mid' | 'High'
  /** 역량 등급 */
  competencyBand: 'Low' | 'Mid' | 'High'
}

/** 블록 정의 (시드 데이터에서 가져옴) */
export interface BlockDefinition {
  /** 행 번호 (1=Low, 2=Mid, 3=High 성과) */
  row: number
  /** 열 코드 (A=Low, B=Mid, C=High 역량) */
  col: string
  /** 블록 라벨명 */
  label: string
  /** 블록 색상 */
  color: string
}

/** 기본 임계값: [0, 2.33, 3.67, 5.01] */
const DEFAULT_THRESHOLDS: readonly number[] = [0, 2.33, 3.67, 5.01]

/**
 * 블록 번호 매핑 테이블
 * row(성과) × col(역량) → blockNumber
 * 1=1A, 2=2A, 3=3A, 4=1B, 5=2B, 6=3B, 7=1C, 8=2C, 9=3C
 */
const BLOCK_NUMBER_MAP: Record<string, number> = {
  '1A': 1,
  '2A': 2,
  '3A': 3,
  '1B': 4,
  '2B': 5,
  '3B': 6,
  '1C': 7,
  '2C': 8,
  '3C': 9,
}

/** 열 코드 → 역량 등급 매핑 */
const COL_TO_BAND: Record<string, 'Low' | 'Mid' | 'High'> = {
  A: 'Low',
  B: 'Mid',
  C: 'High',
}

/** 행 번호 → 성과 등급 매핑 */
const ROW_TO_BAND: Record<number, 'Low' | 'Mid' | 'High'> = {
  1: 'Low',
  2: 'Mid',
  3: 'High',
}

/**
 * 점수를 임계값 기준으로 등급(1, 2, 3)으로 변환합니다.
 *
 * @param score - 평가 점수
 * @param thresholds - 임계값 배열 [min, low→mid, mid→high, max]
 * @returns 등급 (1=Low, 2=Mid, 3=High)
 */
function scoreToBand(score: number, thresholds: readonly number[]): number {
  if (score < thresholds[1]) return 1
  if (score < thresholds[2]) return 2
  return 3
}

/**
 * 행 번호를 열 코드(A, B, C)로 변환합니다.
 * 역량 등급: 1→A(Low), 2→B(Mid), 3→C(High)
 *
 * @param band - 등급 (1, 2, 3)
 * @returns 열 코드 ("A", "B", "C")
 */
function bandToCol(band: number): string {
  switch (band) {
    case 1:
      return 'A'
    case 2:
      return 'B'
    case 3:
      return 'C'
    default:
      return 'B'
  }
}

/**
 * EMS 9-Block Grid에서 직원의 블록을 계산합니다.
 *
 * 성과 점수와 역량 점수를 기반으로 9개 블록 중 해당하는 블록을 반환합니다.
 * 임계값 기본값은 [0, 2.33, 3.67, 5.01]입니다.
 *
 * @param performanceScore - 성과 점수 (0~5)
 * @param competencyScore - 역량 점수 (0~5)
 * @param blockDefinitions - 블록 정의 배열 (시드 데이터)
 * @param performanceThresholds - 성과 임계값 (기본: [0, 2.33, 3.67, 5.01])
 * @param competencyThresholds - 역량 임계값 (기본: [0, 2.33, 3.67, 5.01])
 * @returns EMS 블록 계산 결과
 */
export function calculateEmsBlock(
  performanceScore: number,
  competencyScore: number,
  blockDefinitions: BlockDefinition[],
  performanceThresholds?: number[],
  competencyThresholds?: number[],
): EmsBlockResult {
  const perfThresholds = performanceThresholds ?? DEFAULT_THRESHOLDS
  const compThresholds = competencyThresholds ?? DEFAULT_THRESHOLDS

  // 점수를 등급(1~3)으로 변환
  const perfBand = scoreToBand(performanceScore, perfThresholds)
  const compBand = scoreToBand(competencyScore, compThresholds)

  // 행(성과)과 열(역량) 결정
  const row = perfBand
  const col = bandToCol(compBand)

  // 블록 코드 생성 (예: "3C")
  const block = `${row}${col}`

  // 블록 번호 조회
  const blockNumber = BLOCK_NUMBER_MAP[block] ?? 5

  // 블록 정의에서 라벨과 색상 조회
  const definition = blockDefinitions.find(
    (d) => d.row === row && d.col === col,
  )

  const label = definition?.label ?? 'Unknown'
  const color = definition?.color ?? 'gray'

  return {
    block,
    blockNumber,
    label,
    color,
    performanceBand: ROW_TO_BAND[row] ?? 'Mid',
    competencyBand: COL_TO_BAND[col] ?? 'Mid',
  }
}

/**
 * 동료 평가를 반영하여 역량 점수를 보정합니다.
 *
 * 가중 평균 방식으로 기존 역량 점수에 동료 평가 점수를 반영합니다.
 * 기본 동료 평가 가중치는 0.3 (30%)입니다.
 *
 * @param competencyScore - 기존 역량 점수 (0~5)
 * @param peerReviewAvg - 동료 평가 평균 점수 (0~5)
 * @param peerWeight - 동료 평가 가중치 (기본: 0.3)
 * @returns 보정된 역량 점수
 */
export function adjustCompetencyWithPeerReview(
  competencyScore: number,
  peerReviewAvg: number,
  peerWeight: number = 0.3,
): number {
  const selfWeight = 1 - peerWeight
  const adjusted = competencyScore * selfWeight + peerReviewAvg * peerWeight

  // 소수점 둘째 자리까지 반올림
  return Math.round(adjusted * 100) / 100
}
