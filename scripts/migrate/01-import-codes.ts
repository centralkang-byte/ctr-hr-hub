// ═══════════════════════════════════════════════════════════
// Stage 1 — IS_SY02 (공통코드) → CodeGroup + CodeItem
// 사용법:
//   DRY_RUN=true npx tsx scripts/migrate/01-import-codes.ts /path/to/IS_SY02.xlsx
//   npx tsx scripts/migrate/01-import-codes.ts /path/to/IS_SY02.xlsx
// ═══════════════════════════════════════════════════════════

import dotenv from 'dotenv'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import * as xlsx from 'xlsx'
import { v5 as uuidv5 } from 'uuid'
import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import type { LegacyCodeGroupRow, LegacyCodeItemRow, MigrationResult } from './types'

// ─── 환경 로드 ────────────────────────────────────────────
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

// CodeMaster namespace — prisma/seeds/44-code-master.ts 와 동일해야 idempotent
const CODE_MASTER_NS = '8c9d2c3e-1f4b-4a5e-9e7c-0b1f2c3d4e5f'

function groupId(code: string): string {
  return uuidv5(`group:${code}`, CODE_MASTER_NS)
}

function itemId(groupCode: string, itemCode: string): string {
  return uuidv5(`item:${groupCode}:${itemCode}`, CODE_MASTER_NS)
}

const DRY_RUN = process.env.DRY_RUN === 'true'

// ─── 입력 검증 ────────────────────────────────────────────
const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: tsx scripts/migrate/01-import-codes.ts <path-to-IS_SY02.xlsx>')
  process.exit(1)
}

// ─── Prisma client ────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Check .env.local or .env')
  process.exit(1)
}
const adapter = new PrismaPg({ connectionString: DATABASE_URL })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

// ─── 파싱 헬퍼 ────────────────────────────────────────────
/**
 * IS_SY02 sheet 는 header row 가 2개:
 *   Row 1 = 한글명, Row 2 = ERP code name (예: CODETP, DESCRIPTION...)
 * Row 2 를 header 로 사용해 데이터 row 를 객체화.
 */
