// ═══════════════════════════════════════════════════════════
// UAT Aging Seed Refresh — 지각왕(EDGE-023)·과로자(EDGE-024)
// ───────────────────────────────────────────────────────────
// 49-edge-case-personas.ts가 시드 시점의 "당월 1~7일"에 근태를 만들고
// 존재-체크 가드 때문에 재실행해도 갱신되지 않아, 30일 창을 쓰는
// 이상감지·주 단위 52시간 경고가 시간이 지나면 판정 불가가 된다
// (UAT S338 BLOCK 항목). 이 스크립트는 두 페르소나의 근태를
// "오늘 기준 최근" 날짜로 재생성한다. 몇 번을 실행해도 안전(idempotent).
//
//   지각왕: 오늘 포함 최근 평일 8일 LATE (이상감지·admin 이상근태 탭)
//   과로자: 이번 주(월~금, KST) 12시간 근무 5건 = 주 60h
//           + WorkHourAlert(blocked, 52h 초과) upsert — 52시간 모니터링
//
// ⚠ workDate는 정본 규약(현지 달력일의 UTC 자정 = parseDateOnly)으로
//   저장한다. 원 시드는 KST 자정(=전날 15:00Z)으로 저장해 일자 뷰
//   윈도우에 안 걸리는 잠복 결함이 있었다.
// ⚠ 과로자의 화~금 기록은 미래 시각 펀치다(주간 합산에 필요).
//   UAT 후 재실행하면 항상 실행 시점 기준으로 재생성된다.
//
// Usage: npx tsx scripts/refresh-uat-aging-seed.ts --confirm-uat-refresh
// ═══════════════════════════════════════════════════════════

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

const TZ = 'Asia/Seoul'
const TARDY_EMAIL = 'edge-tardy@ctr.co.kr' // 지각왕 EDGE-023
const OVERTIME_EMAIL = 'edge-overtime@ctr.co.kr' // 과로자 EDGE-024

// ─── 날짜 헬퍼 (KST 달력 기준) ────────────────────────────

/** KST 달력일 문자열 (yyyy-MM-dd) */
function kstDateStr(d: Date): string {
  return formatInTimeZone(d, TZ, 'yyyy-MM-dd')
}

