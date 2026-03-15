#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════════════
// CTR HR Hub — i18n Batch Conversion Script (v2)
// Usage: npx tsx scripts/i18n-batch.ts [--dry-run] [--category <name>]
//        [--files <glob>] [--inject-hook]
//
// Categories: home | mySpace | teamManagement | hrOperations |
//             recruitment | performance | payroll | insights |
//             compliance | settings | other
//
// Example: npx tsx scripts/i18n-batch.ts --dry-run --category mySpace
// Example: npx tsx scripts/i18n-batch.ts --inject-hook --category home
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'

// ─── Constants ─────────────────────────────────────────────

const ROOT           = process.cwd()
const AUDIT_PATH     = join(ROOT, 'scripts', 'i18n-audit.json')
const MESSAGES_DIR   = join(ROOT, 'messages')
const LOCALES        = ['ko', 'en', 'zh', 'vi', 'es'] as const
type Locale = typeof LOCALES[number]

// ─── Korean → English key lookup ───────────────────────────
// All common HR/UI terms that appear as labels in the codebase.
// Keys are Korean strings, values are camelCase English equivalents.
const KR_TO_EN: Record<string, string> = {
  // Status
  '재직': 'statusActive', '휴직': 'statusOnLeave', '퇴직': 'statusResigned',
  '재직중': 'statusActive', '퇴사': 'statusResigned', '대기': 'statusPending',
  '완료': 'statusCompleted', '완료됨': 'statusCompleted', '상태_취소': 'statusCancelled',
  '진행중': 'statusInProgress', '검토중': 'statusUnderReview', '반려': 'statusRejected',
  '승인': 'statusApproved', '결재중': 'statusPending', '결재 대기': 'statusPendingApproval',
  '임시저장': 'statusDraft', '초안': 'statusDraft', '마감': 'statusClosed',
  '목표설정': 'statusGoalSetting', '자기평가': 'statusSelfReview',
  '상위평가': 'statusManagerReview', '상태_캘리브레이션': 'statusCalibration',
  '충원완료': 'statusFilled', '활성': 'statusActive', '만료': 'statusExpired',
  '접촉 중': 'statusContacted', '채용 완료': 'statusHired',  '생성': 'actionCreate', '변경': 'actionEdit', '복원': 'actionRestore',
  // Employee types
  '정규직': 'typeFullTime', '계약직': 'typeContract', '파트타임': 'typePart',
  '인턴': 'typeIntern', '파견': 'typeDispatch', '겸직': 'typeDualRole',
  '순환보직': 'typeRotation', '강등': 'typeDemotion', '복직': 'typeReinstatement',
  '승진': 'typePromotion', '전보': 'typeTransfer',
  // Common HR terms
  '부서': 'department', '직급': 'jobGrade', '직책': 'position', '직종': 'jobCategory',
  '직무': 'jobDuty', '팀': 'team', '법인': 'company', '사업장': 'workplace',
  '국가': 'country', '언어': 'language', '시간대': 'timezone',
  // Leave & Attendance
  '연차': 'annualLeave', '연차휴가': 'annualLeave', '병가': 'sickLeave',
  '특별휴가': 'specialLeave', '무급휴가': 'unpaidLeave', '경조사': 'bereavementLeave',
  '출산휴가': 'maternityLeave', '육아휴직': 'parentalLeave', '공휴일': 'publicHoliday',
  '근무': 'work', '출근': 'clockIn', '퇴근': 'clockOut', '지각': 'late',
  '결근': 'absent', '조기퇴근': 'earlyOut', '초과근무': 'overtime',
  '연장근무': 'overtime', '야간근무': 'nightShift', '주간': 'weekly',
  '일간': 'daily', '월간': 'monthly', '연간': 'annual', '분기': 'quarterly',
  '근무일정': 'workSchedule', '근무 스케줄': 'workSchedule', '교대근무': 'shiftWork',
  '교대': 'shift', '휴가': 'leave', '휴가 유형': 'leaveType',
  '휴가 부여 규칙': 'leaveGrantRule', '법정 공휴일': 'publicHoliday',
  '연차촉진': 'leavePromotion', '주간 근무한도': 'weeklyHoursLimit',
  // Approval flow
  '직속 팀장': 'directManager', '부서장': 'departmentHead', 'HR 담당': 'hrStaff',
  '경영관리': 'managementAdmin', '대표이사': 'ceo',
  // Roles
  '최고 관리자': 'roleSuperAdmin', 'HR 관리자': 'roleHrAdmin', 'HR 담당자': 'roleHrStaff',
  '매니저': 'roleManager', '일반 직원': 'roleEmployee', '조회 전용': 'roleReadOnly',
  // Payroll
  '급여': 'salary', '기본급': 'baseSalary', '수당': 'allowance', '공제': 'deduction',
  '세금': 'tax', '보험': 'insurance', '성과급': 'bonus', '인센티브': 'incentive',
  '급여 항목': 'payrollItem', '공제 항목': 'deductionItem', '비과세 한도': 'taxFreeLimit',
  '연봉 밴드': 'salaryBand', '인상률 매트릭스': 'increaseMatrix', '성과급 규칙': 'bonusRule',
  '급여일': 'payDay', '통화/환율': 'currencyExchange', '급여/보상': 'payrollCompensation',
  '식대': 'mealAllowance', '교통비 (자가운전보조금)': 'transportAllowance',
  '자녀보육수당': 'childcareAllowance', '연구활동비': 'researchExpense',
  '생산직 야간근로수당': 'productionNightAllowance',
  // Performance
  '평가': 'evaluation', '목표': 'goal', '성과': 'performance', '역량': 'competency',
  '등급': 'grade',  '탁월': 'gradeExcellent', '우수': 'gradeGood',
  '보통': 'gradeAverage', '미흡': 'gradePoor', '평가 주기': 'evalCycle',
  '평가 방법론': 'evalMethodology', '등급 체계': 'gradeSystem',
  '배분 가이드라인': 'distributionGuideline', '캘리브레이션': 'calibration',
  'CFR 설정': 'cfrSettings', '역량 라이브러리': 'competencyLibrary',
  '성과/평가': 'performanceEval',
  // Recruitment & Onboarding
  '채용': 'recruitment', '공고': 'jobPosting', '지원자': 'applicant',
  '면접': 'interview', '합격': 'passed', '불합격': 'rejected',
  '파이프라인': 'pipeline', '온보딩': 'onboarding', '오프보딩': 'offboarding',
  '체크리스트': 'checklist', '수습': 'probation', '채용 파이프라인': 'recruitmentPipeline',
  '면접 평가항목': 'interviewCriteria', 'AI 스크리닝': 'aiScreening',
  '온보딩 템플릿': 'onboardingTemplate', '오프보딩 체크리스트': 'offboardingChecklist',
  '수습 평가': 'probationEval', '채용/온보딩': 'recruitmentOnboarding',
  '긴급': 'urgent', '낮음': 'low', '보통 (긴급도)': 'normal',
  '우수 불합격': 'qualifiedRejected', '자진 철회': 'withdrawn',
  '역량 초과': 'overqualified', '수동 등록': 'manualEntry',
  '전체 인재': 'allTalent', '30일 내 만료': 'expiringSoon',
  '전체 공석': 'allVacancies', '채용 진행 중': 'activeRecruitment',
  '공고 없음': 'noPosting', '30일 내 충원': 'recentlyFilled',
  '전체 요청': 'allRequests', '문서_결재 대기': 'pendingApproval',
  '나의 결재함': 'myApprovals',
  // Settings sections
  '조직/인사': 'orgHr', '법인 기본정보': 'companyInfo', '부서 구조': 'deptStructure',
  '직급 체계': 'gradeSystem', '직종/직무': 'jobCategoryType', '발령 규칙': 'assignmentRule',
  '수습 기간': 'probationPeriod', '커스텀 필드': 'customField', '코드 관리': 'codeManagement',
  '근태/휴가': 'attendanceLeave', '시스템': 'system', '알림 채널': 'notificationChannel',
  '알림 규칙': 'notificationRule', '언어/타임존': 'languageTimezone',
  '역할/권한': 'rolePermission', '감사 로그': 'auditLog', '데이터 보존': 'dataRetention',
  '연동': 'integration', 'ERP 연동': 'erpIntegration', 'API 키 관리': 'apiKeyManagement',
  '이메일': 'email', '앱 푸시': 'appPush', '월간보고': 'monthlyReport',
  // Analytics/Insights
  '이직률': 'turnoverRate', '연차 사용률': 'leaveUsageRate',
  '출퇴근 현황': 'attendanceSummary', '팀 건강': 'teamHealth',
  // My Space / Profile
  '내 정보': 'myInfo', '기본 정보': 'basicInfo', '연락처': 'contact',
  '비상연락처': 'emergencyContact', '학력': 'education', '경력': 'career',
  '자격증': 'certification', '수상': 'award', '언어 능력': 'languageSkill',
  '급여 정보': 'salaryInfo', '은행 계좌': 'bankAccount',
  '내 휴가': 'myLeave', '연차 현황': 'leaveBalance', '휴가 내역': 'leaveHistory',
  '휴가 신청': 'leaveRequest', '근무 기록': 'workRecord',
  '내 평가': 'myEval', '목표 관리': 'goalManagement', '성과 현황': 'performanceSummary',
  '교육': 'training', '복리후생': 'benefits', '스킬': 'skills',
  '알림': 'notification', '알림 설정': 'notificationSettings',
  '개인정보': 'personalInfo', '보안': 'security', '설정': 'settings',
  '프로필': 'profile', '내 프로필': 'myProfile', '전체': 'all',
  // UI Common
  '저장': 'save', '취소': 'cancel', '삭제': 'delete', '확인': 'confirm',
  '닫기': 'close', '수정': 'edit', '추가': 'add', '등록': 'register',
  '검색': 'search', '필터': 'filter', '초기화': 'reset', '내보내기': 'export',
  '불러오기': 'import', '다운로드': 'download', '업로드': 'upload',
  '이전': 'previous', '다음': 'next', '이름': 'name', '날짜': 'date',
  '기간': 'period', '시작일': 'startDate', '종료일': 'endDate',
  '상태': 'status', '유형': 'type', '사유': 'reason', '비고': 'note',
  '메모': 'memo', '첨부파일': 'attachment', '상세': 'detail', '목록': 'list',
  '담당자': 'personInCharge', '후임자': 'successor', '상위': 'parent',
  '하위': 'child', '전체보기': 'viewAll', '더보기': 'loadMore',
  '인원': 'headcount',
}