function sheetToRows<T>(workbook: xlsx.WorkBook, sheetName: string): T[] {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`)
  // 첫 2행은 header. range:1 → Row 2(0-indexed) 를 header 로.
  // raw:false → cell 의 formatted text 사용 (leading-zero 보존: "003" 이 number 3 으로 손실 안 됨).
  //   date 는 formatted string 으로 들어와도 parseDate() 가 new Date() 로 처리.
  return xlsx.utils.sheet_to_json<T>(sheet, { range: 1, defval: null, raw: false, blankrows: false })
}

function isBlankRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every((v) => v === null || v === undefined || v === '')
}

/**
 * IS_SY02 의 CODETP / CODEID 정규화 (trim only).
 * sheet_to_json({ raw: false }) 가 cell 의 formatted text 를 반환하므로
 * leading-zero 가 보존됨 ('01', '003' 모두 그대로). 추가 padding 불필요.
 * 이상치(number 가 그대로 들어온 경우)는 String() 으로 fallback.
 */
function normalizeCode(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

/**
 * Prisma string? 필드에 안전하게 전달. Excel 이 number 로 반환한 셀도 string 변환.
 * null/undefined/빈문자열 은 undefined 반환 (DB 쓰기에서 omit).
 */
function s(v: unknown): string | undefined {
  if (v == null) return undefined
  const str = String(v)
  return str === '' ? undefined : str
}

// ─── 메인 ────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`📥 IS_SY02 import — ${DRY_RUN ? 'DRY-RUN' : 'LIVE'} mode`)
  console.log(`   input: ${inputPath}\n`)

  const buf = readFileSync(inputPath)
  const wb = xlsx.read(buf, { cellDates: true })

  // 시트명 자동 감지 — 헤더 시트와 상세 시트
  const headerSheetName = wb.SheetNames.find((n) => n.includes('헤더') || n.includes('header')) ?? wb.SheetNames[0]
  const detailSheetName = wb.SheetNames.find((n) => n.includes('상세') || n.includes('detail') || n.includes('상세코드')) ?? wb.SheetNames[1]

  if (!headerSheetName || !detailSheetName) {
    throw new Error(`시트 자동 감지 실패. sheetNames: ${wb.SheetNames.join(', ')}`)
  }
  console.log(`   header sheet: "${headerSheetName}"`)
  console.log(`   detail sheet: "${detailSheetName}"\n`)

  const groupRows = sheetToRows<LegacyCodeGroupRow>(wb, headerSheetName).filter((r) => !isBlankRow(r as unknown as Record<string, unknown>))
  const itemRows = sheetToRows<LegacyCodeItemRow>(wb, detailSheetName).filter((r) => !isBlankRow(r as unknown as Record<string, unknown>))

  console.log(`   groups: ${groupRows.length}, items: ${itemRows.length}\n`)

  const result: MigrationResult = { total: 0, success: 0, errors: 0, skipped: 0, errorDetails: [] }

  // ─── 1. 사전 검증 + payload 빌드 (DB 변경 없음) ─────────
  const groupErrors: typeof result.errorDetails = []
  const itemErrors: typeof result.errorDetails = []
  const groupPayloads: Array<ReturnType<typeof buildGroupPayload>> = []
  const itemPayloads: Array<ReturnType<typeof buildItemPayload>> = []

  for (const [idx, row] of groupRows.entries()) {
    const groupCode = normalizeCode(row.CODETP)
    if (!groupCode) {
      groupErrors.push({ row: idx + 3, reason: 'CODETP is empty' })
      continue
    }
    groupPayloads.push(buildGroupPayload(groupCode, row))
  }

  for (const [idx, row] of itemRows.entries()) {
    const groupCode = normalizeCode(row.CODETP)
    const itemCode = normalizeCode(row.CODEID)
    if (!groupCode || !itemCode) {
      itemErrors.push({ row: idx + 3, reason: 'CODETP or CODEID missing' })
      continue
    }
    itemPayloads.push(buildItemPayload(groupCode, itemCode, row))
  }

  const allErrors = [...groupErrors, ...itemErrors]

  // 사전 검증 단계에서 에러 1건이라도 있으면 fail-fast (live/dry 동일) ───
  if (allErrors.length > 0) {
    console.log(`\n⚠️  Validation errors (showing first 10):`)
    for (const e of allErrors.slice(0, 10)) {
      console.log(`   row=${e.row} legacy=${e.legacyId ?? '-'} reason=${e.reason}`)
    }
    console.log(`\n📊 ${groupErrors.length + itemErrors.length} error(s). Aborting before DB writes.`)
    await prisma.$disconnect()
    process.exit(1)
  }

  // ─── 2. DRY-RUN: 샘플 출력 후 종료 ──────────────────────
  if (DRY_RUN) {
    console.log(`✓ Validation OK — would upsert ${groupPayloads.length} groups + ${itemPayloads.length} items.\n`)
    for (const g of groupPayloads.slice(0, 3)) console.log(`   [DRY] group ${g.code}: ${g.name}`)
    for (const i of itemPayloads.slice(0, 3)) console.log(`   [DRY] item ${i.groupCode}/${i.code}: ${i.label}`)
    await prisma.$disconnect()
    process.exit(0)
  }

  // ─── 3. LIVE: 단일 트랜잭션 — all-or-nothing ────────────
  result.total = groupPayloads.length + itemPayloads.length
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const data of groupPayloads) {
          await tx.codeGroup.upsert({
            where: { id: data.id },
            create: data.create,
            update: data.update,
          })
        }
        for (const data of itemPayloads) {
          await tx.codeItem.upsert({
            where: { id: data.id },
            create: data.create,
            update: data.update,
          })
        }
      },
      { timeout: 600_000 }, // 10 min — large IS_SY02 catalogs
    )
    result.success = result.total
    console.log(`\n📊 Imported ${groupPayloads.length} groups + ${itemPayloads.length} items (transactional).`)
  } catch (err) {
    console.error(`\n💥 Transaction rolled back: ${err instanceof Error ? err.message : String(err)}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  await prisma.$disconnect()
  process.exit(0)
}

