// ═══════════════════════════════════════════════════════════
// CTR HR Hub — e2e direct-DB helper (S276)
// 1일 1레코드 정책 도입으로 API만으로는 테스트 픽스처 정리가 불가능
// (완료된 출퇴근 기록을 지우는 API가 없음) → pg로 직접 정리한다.
// DATABASE_URL은 env 우선, 없으면 repo 루트 .env.local/.env 파싱.
// ═══════════════════════════════════════════════════════════

import { Client } from 'pg'
import fs from 'fs'
import path from 'path'

let client: Client | null = null

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  for (const file of ['.env.local', '.env']) {
    const p = path.resolve(__dirname, '../../', file)
    if (!fs.existsSync(p)) continue
    const m = fs.readFileSync(p, 'utf-8').match(/^DATABASE_URL=(.+)$/m)
    if (m) return m[1].trim().replace(/^"|"$/g, '')
  }
  throw new Error('e2e db helper: DATABASE_URL을 찾을 수 없습니다 (env 또는 .env.local).')
}

export async function dbQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!client) {
    client = new Client({ connectionString: resolveDatabaseUrl() })
    await client.connect()
  }
  const res = await client.query(sql, params)
  return res.rows as T[]
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end()
    client = null
  }
}

/** 해당 이메일 직원의 특정 날짜(UTC date-only) 출퇴근 기록 삭제 — 픽스처 정리 */
export async function deleteAttendanceOn(email: string, dateStr: string): Promise<void> {
  await dbQuery(
    `DELETE FROM attendances
     WHERE employee_id = (SELECT id FROM employees WHERE email = $1 LIMIT 1)
       AND work_date = $2::date`,
    [email, dateStr],
  )
}

/** 해당 이메일 직원의 특정 날짜 교대 스케줄 삭제 — 픽스처 정리 */
export async function deleteShiftOn(email: string, dateStr: string): Promise<void> {
  await dbQuery(
    `DELETE FROM shift_schedules
     WHERE employee_id = (SELECT id FROM employees WHERE email = $1 LIMIT 1)
       AND work_date = $2::date`,
    [email, dateStr],
  )
}