function koToKey(korean: string): string {
  const trimmed = korean.trim()
  if (KR_TO_EN[trimmed]) return KR_TO_EN[trimmed]
  // Try partial match for compound words
  for (const [k, v] of Object.entries(KR_TO_EN)) {
    if (trimmed.includes(k) && k.length > 1) return v + '_compound'
  }
  // Fallback: transliterate roughly by removing Korean chars and using index
  const hash = Array.from(trimmed).reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return `label_${hash % 99999}`
}

// ─── Namespace mapping ──────────────────────────────────────

const PATH_TO_NAMESPACE: [string, string][] = [
  ['/home/', 'home'],
  ['/dashboard/', 'home'],
  ['/my/', 'mySpace'],
  ['/employees/', 'employees'],
  ['/leave/', 'leave'],
  ['/attendance/', 'attendance'],
  ['/onboarding/', 'onboarding'],
  ['/offboarding/', 'onboarding'],
  ['/discipline/', 'discipline'],
  ['/succession/', 'succession'],
  ['/directory/', 'employees'],
  ['/recruitment/', 'recruitment'],
  ['/performance/', 'performance'],
  ['/compensation/', 'compensation'],
  ['/benefits/', 'benefits'],
  ['/training/', 'training'],
  ['/payroll/', 'payroll'],
  ['/analytics/', 'analytics'],
  ['/compliance/', 'compliance'],
  ['/settings/', 'settings'],
  ['/approvals/', 'approvals'],
  ['/org-studio/', 'orgStudio'],
]