// ─── payload builders (pure) ──────────────────────────────
// update 시 blank=null 명시적 clear (Prisma 는 undefined 면 변경 안 하므로 stale 잔존).
// 소스(IS_SY02) 가 truth — 재실행 시 source 의 blank → DB null.
function nullable(v: unknown): string | null {
  const str = s(v)
  return str ?? null
}

function buildGroupPayload(groupCode: string, row: LegacyCodeGroupRow) {
  const name = s(row.DESCRIPTION) ?? groupCode
  const create = {
    id: groupId(groupCode),
    code: groupCode,
    name,
    reference1Label: nullable(row.REFERENCE_1),
    reference2Label: nullable(row.REFERENCE_2),
    reference3Label: nullable(row.REFERENCE_3),
    reference4Label: nullable(row.REFERENCE_4),
    reference5Label: nullable(row.REFERENCE_5),
    description: nullable(row.REMARK),
    isSystem: false,
  }
  // update: code/isSystem 제외 (불변), 나머지는 동일 (null 포함)
  const update = {
    name,
    reference1Label: create.reference1Label,
    reference2Label: create.reference2Label,
    reference3Label: create.reference3Label,
    reference4Label: create.reference4Label,
    reference5Label: create.reference5Label,
    description: create.description,
  }
  return { id: create.id, code: groupCode, name, create, update }
}

function buildItemPayload(groupCode: string, itemCode: string, row: LegacyCodeItemRow) {
  const startDateRaw = parseDate(row.START_DATE_ACTIVE)
  const endDateRaw = parseDate(row.END_DATE_ACTIVE)
  const startDate = startDateRaw && startDateRaw.getUTCFullYear() > 1901 ? startDateRaw : null
  const endDate = endDateRaw && endDateRaw.getUTCFullYear() > 1901 ? endDateRaw : null
  const label = s(row.DESCRIPTION) ?? itemCode
  const sortOrder = Number.isFinite(Number(row.DISPLAY_NUM)) ? Number(row.DISPLAY_NUM) : 0
  const isActive = String(row.ENABLED ?? 'Y').trim().toUpperCase() === 'Y'

  const create = {
    id: itemId(groupCode, itemCode),
    groupId: groupId(groupCode),
    code: itemCode,
    label,
    sortOrder,
    isActive,
    startDate,
    endDate,
    reference1: nullable(row.REFERENCE_1),
    reference2: nullable(row.REFERENCE_2),
    reference3: nullable(row.REFERENCE_3),
    reference4: nullable(row.REFERENCE_4),
    reference5: nullable(row.REFERENCE_5),
    remark: nullable(row.REMARK),
  }
  // update: id/groupId/code 제외 (불변), 나머지 동일 (null 포함)
  const update = {
    label,
    sortOrder,
    isActive,
    startDate,
    endDate,
    reference1: create.reference1,
    reference2: create.reference2,
    reference3: create.reference3,
    reference4: create.reference4,
    reference5: create.reference5,
    remark: create.remark,
  }
  return { id: create.id, groupCode, code: itemCode, label, create, update }
}

/**
 * date-only 컬럼 파싱. `@db.Date` 는 UTC 자정으로 저장되므로 UTC date 로 normalize.
 * Excel 의 formatted 'YYYY-MM-DD' / 'YYYY/MM/DD' / 'YYYY.MM.DD' 처리.
 * Date 객체(cellDates 또는 ISO Z) 는 그대로 반환.
 */
function parseDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  if (!trimmed) return null

  // YYYY[-./]M[-./]D 패턴 → UTC 자정 (KST 자정 해석 방지)
  const ymd = trimmed.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  if (ymd) {
    return new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])))
  }
  // ISO 8601 (with time, includes Z) — new Date() 가 안전
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d
}

main().catch(async (err) => {
  console.error('💥 Fatal error:', err)
  await prisma.$disconnect()
  process.exit(1)
})
