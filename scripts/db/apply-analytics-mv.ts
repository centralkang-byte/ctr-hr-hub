// ═══════════════════════════════════════════════════════════
// Analytics Materialized View 적용 — idempotent
// ───────────────────────────────────────────────────────────
// `prisma/migrations/mv_analytics.sql`은 loose 파일이라 `prisma migrate
// deploy`/`db push` 어느 흐름에도 실행되지 않는다 → MV 8개가 어느 환경에도
// 생성된 적 없음 → analytics 대시보드가 safeMvQuery로 빈값(0) 표시.
// 이 스크립트가 해당 SQL을 대상 DB에 1회 적용한다.
//
// 안전성:
//   - mv_analytics.sql 은 각 MV `DROP MATERIALIZED VIEW IF EXISTS` 선행
//     → 재실행 안전(idempotent). 백엔드 테이블/행 무변경(read-only MV DDL).
//   - 실행 전 대상 DB 호스트 마스킹 출력 + STAGING_DB_CONFIRM 가드.
//   - 적용 후 pg_matviews 로 생성된 MV 수 검증 출력.
//
// 사용법 (staging 먼저 → 검증 → prod):
//   STAGING_DB_CONFIRM=1 DATABASE_URL='<target>' \
//     npx tsx scripts/db/apply-analytics-mv.ts
// ═══════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

const EXPECTED_MVS = [
  'mv_headcount_daily',
  'mv_attendance_weekly',
  'mv_performance_summary',
  'mv_recruitment_funnel',
  'mv_burnout_risk',
  'mv_team_health',
  'mv_exit_reason_monthly',
  'mv_compa_ratio_distribution',
] as const

function maskHost(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.username ? '***@' : ''}${u.hostname}:${u.port || '5432'}${u.pathname}`
  } catch {
    return '(파싱 불가 — URL 형식 확인 필요)'
  }
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) throw new Error('DATABASE_URL 필요')

  const sqlPath = join(process.cwd(), 'prisma/migrations/mv_analytics.sql')
  const sql = readFileSync(sqlPath, 'utf8')

  console.log('─'.repeat(60))
  console.log('대상 DB :', maskHost(DATABASE_URL))
  console.log('작업    : mv_analytics.sql 적용 (MV 8개 DROP+CREATE+UNIQUE INDEX)')
  console.log('성격    : idempotent (DROP MV IF EXISTS 선행), read-only MV DDL')
  console.log('─'.repeat(60))

  if (process.env.STAGING_DB_CONFIRM !== '1') {
    throw new Error(
      'SAFETY STOP: 공유 환경 DDL. 위 대상 DB가 맞으면 STAGING_DB_CONFIRM=1 로 재실행.',
    )
  }

  // src/lib/prisma.ts 와 동일 SSL 판정 (Supabase/프로덕션은 SSL 강제,
  // localhost/CI 컨테이너는 plain TCP). raw pg client가 앱 연결과 동일하게.
  const isSupabase =
    DATABASE_URL.includes('supabase.co') || DATABASE_URL.includes('supabase.com')
  const isLocalhost =
    DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
  const ssl =
    !isLocalhost && (isSupabase || process.env.NODE_ENV === 'production')
      ? { rejectUnauthorized: false }
      : undefined

  const client = new Client({ connectionString: DATABASE_URL, ssl })
  await client.connect()
  try {
    await client.query(sql)
    const { rows } = await client.query<{ matviewname: string }>(
      `SELECT matviewname FROM pg_matviews WHERE matviewname = ANY($1::text[]) ORDER BY matviewname`,
      [EXPECTED_MVS as unknown as string[]],
    )
    const found = rows.map((r) => r.matviewname)
    const missing = EXPECTED_MVS.filter((m) => !found.includes(m))
    console.log(`생성 확인: ${found.length}/${EXPECTED_MVS.length} MV`)
    found.forEach((m) => console.log(`  ✓ ${m}`))
    if (missing.length) {
      missing.forEach((m) => console.log(`  ✗ ${m} (미생성)`))
      throw new Error(`MV ${missing.length}개 미생성 — SQL/스키마 정합 확인 필요`)
    }
    console.log('완료. 초기 데이터 적재됨(CREATE MV AS … 시점 스냅샷).')
    console.log('이후 갱신 = Vercel cron /api/v1/cron/refresh-analytics-mv.')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