/** 정본 workDate: 달력일 문자열 → UTC 자정 (src/lib/timezone.ts parseDateOnly와 동일) */
function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** 달력일 문자열 + n일 */
function addDays(dateStr: string, n: number): string {
  const d = parseDateOnly(dateStr)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 달력일의 요일 (0=일 … 6=토) */
function dayOfWeek(dateStr: string): number {
  return parseDateOnly(dateStr).getUTCDay()
}

/** KST 현지 시각 → UTC instant (예: kstTime('2026-07-13', 9, 20)) */
function kstTime(dateStr: string, hour: number, minute = 0): Date {
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return fromZonedTime(`${dateStr}T${hh}:${mm}:00.000`, TZ)
}

/** 해당 달력일이 속한 주의 월요일 달력일 */
function mondayOf(dateStr: string): string {
  const dow = dayOfWeek(dateStr)
  return addDays(dateStr, -(dow === 0 ? 6 : dow - 1))
}

// ─── main ─────────────────────────────────────────────────

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required')
  if (!process.argv.includes('--confirm-uat-refresh')) {
    throw new Error(
      '전용 UAT 페르소나의 근태·미해결 경고를 교체합니다. 실행하려면 --confirm-uat-refresh를 추가하세요.',
    )
  }

  const adapter = new PrismaPg({ connectionString: DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  try {
    const today = kstDateStr(new Date())
    console.log(`\n🔄 UAT aging seed refresh — 기준일(KST): ${today}`)

    // 페르소나 + 활성 primary 발령의 법인 조회
    const personas = await prisma.employee.findMany({
      where: { email: { in: [TARDY_EMAIL, OVERTIME_EMAIL] } },
      select: {
        id: true,
        name: true,
        email: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: { companyId: true },
        },
      },
    })
    const tardy = personas.find((p) => p.email === TARDY_EMAIL)
    const overtime = personas.find((p) => p.email === OVERTIME_EMAIL)
    if (!tardy || !overtime) {
      throw new Error(
        `엣지 페르소나 미존재 (지각왕=${!!tardy}, 과로자=${!!overtime}) — 49-edge-case-personas 시드를 먼저 실행하세요.`,
      )
    }
    const tardyCompanyId = tardy.assignments[0]?.companyId
    const overtimeCompanyId = overtime.assignments[0]?.companyId
    if (!tardyCompanyId || !overtimeCompanyId) {
      throw new Error('페르소나 활성 primary 발령이 없습니다.')
    }

    // 생성 대상 날짜를 먼저 확정한다. 아래 전체 교체는 단일 transaction이라
    // 중간 실패 시 기존 데이터 삭제까지 함께 rollback된다.
    const tardyDates: string[] = []
    let cursor = today
    while (tardyDates.length < 8) {
      if (dayOfWeek(cursor) !== 0 && dayOfWeek(cursor) !== 6) {
        tardyDates.push(cursor)
      }
      cursor = addDays(cursor, -1)
    }

    const monday = mondayOf(today)
    const overtimeDates = Array.from({ length: 5 }, (_, i) => addDays(monday, i))
    const weekStart = kstTime(monday, 0, 0)

    const result = await prisma.$transaction(async (tx) => {
      // 전용 EDGE 페르소나의 기존 근태를 교체한다. 실제 직원 데이터에는 사용 금지.
      const deletedAttendance = await tx.attendance.deleteMany({
        where: { employeeId: { in: [tardy.id, overtime.id] } },
      })

      // ① 지각왕 — 오늘 포함 최근 평일 8일 LATE
      for (const [index, date] of tardyDates.entries()) {
        const lateMin = 15 + ((index * 7) % 40) // 09:15~09:55 다양화
        await tx.attendance.create({
          data: {
            employeeId: tardy.id,
            companyId: tardyCompanyId,
            workDate: parseDateOnly(date),
            clockIn: kstTime(date, 9, lateMin),
            clockOut: kstTime(date, 18, 0),
            clockInMethod: 'WEB',
            clockOutMethod: 'WEB',
            status: 'LATE',
            workType: 'NORMAL',
            totalMinutes: 480 - lateMin,
          },
        })
      }

      // ② 과로자 — 이번 주 월~금 12시간 근무 (주 60h)
      for (const date of overtimeDates) {
        await tx.attendance.create({
          data: {
            employeeId: overtime.id,
            companyId: overtimeCompanyId,
            workDate: parseDateOnly(date),
            clockIn: kstTime(date, 8, 0),
            clockOut: kstTime(date, 20, 0),
            clockInMethod: 'WEB',
            clockOutMethod: 'WEB',
            status: 'NORMAL',
            workType: 'NORMAL',
            totalMinutes: 720,
            overtimeMinutes: 240,
          },
        })
      }

      // ③ 미해결 경고를 정리하고 현재 주 blocked 1건만 활성화한다.
      //    경고 행은 퇴근 시점에만 생성되므로 시드 근태만으론 대시보드에 안 뜬다.
      const deletedAlerts = await tx.workHourAlert.deleteMany({
        where: { employeeId: overtime.id, isResolved: false },
      })
      await tx.workHourAlert.upsert({
        where: {
          employeeId_weekStart_alertLevel: {
            employeeId: overtime.id,
            weekStart,
            alertLevel: 'blocked',
          },
        },
        create: {
          employeeId: overtime.id,
          weekStart,
          totalHours: 60,
          alertLevel: 'blocked',
          threshold: 52,
          isResolved: false,
        },
        update: {
          totalHours: 60,
          isResolved: false,
          resolvedAt: null,
          resolvedBy: null,
          resolveNote: null,
        },
      })

      return { deletedAttendance: deletedAttendance.count, deletedAlerts: deletedAlerts.count }
    }, { timeout: 15_000 })

    console.log(`  🗑  기존 근태 ${result.deletedAttendance}건·미해결 경고 ${result.deletedAlerts}건 교체`)
    console.log(`  ✅ 지각왕(${tardy.name}) LATE ${tardyDates.length}건 — ${tardyDates.at(-1)} 이후 평일`)
    console.log(`  ✅ 과로자(${overtime.name}) ${monday}~ 주간 12h×5 = 60h`)
    console.log(`  ✅ WorkHourAlert(blocked, 60h) upsert — weekStart=${monday}`)

    console.log('\n✨ 완료 — 이상감지·52시간 UAT 스텝 재검 가능\n')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