function getNamespace(filePath: string): string {
  const p = filePath.replace(/\\/g, '/')
  for (const [segment, ns] of PATH_TO_NAMESPACE) {
    if (p.includes(segment)) return ns
  }
  return 'common'
}

// ─── Args ──────────────────────────────────────────────────

const args        = process.argv.slice(2)
const isDryRun    = args.includes('--dry-run')
const injectHook  = args.includes('--inject-hook')
const catIdx      = args.indexOf('--category')
const category    = catIdx !== -1 ? args[catIdx + 1] : null

// ─── JSON helpers ───────────────────────────────────────────

function loadJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {}
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function saveJson(path: string, data: Record<string, unknown>) {
  const str = JSON.stringify(data, null, 2)
  JSON.parse(str) // validate
  writeFileSync(path, str + '\n', 'utf-8')
}

function setNestedKey(obj: Record<string, unknown>, keyPath: string, value: unknown) {
  const parts = keyPath.split('.')
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}
    cur = cur[parts[i]] as Record<string, unknown>
  }
  const last = parts[parts.length - 1]
  if (cur[last] === undefined) cur[last] = value
}

function hasNestedKey(obj: Record<string, unknown>, keyPath: string): boolean {
  const parts = keyPath.split('.')
  let cur: Record<string, unknown> = obj
  for (const p of parts) {
    if (!cur[p]) return false
    cur = cur[p] as Record<string, unknown>
  }
  return true
}

