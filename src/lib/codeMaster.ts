// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Code Master Helpers (IS_SY02 호환)
// 운영자 자력 관리 코드 마스터 조회/검증 헬퍼
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { notFound, badRequest } from '@/lib/errors'

export type SupportedLocale = 'ko' | 'en' | 'zh' | 'vi' | 'es'

export interface CodeItemView {
  code: string
  label: string
  sortOrder: number
  isActive: boolean
  reference1: string | null
  reference2: string | null
  reference3: string | null
  reference4: string | null
  reference5: string | null
}

interface ListOptions {
  activeOnly?: boolean
  locale?: SupportedLocale
}

/**
 * 참고: 시계열 활성(startDate/endDate) 필터링은 의도적으로 이 helper 에서 제외.
 * 멀티-타임존 환경(13개 법인 × 5개 timezone)에서 cutoff 결정이 비결정적이라 별도 설계 필요.
 * 시계열 활성이 필요한 호출자는 startDate/endDate 컬럼을 직접 조회·비교할 것.
 * 현재 helper 는 isActive flag 만 사용.
 */

/**
 * 그룹 + 코드로 단일 코드 라벨 조회. 로케일 미지정/누락 시 ko 폴백.
 * 코드를 찾을 수 없으면 throw — 부재 무시가 필요하면 try/catch.
 */
export async function getCodeLabel(
  groupCode: string,
  itemCode: string,
  locale: SupportedLocale = 'ko',
): Promise<string> {
  const item = await prisma.codeItem.findFirst({
    where: {
      code: itemCode,
      group: { code: groupCode },
    },
    select: { label: true, labelEn: true, labelZh: true, labelVi: true, labelEs: true },
  })

  if (!item) {
    throw notFound(`코드를 찾을 수 없습니다. (group=${groupCode}, code=${itemCode})`)
  }

  return pickLocaleLabel(item, locale)
}

/**
 * 그룹 코드로 코드 리스트 조회.
 * activeOnly=true (기본) 면 isActive + 시계열 활성 (asOf 기준) 만 반환.
 * sortOrder 오름차순 정렬.
 */
export async function listCodes(
  groupCode: string,
  options: ListOptions = {},
): Promise<CodeItemView[]> {
  const { activeOnly = true, locale = 'ko' } = options

  const items = await prisma.codeItem.findMany({
    where: {
      group: { code: groupCode },
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: { sortOrder: 'asc' },
    select: {
      code: true,
      label: true,
      labelEn: true,
      labelZh: true,
      labelVi: true,
      labelEs: true,
      sortOrder: true,
      isActive: true,
      reference1: true,
      reference2: true,
      reference3: true,
      reference4: true,
      reference5: true,
    },
  })

  return items.map((it) => ({
    code: it.code,
    label: pickLocaleLabel(it, locale),
    sortOrder: it.sortOrder,
    isActive: it.isActive,
    reference1: it.reference1,
    reference2: it.reference2,
    reference3: it.reference3,
    reference4: it.reference4,
    reference5: it.reference5,
  }))
}

/**
 * 외부 시스템 매핑 값(reference1~5) 조회. 레거시 ERP 코드 → 내부 코드 변환에 사용.
 */
export async function getCodeRef(
  groupCode: string,
  itemCode: string,
  referenceIndex: 1 | 2 | 3 | 4 | 5,
): Promise<string | null> {
  if (referenceIndex < 1 || referenceIndex > 5) {
    throw badRequest('reference 인덱스는 1~5 사이여야 합니다.')
  }

  const item = await prisma.codeItem.findFirst({
    where: { code: itemCode, group: { code: groupCode } },
    select: { reference1: true, reference2: true, reference3: true, reference4: true, reference5: true },
  })

  if (!item) return null

  const key = `reference${referenceIndex}` as keyof typeof item
  return item[key]
}

/**
 * 그룹+코드 존재 여부 + 활성 여부 확인. 마이그레이션 검증에 사용.
 */
export async function isValidCode(
  groupCode: string,
  itemCode: string,
  options: { activeOnly?: boolean } = {},
): Promise<boolean> {
  const { activeOnly = true } = options

  const item = await prisma.codeItem.findFirst({
    where: {
      code: itemCode,
      group: { code: groupCode },
      ...(activeOnly ? { isActive: true } : {}),
    },
    select: { id: true },
  })

  return item !== null
}

// ─── pure helpers (테스트 가능) ────────────────────────────

export interface LocaleLabels {
  label: string
  labelEn: string | null
  labelZh: string | null
  labelVi: string | null
  labelEs: string | null
}

/** 로케일에 맞는 라벨 선택. 해당 로케일 라벨이 없으면 ko 폴백. */
export function pickLocaleLabel(item: LocaleLabels, locale: SupportedLocale): string {
  switch (locale) {
    case 'en':
      return item.labelEn ?? item.label
    case 'zh':
      return item.labelZh ?? item.label
    case 'vi':
      return item.labelVi ?? item.label
    case 'es':
      return item.labelEs ?? item.label
    case 'ko':
    default:
      return item.label
  }
}
