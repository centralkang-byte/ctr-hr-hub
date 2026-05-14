// ================================================================
// Code Master Seed (IS_SY02 호환) — Stage B of IS_PE01 migration
// 초기 분류: IS_SY02 샘플에서 직접 확인된 E106 / E108 / E310 만 시드.
// 나머지 코드 분류는 운영팀이 GUI 또는 추후 import 스크립트로 등록.
//
// Idempotent: upsert. Deterministic UUIDs via uuidv5(name, NAMESPACE).
// ================================================================

import { v5 as uuidv5 } from 'uuid'
import type { PrismaClient } from '../../src/generated/prisma/client'

// 고정 namespace UUID (코드 마스터 전용) — 절대 변경 금지
const CODE_MASTER_NS = '8c9d2c3e-1f4b-4a5e-9e7c-0b1f2c3d4e5f'

function groupId(code: string): string {
  return uuidv5(`group:${code}`, CODE_MASTER_NS)
}

function itemId(groupCode: string, itemCode: string): string {
  return uuidv5(`item:${groupCode}:${itemCode}`, CODE_MASTER_NS)
}

interface GroupSeed {
  code: string
  name: string
  description?: string
  ref1Label?: string
  ref2Label?: string
  isSystem?: boolean
  items: ItemSeed[]
}

interface ItemSeed {
  code: string
  label: string
  labelEn?: string
  labelZh?: string
  sortOrder: number
  remark?: string
  ref1?: string
  ref2?: string
}

// ─── IS_SY02 샘플에서 직접 확인된 코드 ──────────────────────
const GROUPS: GroupSeed[] = [
  {
    code: 'E106',
    name: '급여지급형태',
    description: 'IS_SY02 E106 호환',
    ref1Label: 'EIS 표시여부',
    isSystem: true,
    items: [
      { code: '01', label: '연봉제·월급제', labelEn: 'Annual/Monthly', sortOrder: 2, ref1: 'Y' },
      { code: '02', label: '일급직·시급직', labelEn: 'Daily/Hourly', sortOrder: 3, ref1: 'Y' },
      { code: '03', label: '연봉제(천안)', labelEn: 'Annual (Cheonan)', sortOrder: 4, ref1: 'Y' },
    ],
  },
  {
    code: 'E108',
    name: '고용형태-직군',
    description: 'IS_SY02 E108 호환 — Legacy ERP mapping 전송용',
    ref1Label: 'Legacy ERP mapping',
    ref2Label: '멀티캠퍼스 전송여부',
    isSystem: true,
    items: [
      { code: '01', label: '임원', labelEn: 'Executive', sortOrder: 1, remark: '계약직', ref1: '1', ref2: 'Y' },
      { code: '02', label: '정규직 관리직', labelEn: 'Regular - Office', sortOrder: 2, remark: '정규직', ref1: '1', ref2: 'Y' },
      { code: '03', label: '정규직 생산직', labelEn: 'Regular - Production', sortOrder: 3, remark: '정규직', ref1: '1', ref2: 'Y' },
      { code: '04', label: '정규직 해외주재원', labelEn: 'Regular - Expat', sortOrder: 4, remark: '정규직', ref1: '4', ref2: 'Y' },
      { code: '05', label: '계약직', labelEn: 'Contract', sortOrder: 5, remark: '계약직', ref1: '1', ref2: 'Y' },
      { code: '06', label: '파견직', labelEn: 'Dispatch', sortOrder: 6, ref1: '3' },
      { code: '07', label: '인턴직', labelEn: 'Intern', sortOrder: 7, remark: '인턴직', ref1: '3', ref2: 'Y' },
      { code: '08', label: '도급직', labelEn: 'Outsourced', sortOrder: 8, ref1: '3' },
      { code: '09', label: '일용직', labelEn: 'Day Labor', sortOrder: 9, ref1: '2' },
      { code: '10', label: '리더', labelEn: 'Leader', sortOrder: 10, remark: '계약직', ref1: '1', ref2: 'Y' },
    ],
  },
  {
    code: 'E310',
    name: '결혼여부',
    description: 'IS_SY02 E310 호환',
    isSystem: true,
    items: [
      { code: 'Y', label: '기혼', labelEn: 'Married', sortOrder: 1 },
      { code: 'N', label: '미혼', labelEn: 'Single', sortOrder: 2 },
    ],
  },
]

export async function seedCodeMaster(p: PrismaClient): Promise<void> {
  for (const g of GROUPS) {
    const gid = groupId(g.code)
    await p.codeGroup.upsert({
      where: { id: gid },
      create: {
        id: gid,
        code: g.code,
        name: g.name,
        description: g.description,
        reference1Label: g.ref1Label,
        reference2Label: g.ref2Label,
        isSystem: g.isSystem ?? false,
      },
      update: {
        name: g.name,
        description: g.description,
        reference1Label: g.ref1Label,
        reference2Label: g.ref2Label,
        isSystem: g.isSystem ?? false,
      },
    })

    for (const it of g.items) {
      const iid = itemId(g.code, it.code)
      await p.codeItem.upsert({
        where: { id: iid },
        create: {
          id: iid,
          groupId: gid,
          code: it.code,
          label: it.label,
          labelEn: it.labelEn,
          labelZh: it.labelZh,
          sortOrder: it.sortOrder,
          remark: it.remark,
          reference1: it.ref1,
          reference2: it.ref2,
        },
        update: {
          label: it.label,
          labelEn: it.labelEn,
          labelZh: it.labelZh,
          sortOrder: it.sortOrder,
          remark: it.remark,
          reference1: it.ref1,
          reference2: it.ref2,
        },
      })
    }
  }

  const totalItems = GROUPS.reduce((sum, g) => sum + g.items.length, 0)
  console.log(`  ✓ Seeded ${GROUPS.length} code groups, ${totalItems} items`)
}