const backedUp = new Set<string>()
function ensureBackup(path: string) {
  if (backedUp.has(path)) return
  if (existsSync(path)) copyFileSync(path, path + '.bak')
  backedUp.add(path)
}

// ─── File processing ────────────────────────────────────────

interface Entry {
  file: string
  line: number
  current: string
  suggestedKey: string
}

function processEntry(
  entry: Entry,
  localeData: Record<Locale, Record<string, unknown>>,
  log: string[],
  stats: { processed: number; replaced: number; skipped: number; errors: number }
): void {
  stats.processed++
  const ns = getNamespace(entry.file)
  const enKey = koToKey(entry.current)
  const fullKey = `${ns}.${enKey}`

  // Register in locale files
  setNestedKey(localeData['ko'], fullKey, entry.current)
  for (const locale of LOCALES) {
    if (locale !== 'ko') {
      if (!hasNestedKey(localeData[locale], fullKey)) {
        setNestedKey(localeData[locale], fullKey, '')
      }
    }
  }

  if (isDryRun) {
    const line = `[DRY] ${entry.file}:${entry.line} — "${entry.current}" → t('${enKey}')`
    console.log(`  ✅ ${line}`)
    log.push(line)
    stats.replaced++
    return
  }

  // Write mode
  const absPath = resolve(ROOT, entry.file)
  if (!existsSync(absPath)) { stats.skipped++; return }

  const src = readFileSync(absPath, 'utf-8')

  // Skip if already translated
  if (src.includes(`t('${enKey}')`) || src.includes(`t("${enKey}")`)) {
    stats.skipped++
    return
  }

  const hasHook = src.includes('useTranslations') || src.includes('getTranslations')

  if (!hasHook) {
    if (!injectHook) {
      console.log(`  ⚠️  SKIP (no hook, use --inject-hook): ${entry.file}`)
      stats.skipped++
      return
    }
    // Inject useTranslations at top of component
    // Detect if it's a React component (has 'export default function' or 'export function')
    if (!src.includes('export default function') && !src.includes('export function')) {
      console.log(`  ⚠️  SKIP (not a React component, can't inject hook): ${entry.file}`)
      stats.skipped++
      return
    }
  }

  const escaped = entry.current.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const singleQ = new RegExp(`(label:\\s*)'${escaped}'`, 'g')
  const doubleQ = new RegExp(`(label:\\s*)"${escaped}"`, 'g')

  if (!singleQ.test(src) && !doubleQ.test(src)) {
    stats.skipped++
    return
  }

  ensureBackup(absPath)

  let updated = src
  if (injectHook && !hasHook) {
    // Find first 'use client' or first import, inject after it
    const insertAfter = updated.indexOf("'use client'")
    if (insertAfter !== -1) {
      const lineEnd = updated.indexOf('\n', insertAfter) + 1
      updated = updated.slice(0, lineEnd)
        + `import { useTranslations } from 'next-intl'\n`
        + updated.slice(lineEnd)
      // Find component function and inject hook call
      const fnMatch = updated.match(/(export default function|export function)\s+\w+[^{]*{/)
      if (fnMatch) {
        const fnIdx = updated.indexOf(fnMatch[0]) + fnMatch[0].length
        updated = updated.slice(0, fnIdx) + `\n  const t = useTranslations('${ns}')` + updated.slice(fnIdx)
      }
    }
  }

  const replacement = `$1t('${enKey}')`
  const singleQFresh = new RegExp(`(label:\\s*)'${escaped}'`, 'g')
  const doubleQFresh = new RegExp(`(label:\\s*)"${escaped}"`, 'g')
  updated = updated.replace(singleQFresh, replacement).replace(doubleQFresh, replacement)

  if (updated === src) { stats.skipped++; return }

  writeFileSync(absPath, updated, 'utf-8')
  stats.replaced++
  const line = `[REPLACED] ${entry.file}:${entry.line} — "${entry.current}" → t('${enKey}')`
  console.log(`  ✅ ${line}`)
  log.push(line)
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  CTR HR Hub — i18n Batch v2`)
  console.log(`  Mode:        ${isDryRun ? '🔍 DRY RUN' : '✏️  WRITE'}`)
  console.log(`  Category:    ${category ?? 'ALL'}`)
  console.log(`  Inject hook: ${injectHook}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (!existsSync(AUDIT_PATH)) {
    console.error('❌ Run: node scripts/generate-i18n-audit.mjs first')
    process.exit(1)
  }

  const audit = JSON.parse(readFileSync(AUDIT_PATH, 'utf-8'))
  const localeData = Object.fromEntries(
    LOCALES.map((l) => [l, loadJson(join(MESSAGES_DIR, `${l}.json`))])
  ) as Record<Locale, Record<string, unknown>>

  const categories = category ? [category] : Object.keys(audit.tabLabels)
  const stats = { processed: 0, replaced: 0, skipped: 0, errors: 0 }
  const log: string[] = []

  for (const cat of categories) {
    const entries: Entry[] = audit.tabLabels[cat] ?? []
    if (entries.length === 0) { console.log(`ℹ️  "${cat}": no entries`); continue }
    console.log(`\n📂 ${cat} (${entries.length} entries)`)
    for (const entry of entries) processEntry(entry, localeData, log, stats)
  }

  if (!isDryRun) {
    for (const locale of LOCALES) {
      const path = join(MESSAGES_DIR, `${locale}.json`)
      ensureBackup(path)
      saveJson(path, localeData[locale])
    }
    console.log(`\n✅ Locale files updated.`)
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Processed: ${stats.processed}`)
  console.log(`  Replaced:  ${stats.replaced}`)
  console.log(`  Skipped:   ${stats.skipped}`)
  console.log(`  Errors:    ${stats.errors}`)
  if (isDryRun) console.log(`\n  (DRY RUN — no files modified)`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (!isDryRun && log.length > 0) {
    const reportPath = join(ROOT, 'scripts', `i18n-batch-report-${Date.now()}.txt`)
    writeFileSync(reportPath, log.join('\n'), 'utf-8')
    console.log(`📄 Report: ${reportPath}\n`)
  }
}

main().catch((e) => { console.error('❌', e); process.exit(1) })
