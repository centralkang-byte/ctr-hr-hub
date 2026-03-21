import { parse } from 'csv-parse/sync'
import type { ParsedRow } from './types'

// UTF-8 BOM 제거
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
}

/**
 * CSV 파일을 파싱하여 행 배열로 반환.
 * - UTF-8 BOM 자동 제거
 * - 빈 행 필터링
 */
export function parseCSV(buffer: ArrayBuffer): ParsedRow[] {
  const decoder = new TextDecoder('utf-8')
  const text = stripBom(decoder.decode(buffer))

  const records: Record<string, string>[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  })

  return records.map((raw, index) => ({
    rowNum: index + 1,
    raw,
  }))
}

/**
 * CSV 헤더 검증: 템플릿에 정의된 필수 컬럼이 모두 존재하는지 확인.
 * 반환: 누락된 필수 컬럼 목록 (빈 배열이면 OK)
 */
export function validateHeaders(
  parsedHeaders: string[],
  templateHeaders: { key: string; required: boolean }[],
): string[] {
  const missing: string[] = []
  for (const col of templateHeaders) {
    if (col.required && !parsedHeaders.includes(col.key)) {
      missing.push(col.key)
    }
  }
  return missing
}
