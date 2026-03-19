// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: entire database seed data — 16 seed scripts, company/employee/config data
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════

/**
 * CTR HR Hub v3.2 — Database Seed
 * Tasks 21-23: Companies, Roles, Permissions, Test Accounts, v3.2 Customization
 *
 * Usage: npx prisma db seed
 * Idempotent: uses upsert where possible
 */

import dotenv from 'dotenv'
import path from 'path'

// Load .env.local first (higher priority), then fallback to .env
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { seedNewEmployees } from './seeds/02-employees'
import { seedAttendance } from './seeds/03-attendance'
import { seedLeave } from './seeds/04-leave'
import { seedPerformance } from './seeds/05-performance'
import { seedPayroll } from './seeds/06-payroll'
import { seedLifecycle } from './seeds/07-lifecycle'
import { seedNotifications } from './seeds/08-notifications'
import { seedQAFixes } from './seeds/09-qa-fixes'
import { seedRecruitment } from './seeds/10-recruitment'
import { seedCompensation } from './seeds/11-compensation'
import { seedBenefits } from './seeds/12-benefits'
import { seedYearEnd } from './seeds/13-year-end'
import { seedSuccession } from './seeds/14-succession'
import { seedPeerReview } from './seeds/15-peer-review'
import { seedPartialFixes } from './seeds/16-partial-fixes'
import { seedPayrollPipeline } from './seeds/17-payroll-pipeline'
import { seedPerformancePipeline } from './seeds/18-performance-pipeline'
import { seedGP4PeerReview } from './seeds/19-peer-review'
import { seedGP4CompReview } from './seeds/20-compensation-review'
import { seedOffboardingInstances } from './seeds/22-offboarding-instances'
import { seedCrossboarding } from './seeds/23-crossboarding'
import { seedDelegation } from './seeds/24-delegation'
import { seedLeaveEnhancement } from './seeds/25-leave-enhancement'
import { seedProcessSettings } from './seeds/26-process-settings'
import { seedQASkillsTrainingPulse } from './seeds/30-qa-skills-training-pulse'
import { seedDiscipline } from './seeds/31-discipline'
import { seedPerformanceGaps } from './seeds/32-performance-gaps'
import { seedComplianceGaps } from './seeds/33-compliance-gaps'
import { seedPayrollOtherGaps } from './seeds/34-payroll-other-gaps'

// Load DATABASE_URL from .env.local or .env
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Check .env.local or .env')
}

// Prisma v7: requires adapter for client engine
// PrismaPg expects { connectionString } or pg.Pool config, not raw string
const adapter = new PrismaPg({ connectionString: DATABASE_URL })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

// ================================================================
// Deterministic UUID helper — makes seed idempotent
// ================================================================
function deterministicUUID(namespace: string, key: string): string {
  // Simple deterministic UUID v5-like using namespace+key hash
  const str = `${namespace}:${key}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(0, 3)}-${hex.padEnd(12, '0').slice(0, 12)}`
}

// ================================================================
// 1. COMPANIES (13)
// ================================================================
const companyData = [
  { code: 'CTR-HQ', name: 'CTR Holdings', nameEn: 'CTR Holdings', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: null, payrollFrequencies: ['MONTHLY'], payrollMode: 'IMPORT' as const },
  { code: 'CTR-KR', name: 'CTR', nameEn: 'CTR', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: 'CTR-HQ', payrollFrequencies: ['MONTHLY'], payrollMode: 'IMPORT' as const },
  { code: 'CTR-MOB', name: 'CTR Mobility', nameEn: 'CTR Mobility', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: 'CTR-HQ', payrollFrequencies: ['MONTHLY'], payrollMode: 'IMPORT' as const },
  { code: 'CTR-ECO', name: 'CTR Ecoforging', nameEn: 'CTR Ecoforging', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: 'CTR-HQ', payrollFrequencies: ['MONTHLY'], payrollMode: 'IMPORT' as const },
  { code: 'CTR-ROB', name: 'CTR Robotics', nameEn: 'CTR Robotics', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: 'CTR-HQ', payrollFrequencies: ['MONTHLY'], payrollMode: 'IMPORT' as const },
  { code: 'CTR-ENG', name: 'CTR Energy', nameEn: 'CTR Energy', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: 'CTR-HQ', payrollFrequencies: ['MONTHLY'], payrollMode: 'IMPORT' as const },
  { code: 'FML', name: 'Formationlabs', nameEn: 'Formationlabs', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: 'CTR-HQ', payrollFrequencies: ['MONTHLY'], payrollMode: 'IMPORT' as const },
  { code: 'CTR-US', name: 'CTR America', nameEn: 'CTR America', countryCode: 'US', timezone: 'America/Chicago', locale: 'en', currency: 'USD', parentCode: 'CTR-KR', payrollFrequencies: ['BIWEEKLY'], payrollMode: 'IMPORT' as const },
  { code: 'CTR-CN', name: 'CTR China', nameEn: 'CTR China', countryCode: 'CN', timezone: 'Asia/Shanghai', locale: 'zh', currency: 'CNY', parentCode: 'CTR-KR', payrollFrequencies: ['MONTHLY'], payrollMode: 'IMPORT' as const },
  { code: 'CTR-RU', name: 'CTR Russia', nameEn: 'CTR Russia', countryCode: 'RU', timezone: 'Europe/Moscow', locale: 'ru', currency: 'RUB', parentCode: 'CTR-KR', payrollFrequencies: ['BIWEEKLY'], payrollMode: 'IMPORT' as const },
  { code: 'CTR-VN', name: 'CTR Vietnam', nameEn: 'CTR Vietnam', countryCode: 'VN', timezone: 'Asia/Ho_Chi_Minh', locale: 'vi', currency: 'VND', parentCode: 'CTR-KR', payrollFrequencies: ['MONTHLY'], payrollMode: 'IMPORT' as const },
  { code: 'CTR-EU', name: 'CTR Europe', nameEn: 'CTR Europe Sp. z o.o.', countryCode: 'PL', timezone: 'Europe/Warsaw', locale: 'en', currency: 'PLN', parentCode: 'CTR-KR', payrollFrequencies: ['MONTHLY'], payrollMode: 'IMPORT' as const },
  { code: 'CTR-MX', name: 'CTR Mexico', nameEn: 'CTR Mexico', countryCode: 'MX', timezone: 'America/Mexico_City', locale: 'es', currency: 'MXN', parentCode: 'CTR-KR', payrollFrequencies: ['WEEKLY', 'BIWEEKLY', 'MONTHLY'], payrollMode: 'IMPORT' as const },
]

// ================================================================
// 2. ROLES (5 system)
// ================================================================
const roleData = [
  { code: 'SUPER_ADMIN', name: 'Super Admin', isSystem: true },
  { code: 'HR_ADMIN', name: 'HR Admin', isSystem: true },
  { code: 'EXECUTIVE', name: 'Executive', isSystem: true },
  { code: 'MANAGER', name: 'Manager', isSystem: true },
  { code: 'EMPLOYEE', name: 'Employee', isSystem: true },
]

// ================================================================
// 3. PERMISSIONS (17 modules × 6 actions = 102)
// ================================================================
const modules = [
  'employees', 'org', 'attendance', 'leave', 'recruitment',
  'performance', 'payroll', 'compensation', 'onboarding', 'offboarding', 'discipline', 'benefits',
  'compliance', 'settings', 'training', 'pulse', 'succession',
]
const actions = ['create', 'read', 'update', 'delete', 'export', 'manage']

// ================================================================
// 4. ROLE-PERMISSION MAPPING
// ================================================================
type PermKey = `${string}_${string}`

function buildRolePermissions(): Record<string, PermKey[]> {
  const all: PermKey[] = modules.flatMap(m => actions.map(a => `${m}_${a}` as PermKey))

  // HR_ADMIN: everything (payroll update/delete now included for attendance close/reopen/notify)
  const hrAdmin = all.filter(() => true)

  // MANAGER: team scoped
  const manager: PermKey[] = [
    'employees_read', 'attendance_read', 'leave_read', 'leave_update',
    'performance_read', 'performance_update', 'discipline_read',
  ]

  // EMPLOYEE: self scoped (payroll_read for /payroll/me payslip access)
  const employee: PermKey[] = [
    'employees_read', 'attendance_read', 'attendance_create',
    'leave_read', 'leave_create', 'performance_read', 'performance_create',
    'payroll_read',
  ]

  // EXECUTIVE
  const executive: PermKey[] = [
    'employees_read', 'performance_read',
    ...modules.map(m => `${m}_export` as PermKey),
  ]

  return {
    SUPER_ADMIN: all,
    HR_ADMIN: hrAdmin,
    EXECUTIVE: executive,
    MANAGER: manager,
    EMPLOYEE: employee,
  }
}

// ================================================================
// 5. JOB CATEGORIES per company (4 each)
// ================================================================
const jobCategoryEntries: Array<{ code: 'OFFICE' | 'PRODUCTION' | 'R_AND_D' | 'MANAGEMENT'; name: string }> = [
  { code: 'OFFICE', name: '사무직' },
  { code: 'PRODUCTION', name: '생산직' },
  { code: 'R_AND_D', name: '연구개발' },
  { code: 'MANAGEMENT', name: '관리직' },
]

// ================================================================
// 6. EMS BLOCK CONFIG
// ================================================================
const emsBlockDefinitions = [
  { row: 3, col: 'C', label: 'Star', color: 'green' },
  { row: 3, col: 'B', label: 'Strong Performer', color: 'blue' },
  { row: 3, col: 'A', label: 'Growth Potential', color: 'teal' },
  { row: 2, col: 'C', label: 'Core Player', color: 'cyan' },
  { row: 2, col: 'B', label: 'Solid Contributor', color: 'gray' },
  { row: 2, col: 'A', label: 'Development Needed', color: 'yellow' },
  { row: 1, col: 'C', label: 'Misplaced Talent', color: 'orange' },
  { row: 1, col: 'B', label: 'Under Performer', color: 'red-light' },
  { row: 1, col: 'A', label: 'Action Required', color: 'red' },
]

// ================================================================
// 7. TEST ACCOUNTS
// ================================================================
const testAccounts = [
  { email: 'admin@ctr.co.kr', name: '이시스템', nameEn: 'System Lee', employeeNo: 'CTR-HQ-0001', roleCode: 'SUPER_ADMIN', companyCode: 'CTR-HQ' },
  { email: 'hr@ctr.co.kr', name: '김인사', nameEn: 'HR Kim', employeeNo: 'CTR-KR-0001', roleCode: 'HR_ADMIN', companyCode: 'CTR-KR' },
  { email: 'manager@ctr.co.kr', name: '박매니저', nameEn: 'Manager Park', employeeNo: 'CTR-KR-0002', roleCode: 'MANAGER', companyCode: 'CTR-KR' },
  { email: 'employee@ctr.co.kr', name: '최사원', nameEn: 'Employee Choi', employeeNo: 'CTR-KR-0003', roleCode: 'EMPLOYEE', companyCode: 'CTR-KR' },
]

// Bcrypt hash for 'test1234' (pre-computed, cost factor 10)
const TEST_PASSWORD_HASH = '$2b$10$dummyHashForSeedOnlyNotRealBcryptHashValue000000000000'

// ================================================================
// 8. DEPARTMENTS (CTR-KR)
// ================================================================
const departmentData = [
  { code: 'MGMT', name: '경영지원본부', nameEn: 'Management Support', level: 1, sortOrder: 1, parentCode: null },
  { code: 'HR', name: '인사팀', nameEn: 'HR Team', level: 2, sortOrder: 2, parentCode: 'MGMT' },
  { code: 'DEV', name: '개발팀', nameEn: 'Development Team', level: 1, sortOrder: 3, parentCode: null },
  { code: 'SALES', name: '영업팀', nameEn: 'Sales Team', level: 1, sortOrder: 4, parentCode: null },
]

// ================================================================
// 9. JOB GRADES (CTR-KR, 6 grades)
// ================================================================
const jobGradeData = [
  { code: 'G1', name: '임원', rankOrder: 1 },
  { code: 'G2', name: '부장', rankOrder: 2 },
  { code: 'G3', name: '차장', rankOrder: 3 },
  { code: 'G4', name: '과장', rankOrder: 4 },
  { code: 'G5', name: '대리', rankOrder: 5 },
  { code: 'G6', name: '사원', rankOrder: 6 },
]

// ================================================================
// 10. ONBOARDING TEMPLATE + TASKS
// ================================================================
const onboardingTasks = [
  { title: '서류제출', description: '입사 서류 제출', assigneeType: 'HR' as const, dueDaysAfter: 1, sortOrder: 1, category: 'DOCUMENT' as const },
  { title: '장비수령', description: 'IT 장비 수령', assigneeType: 'EMPLOYEE' as const, dueDaysAfter: 1, sortOrder: 2, category: 'SETUP' as const },
  { title: '부서소개', description: '부서 소개 및 안내', assigneeType: 'BUDDY' as const, dueDaysAfter: 2, sortOrder: 3, category: 'INTRODUCTION' as const },
  { title: '보안교육', description: '보안 교육 이수', assigneeType: 'EMPLOYEE' as const, dueDaysAfter: 3, sortOrder: 4, category: 'TRAINING' as const },
  { title: 'OJT', description: '부서 OJT 진행', assigneeType: 'MANAGER' as const, dueDaysAfter: 5, sortOrder: 5, category: 'TRAINING' as const },
  { title: '멘토미팅', description: '멘토 배정 및 첫 미팅', assigneeType: 'BUDDY' as const, dueDaysAfter: 7, sortOrder: 6, category: 'INTRODUCTION' as const },
]

// ================================================================
// 11. OFFBOARDING CHECKLIST + TASKS
// ================================================================
const offboardingTasks = [
  { title: '사직서 접수', description: '사직서 접수 처리', assigneeType: 'HR' as const, dueDaysBefore: 14, sortOrder: 1 },
  { title: '업무 인수인계 문서', description: '업무 인수인계 문서 작성', assigneeType: 'EMPLOYEE' as const, dueDaysBefore: 10, sortOrder: 2 },
  { title: '인수자 확인', description: '업무 인수자 확인', assigneeType: 'MANAGER' as const, dueDaysBefore: 7, sortOrder: 3 },
  { title: '장비 반납', description: 'IT 장비 반납', assigneeType: 'IT' as const, dueDaysBefore: 3, sortOrder: 4 },
  { title: '보안카드 반납', description: '보안카드 반납 처리', assigneeType: 'HR' as const, dueDaysBefore: 1, sortOrder: 5 },
  { title: '계정 비활성화', description: 'IT 계정 비활성화', assigneeType: 'IT' as const, dueDaysBefore: 0, sortOrder: 6 },
  { title: '퇴직면담', description: '퇴직 면담 진행', assigneeType: 'HR' as const, dueDaysBefore: 3, sortOrder: 7 },
  { title: '퇴직금 정산', description: '퇴직금 정산 처리', assigneeType: 'FINANCE' as const, dueDaysBefore: -7, sortOrder: 8 },
]

// ================================================================
// 12. SALARY BANDS (CTR-KR, 6 grades, OFFICE category)
// ================================================================
const salaryBandData = [
  { gradeCode: 'G1', min: 120_000_000, mid: 160_000_000, max: 200_000_000 },
  { gradeCode: 'G2', min: 80_000_000, mid: 105_000_000, max: 130_000_000 },
  { gradeCode: 'G3', min: 65_000_000, mid: 80_000_000, max: 95_000_000 },
  { gradeCode: 'G4', min: 50_000_000, mid: 62_500_000, max: 75_000_000 },
  { gradeCode: 'G5', min: 40_000_000, mid: 49_000_000, max: 58_000_000 },
  { gradeCode: 'G6', min: 32_000_000, mid: 38_500_000, max: 45_000_000 },
]

// ================================================================
// 13. BENEFIT POLICIES (CTR-KR, 3)
// ================================================================
const benefitPolicyData = [
  { name: '식대 지원', category: 'MEAL' as const, amount: 150_000, frequency: 'MONTHLY' as const, isTaxable: false },
  { name: '교통비 지원', category: 'TRANSPORT' as const, amount: 100_000, frequency: 'MONTHLY' as const, isTaxable: false },
  { name: '건강검진', category: 'HEALTH' as const, amount: 500_000, frequency: 'ANNUAL' as const, isTaxable: false },
]

// ================================================================
// 14. NOTIFICATION TRIGGERS
// ================================================================
const notificationTriggerData = [
  { eventType: 'LEAVE_APPROVED', template: '{{employee_name}}님의 휴가가 승인되었습니다', channels: ['IN_APP', 'EMAIL'] },
  { eventType: 'LEAVE_REJECTED', template: '{{employee_name}}님의 휴가가 반려되었습니다', channels: ['IN_APP', 'EMAIL'] },
  { eventType: 'OVERTIME_WARNING', template: '이번 주 근무시간이 {{hours}}시간입니다', channels: ['IN_APP', 'PUSH'] },
  { eventType: 'OVERTIME_CRITICAL', template: '주간 법정 근무시간 초과 위험', channels: ['IN_APP', 'PUSH', 'EMAIL'] },
  { eventType: 'ONBOARDING_CHECKIN', template: '온보딩 체크인 시간입니다', channels: ['IN_APP', 'PUSH'] },
  { eventType: 'TERMINAL_OFFLINE', template: '단말기 {{terminal_code}} 오프라인', channels: ['IN_APP', 'EMAIL'] },
  { eventType: 'ATTRITION_HIGH', template: '{{employee_name}} 이탈 위험 감지', channels: ['IN_APP', 'EMAIL'] },
]

// ================================================================
// 15. KOREAN HOLIDAYS 2025-2026
// ================================================================
const koreanHolidays = [
  // 2025
  { name: '신정', date: '2025-01-01', year: 2025 },
  { name: '설날 연휴', date: '2025-01-28', year: 2025 },
  { name: '설날', date: '2025-01-29', year: 2025 },
  { name: '설날 연휴', date: '2025-01-30', year: 2025 },
  { name: '삼일절', date: '2025-03-01', year: 2025 },
  { name: '어린이날', date: '2025-05-05', year: 2025 },
  { name: '부처님오신날', date: '2025-05-05', year: 2025, isSub: true },
  { name: '대체공휴일(부처님오신날)', date: '2025-05-06', year: 2025, isSub: true },
  { name: '현충일', date: '2025-06-06', year: 2025 },
  { name: '광복절', date: '2025-08-15', year: 2025 },
  { name: '추석 연휴', date: '2025-10-03', year: 2025 },
  { name: '추석', date: '2025-10-04', year: 2025 },
  { name: '추석 연휴', date: '2025-10-05', year: 2025 },
  { name: '추석 대체공휴일', date: '2025-10-06', year: 2025, isSub: true },
  { name: '개천절', date: '2025-10-03', year: 2025 },
  { name: '한글날', date: '2025-10-09', year: 2025 },
  { name: '성탄절', date: '2025-12-25', year: 2025 },
  // 2026
  { name: '신정', date: '2026-01-01', year: 2026 },
  { name: '설날 연휴', date: '2026-02-16', year: 2026 },
  { name: '설날', date: '2026-02-17', year: 2026 },
  { name: '설날 연휴', date: '2026-02-18', year: 2026 },
  { name: '삼일절', date: '2026-03-01', year: 2026 },
  { name: '어린이날', date: '2026-05-05', year: 2026 },
  { name: '부처님오신날', date: '2026-05-24', year: 2026 },
  { name: '현충일', date: '2026-06-06', year: 2026 },
  { name: '광복절', date: '2026-08-15', year: 2026 },
  { name: '추석 연휴', date: '2026-09-24', year: 2026 },
  { name: '추석', date: '2026-09-25', year: 2026 },
  { name: '추석 연휴', date: '2026-09-26', year: 2026 },
  { name: '개천절', date: '2026-10-03', year: 2026 },
  { name: '한글날', date: '2026-10-09', year: 2026 },
  { name: '성탄절', date: '2026-12-25', year: 2026 },
]

// ================================================================
// 16. TENANT SETTINGS (13 companies)
// ================================================================
const ALL_MODULES = [
  'CORE_HR', 'ATTENDANCE', 'LEAVE', 'PERFORMANCE', 'PAYROLL',
  'COMPENSATION', 'RECRUITMENT', 'OFFBOARDING', 'DISCIPLINE',
  'BENEFITS', 'TRAINING',
]
const BASIC_MODULES = ['CORE_HR', 'ATTENDANCE', 'LEAVE', 'PERFORMANCE']

interface TenantSettingInput {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  coreValues: string[]
  enabledModules: string[]
  defaultLocale: string
  timezone: string
  maxOvertimeWeeklyHours: number
}

function getTenantSettings(code: string, locale: string, tz: string): TenantSettingInput {
  const isKR = ['CTR-HQ', 'CTR-KR', 'CTR-MOB', 'CTR-ECO', 'CTR-ROB', 'CTR-ENG', 'FML'].includes(code)
  return {
    primaryColor: '#1B3A5C',
    secondaryColor: '#4A90D9',
    accentColor: '#F5A623',
    coreValues: ['CHALLENGE', 'TRUST', 'RESPONSIBILITY', 'RESPECT'],
    enabledModules: isKR ? ALL_MODULES : BASIC_MODULES,
    defaultLocale: locale,
    timezone: tz,
    maxOvertimeWeeklyHours: ['CTR-MX'].includes(code) ? 48 : isKR ? 52 : 45,
  }
}

// ================================================================
// 17. TERM OVERRIDES (14 keys × CTR-KR at minimum)
// ================================================================
const termKeys = [
  { key: 'department', labelKo: '부서', labelEn: 'Department' },
  { key: 'job_grade', labelKo: '직급', labelEn: 'Job Grade' },
  { key: 'employee_code', labelKo: '사번', labelEn: 'Employee Code' },
  { key: 'manager', labelKo: '관리자', labelEn: 'Manager' },
  { key: 'team', labelKo: '팀', labelEn: 'Team' },
  { key: 'position', labelKo: '보직', labelEn: 'Position' },
  { key: 'recognition', labelKo: '인정', labelEn: 'Recognition' },
  { key: 'one_on_one', labelKo: '1:1 미팅', labelEn: '1:1 Meeting' },
  { key: 'goal', labelKo: '목표', labelEn: 'Goal' },
  { key: 'evaluation', labelKo: '평가', labelEn: 'Evaluation' },
  { key: 'leave', labelKo: '휴가', labelEn: 'Leave' },
  { key: 'onboarding', labelKo: '온보딩', labelEn: 'Onboarding' },
  { key: 'offboarding', labelKo: '퇴직처리', labelEn: 'Offboarding' },
  { key: 'discipline', labelKo: '징계', labelEn: 'Discipline' },
]

// ================================================================
// 18. TENANT ENUM OPTIONS
// ================================================================
interface EnumOptionDef { group: string; key: string; label: string; sortOrder: number }

const enumOptionData: EnumOptionDef[] = [
  // leave_type (7)
  { group: 'leave_type', key: 'ANNUAL', label: '연차', sortOrder: 1 },
  { group: 'leave_type', key: 'SICK', label: '병가', sortOrder: 2 },
  { group: 'leave_type', key: 'MATERNITY', label: '출산휴가', sortOrder: 3 },
  { group: 'leave_type', key: 'PATERNITY', label: '배우자출산휴가', sortOrder: 4 },
  { group: 'leave_type', key: 'BEREAVEMENT', label: '경조사휴가', sortOrder: 5 },
  { group: 'leave_type', key: 'SPECIAL', label: '특별휴가', sortOrder: 6 },
  { group: 'leave_type', key: 'COMPENSATORY', label: '대체휴가', sortOrder: 7 },
  // employment_type (4)
  { group: 'employment_type', key: 'FULL_TIME', label: '정규직', sortOrder: 1 },
  { group: 'employment_type', key: 'CONTRACT', label: '계약직', sortOrder: 2 },
  { group: 'employment_type', key: 'DISPATCH', label: '파견직', sortOrder: 3 },
  { group: 'employment_type', key: 'INTERN', label: '인턴', sortOrder: 4 },
  // disciplinary_type (7)
  { group: 'disciplinary_type', key: 'VERBAL_WARNING', label: '구두경고', sortOrder: 1 },
  { group: 'disciplinary_type', key: 'WRITTEN_WARNING', label: '서면경고', sortOrder: 2 },
  { group: 'disciplinary_type', key: 'REPRIMAND', label: '견책', sortOrder: 3 },
  { group: 'disciplinary_type', key: 'SUSPENSION', label: '정직', sortOrder: 4 },
  { group: 'disciplinary_type', key: 'PAY_CUT', label: '감봉', sortOrder: 5 },
  { group: 'disciplinary_type', key: 'DEMOTION', label: '강등', sortOrder: 6 },
  { group: 'disciplinary_type', key: 'TERMINATION', label: '해고', sortOrder: 7 },
  // reward_type (7)
  { group: 'reward_type', key: 'COMMENDATION', label: '표창', sortOrder: 1 },
  { group: 'reward_type', key: 'BONUS_AWARD', label: '포상금', sortOrder: 2 },
  { group: 'reward_type', key: 'PROMOTION_RECOMMENDATION', label: '승진추천', sortOrder: 3 },
  { group: 'reward_type', key: 'LONG_SERVICE', label: '장기근속', sortOrder: 4 },
  { group: 'reward_type', key: 'INNOVATION', label: '혁신상', sortOrder: 5 },
  { group: 'reward_type', key: 'SAFETY_AWARD', label: '안전상', sortOrder: 6 },
  { group: 'reward_type', key: 'OTHER', label: '기타', sortOrder: 7 },
  // exit_reason (8)
  { group: 'exit_reason', key: 'COMPENSATION', label: '보상불만', sortOrder: 1 },
  { group: 'exit_reason', key: 'CAREER_GROWTH', label: '경력개발', sortOrder: 2 },
  { group: 'exit_reason', key: 'WORK_LIFE_BALANCE', label: '워라밸', sortOrder: 3 },
  { group: 'exit_reason', key: 'MANAGEMENT', label: '경영/관리', sortOrder: 4 },
  { group: 'exit_reason', key: 'CULTURE', label: '조직문화', sortOrder: 5 },
  { group: 'exit_reason', key: 'RELOCATION', label: '이직/이전', sortOrder: 6 },
  { group: 'exit_reason', key: 'PERSONAL', label: '개인사유', sortOrder: 7 },
  { group: 'exit_reason', key: 'OTHER', label: '기타', sortOrder: 8 },
  // training_category (6)
  { group: 'training_category', key: 'COMPLIANCE', label: '법정필수교육', sortOrder: 1 },
  { group: 'training_category', key: 'TECHNICAL', label: '기술교육', sortOrder: 2 },
  { group: 'training_category', key: 'LEADERSHIP', label: '리더십교육', sortOrder: 3 },
  { group: 'training_category', key: 'SAFETY_TRAINING', label: '안전교육', sortOrder: 4 },
  { group: 'training_category', key: 'ONBOARDING_TRAINING', label: '입문교육', sortOrder: 5 },
  { group: 'training_category', key: 'OTHER', label: '기타', sortOrder: 6 },
  // benefit_category (9)
  { group: 'benefit_category', key: 'MEAL', label: '식대', sortOrder: 1 },
  { group: 'benefit_category', key: 'TRANSPORT', label: '교통비', sortOrder: 2 },
  { group: 'benefit_category', key: 'EDUCATION', label: '교육비', sortOrder: 3 },
  { group: 'benefit_category', key: 'HEALTH', label: '건강검진', sortOrder: 4 },
  { group: 'benefit_category', key: 'HOUSING', label: '주거지원', sortOrder: 5 },
  { group: 'benefit_category', key: 'CHILDCARE', label: '보육수당', sortOrder: 6 },
  { group: 'benefit_category', key: 'LEISURE', label: '복지포인트', sortOrder: 7 },
  { group: 'benefit_category', key: 'INSURANCE', label: '보험', sortOrder: 8 },
  { group: 'benefit_category', key: 'OTHER', label: '기타', sortOrder: 9 },
  // clock_method (5)
  { group: 'clock_method', key: 'WEB', label: '웹', sortOrder: 1 },
  { group: 'clock_method', key: 'MOBILE_GPS', label: '모바일GPS', sortOrder: 2 },
  { group: 'clock_method', key: 'QR', label: 'QR코드', sortOrder: 3 },
  { group: 'clock_method', key: 'FINGERPRINT', label: '지문인식', sortOrder: 4 },
  { group: 'clock_method', key: 'CARD_READER', label: '카드리더', sortOrder: 5 },
  // MX allowance_type — STEP 2.5 (법정수당 멕시코)
  { group: 'allowance_type', key: 'MX_PTU', label: 'PTU (이익분배)', sortOrder: 1 },
  { group: 'allowance_type', key: 'MX_AGUINALDO', label: 'Aguinaldo (연말상여)', sortOrder: 2 },
  { group: 'allowance_type', key: 'MX_PRIMA_VACACIONAL', label: 'Prima Vacacional (휴가수당)', sortOrder: 3 },
  { group: 'allowance_type', key: 'MX_SUNDAY_PREMIUM', label: 'Prima Dominical (일요할증)', sortOrder: 4 },
  // RU bonus_type — STEP 2.5 (13번째 월급 러시아)
  { group: 'bonus_type', key: 'RU_13TH_SALARY', label: '13번째 월급 (러시아)', sortOrder: 1 },
]

// ================================================================
// 19. WORKFLOW RULES (CTR-KR, 4 rules + steps)
// ================================================================
interface WorkflowDef {
  workflowType: string
  name: string
  totalSteps: number
  steps: Array<{ stepOrder: number; approverType: 'DIRECT_MANAGER' | 'DEPARTMENT_HEAD' | 'HR_ADMIN' | 'SPECIFIC_ROLE'; approverRoleCode?: string }>
}

const workflowData: WorkflowDef[] = [
  {
    workflowType: 'LEAVE_APPROVAL',
    name: '휴가 승인',
    totalSteps: 1,
    steps: [{ stepOrder: 1, approverType: 'DIRECT_MANAGER' }],
  },
  {
    workflowType: 'PROFILE_CHANGE',
    name: '인사정보 변경 승인',
    totalSteps: 1,
    steps: [{ stepOrder: 1, approverType: 'SPECIFIC_ROLE', approverRoleCode: 'HR_ADMIN' }],
  },
  {
    workflowType: 'GOAL_APPROVAL',
    name: '목표 승인',
    totalSteps: 1,
    steps: [{ stepOrder: 1, approverType: 'DIRECT_MANAGER' }],
  },
  {
    workflowType: 'PAYROLL_APPROVAL',
    name: '급여 승인',
    totalSteps: 2,
    steps: [
      { stepOrder: 1, approverType: 'SPECIFIC_ROLE', approverRoleCode: 'HR_ADMIN' },
      { stepOrder: 2, approverType: 'SPECIFIC_ROLE', approverRoleCode: 'EXECUTIVE' },
    ],
  },
]

// ================================================================
// 20. EMAIL TEMPLATES (CTR-KR, ko, ~15 system)
// ================================================================
interface EmailTemplateDef {
  eventType: string
  channel: 'EMAIL' | 'PUSH' | 'IN_APP'
  subject: string
  body: string
  variables: string[]
}

const emailTemplateData: EmailTemplateDef[] = [
  { eventType: 'LEAVE_APPROVED', channel: 'EMAIL', subject: '휴가 승인 안내', body: '{{employee_name}}님의 휴가가 승인되었습니다.\n기간: {{start_date}} ~ {{end_date}}', variables: ['employee_name', 'start_date', 'end_date'] },
  { eventType: 'LEAVE_REJECTED', channel: 'EMAIL', subject: '휴가 반려 안내', body: '{{employee_name}}님의 휴가가 반려되었습니다.\n사유: {{reason}}', variables: ['employee_name', 'reason'] },
  { eventType: 'ONBOARDING_WELCOME', channel: 'EMAIL', subject: 'CTR 입사를 환영합니다', body: '{{employee_name}}님, CTR에 오신 것을 환영합니다!\n입사일: {{hire_date}}', variables: ['employee_name', 'hire_date'] },
  { eventType: 'EVAL_REMINDER', channel: 'EMAIL', subject: '평가 마감 안내', body: '{{cycle_name}} 평가 마감 {{days_left}}일 전입니다.', variables: ['cycle_name', 'days_left'] },
  { eventType: 'EVAL_REMINDER', channel: 'PUSH', subject: '평가 마감 알림', body: '{{cycle_name}} 평가 마감 {{days_left}}일 전', variables: ['cycle_name', 'days_left'] },
  { eventType: 'OVERTIME_WARNING', channel: 'PUSH', subject: '근무시간 경고', body: '이번 주 근무시간이 {{hours}}시간입니다.', variables: ['hours'] },
  { eventType: 'ONE_ON_ONE_REMINDER', channel: 'PUSH', subject: '1:1 미팅 알림', body: '{{manager_name}}님과 1:1이 1시간 후 예정', variables: ['manager_name'] },
  { eventType: 'PEER_REVIEW_ASSIGNED', channel: 'EMAIL', subject: '다면평가 참여 요청', body: '{{employee_name}}님의 다면평가에 참여해주세요.', variables: ['employee_name'] },
  { eventType: 'CHATBOT_ESCALATION', channel: 'PUSH', subject: 'HR 챗봇 에스컬레이션', body: 'HR 챗봇 에스컬레이션 - {{question_preview}}', variables: ['question_preview'] },
  { eventType: 'PASSWORD_RESET', channel: 'EMAIL', subject: '비밀번호 재설정', body: '비밀번호 재설정 링크: {{reset_link}}', variables: ['reset_link'] },
  { eventType: 'OFFBOARDING_NOTICE', channel: 'EMAIL', subject: '퇴직 처리 안내', body: '{{employee_name}}님의 퇴직 처리가 시작되었습니다.\n최종근무일: {{last_working_date}}', variables: ['employee_name', 'last_working_date'] },
  { eventType: 'SALARY_CHANGE', channel: 'EMAIL', subject: '급여 변경 안내', body: '{{employee_name}}님의 급여가 변경되었습니다.\n적용일: {{effective_date}}', variables: ['employee_name', 'effective_date'] },
  { eventType: 'ATTENDANCE_ANOMALY', channel: 'IN_APP', subject: '근태 이상 알림', body: '{{employee_name}}님의 근태 이상이 감지되었습니다.', variables: ['employee_name'] },
  { eventType: 'RECOGNITION_RECEIVED', channel: 'IN_APP', subject: '인정 알림', body: '{{sender_name}}님이 {{employee_name}}님을 인정하였습니다.', variables: ['sender_name', 'employee_name'] },
  { eventType: 'TRAINING_ENROLLED', channel: 'EMAIL', subject: '교육 등록 안내', body: '{{employee_name}}님이 {{course_name}} 교육에 등록되었습니다.', variables: ['employee_name', 'course_name'] },
  // STEP 2.5 — 계약 만료 알림
  { eventType: 'CONTRACT_EXPIRY_30D', channel: 'EMAIL', subject: '계약 만료 30일 전 안내', body: '{{employee_name}}님의 계약이 {{days_left}}일 후 만료됩니다.\n만료일: {{end_date}}', variables: ['employee_name', 'days_left', 'end_date'] },
  { eventType: 'CONTRACT_EXPIRY_30D', channel: 'IN_APP', subject: '계약 만료 임박', body: '{{employee_name}} 계약 만료 D-{{days_left}}', variables: ['employee_name', 'days_left'] },
  { eventType: 'CONTRACT_EXPIRY_7D', channel: 'EMAIL', subject: '계약 만료 7일 전 긴급 안내', body: '{{employee_name}}님의 계약이 7일 후 만료됩니다. 즉시 처리가 필요합니다.', variables: ['employee_name', 'end_date'] },
  // STEP 2.5 — 비자/취업허가 만료 알림
  { eventType: 'WORK_PERMIT_EXPIRY_90D', channel: 'EMAIL', subject: '취업허가 만료 90일 전 안내', body: '{{employee_name}}님의 {{permit_type}} 만료 90일 전입니다.\n만료일: {{expiry_date}}', variables: ['employee_name', 'permit_type', 'expiry_date'] },
  { eventType: 'WORK_PERMIT_EXPIRY_30D', channel: 'EMAIL', subject: '취업허가 만료 30일 전 긴급 안내', body: '{{employee_name}}님의 {{permit_type}}이 30일 후 만료됩니다. 갱신 조치가 필요합니다.', variables: ['employee_name', 'permit_type', 'expiry_date'] },
  // STEP 2.5 — 연차 사용 촉진
  { eventType: 'LEAVE_PROMOTION_STEP1', channel: 'EMAIL', subject: '연차 사용 촉진 1차 안내', body: '{{employee_name}}님의 미사용 연차 {{remaining_days}}일이 있습니다. 사용 계획을 제출해주세요.', variables: ['employee_name', 'remaining_days'] },
  { eventType: 'LEAVE_PROMOTION_STEP2', channel: 'EMAIL', subject: '연차 사용 촉진 2차 안내', body: '{{employee_name}}님의 연차 사용 일정을 2주 내 제출해주세요.', variables: ['employee_name', 'remaining_days'] },
  { eventType: 'LEAVE_PROMOTION_STEP3', channel: 'EMAIL', subject: '연차 지정 통보', body: '{{employee_name}}님의 미사용 연차에 대해 사용 일정을 지정 통보합니다.', variables: ['employee_name', 'designated_dates'] },
]

// ================================================================
// 21. EXPORT TEMPLATES (CTR-KR, 3)
// ================================================================
const exportTemplateData = [
  {
    entityType: 'EMPLOYEE',
    name: '사원 기본 정보',
    columns: ['employee_no', 'name', 'department', 'job_grade', 'hire_date', 'status'],
    fileFormat: 'CSV' as const,
    isDefault: true,
  },
  {
    entityType: 'ATTENDANCE',
    name: '근태 현황',
    columns: ['employee_no', 'name', 'work_date', 'clock_in', 'clock_out', 'total_minutes', 'overtime_minutes'],
    fileFormat: 'CSV' as const,
    isDefault: true,
  },
  {
    entityType: 'PAYROLL',
    name: '급여 대장',
    columns: ['employee_no', 'name', 'base_salary', 'overtime_pay', 'bonus', 'deductions', 'net_pay'],
    fileFormat: 'XLSX' as const,
    isDefault: true,
  },
]

// ================================================================
// MAIN SEED FUNCTION
// ================================================================
async function main() {
  console.log('🌱 Starting CTR HR Hub v3.2 seed...\n')

  // ----------------------------------------------------------
  // STEP 1: Seed Companies (parent first, then children)
  // ----------------------------------------------------------
  console.log('📌 Seeding companies...')
  const companyMap: Record<string, string> = {} // code -> id

  // First pass: create parent company
  for (const c of companyData.filter(c => c.parentCode === null)) {
    const id = deterministicUUID('company', c.code)
    const company = await prisma.company.upsert({
      where: { code: c.code },
      update: { name: c.name, nameEn: c.nameEn, countryCode: c.countryCode, timezone: c.timezone, locale: c.locale, currency: c.currency, payrollMode: c.payrollMode, payrollFrequencies: c.payrollFrequencies },
      create: { id, code: c.code, name: c.name, nameEn: c.nameEn, countryCode: c.countryCode, timezone: c.timezone, locale: c.locale, currency: c.currency, payrollMode: c.payrollMode, payrollFrequencies: c.payrollFrequencies },
    })
    companyMap[c.code] = company.id
  }

  // Second pass: children
  for (const c of companyData.filter(c => c.parentCode !== null)) {
    const id = deterministicUUID('company', c.code)
    const parentId = companyMap[c.parentCode!]
    const company = await prisma.company.upsert({
      where: { code: c.code },
      update: { name: c.name, nameEn: c.nameEn, countryCode: c.countryCode, timezone: c.timezone, locale: c.locale, currency: c.currency, parentCompanyId: parentId, payrollMode: c.payrollMode, payrollFrequencies: c.payrollFrequencies },
      create: { id, code: c.code, name: c.name, nameEn: c.nameEn, countryCode: c.countryCode, timezone: c.timezone, locale: c.locale, currency: c.currency, parentCompanyId: parentId, payrollMode: c.payrollMode, payrollFrequencies: c.payrollFrequencies },
    })
    companyMap[c.code] = company.id
  }
  console.log(`  ✅ ${Object.keys(companyMap).length} companies`)

  // ----------------------------------------------------------
  // STEP 2: Seed Roles
  // ----------------------------------------------------------
  console.log('📌 Seeding roles...')
  const roleMap: Record<string, string> = {} // code -> id

  for (const r of roleData) {
    const id = deterministicUUID('role', r.code)
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, isSystem: r.isSystem },
      create: { id, code: r.code, name: r.name, isSystem: r.isSystem },
    })
    roleMap[r.code] = role.id
  }
  console.log(`  ✅ ${Object.keys(roleMap).length} roles`)

  // ----------------------------------------------------------
  // STEP 3: Seed Permissions (66)
  // ----------------------------------------------------------
  console.log('📌 Seeding permissions...')
  const permMap: Record<string, string> = {} // module_action -> id

  for (const mod of modules) {
    for (const act of actions) {
      const code = `${mod}_${act}`
      const id = deterministicUUID('permission', code)
      const perm = await prisma.permission.upsert({
        where: { id },
        update: { module: mod, resource: mod, action: act, description: `${mod} ${act}` },
        create: { id, module: mod, resource: mod, action: act, description: `${mod} ${act}` },
      })
      permMap[code] = perm.id
    }
  }
  console.log(`  ✅ ${Object.keys(permMap).length} permissions`)

  // ----------------------------------------------------------
  // STEP 4: Seed RolePermissions
  // ----------------------------------------------------------
  console.log('📌 Seeding role-permissions...')
  const rolePermissions = buildRolePermissions()
  let rpCount = 0

  for (const [roleCode, permKeys] of Object.entries(rolePermissions)) {
    const roleId = roleMap[roleCode]
    for (const pk of permKeys) {
      const permissionId = permMap[pk]
      if (!permissionId) continue
      const id = deterministicUUID('roleperm', `${roleCode}:${pk}`)
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { id, roleId, permissionId },
      })
      rpCount++
    }
  }
  console.log(`  ✅ ${rpCount} role-permissions`)

  // ----------------------------------------------------------
  // STEP 5: Seed Job Categories (4 per company)
  // ----------------------------------------------------------
  console.log('📌 Seeding job categories...')
  const jobCatMap: Record<string, string> = {} // companyCode:catCode -> id
  let jcCount = 0

  for (const [code, companyId] of Object.entries(companyMap)) {
    for (const jc of jobCategoryEntries) {
      const id = deterministicUUID('jobcat', `${code}:${jc.code}`)
      await prisma.jobCategory.upsert({
        where: { id },
        update: { name: jc.name, isActive: true },
        create: { id, companyId, code: jc.code, name: jc.name, isActive: true },
      })
      jobCatMap[`${code}:${jc.code}`] = id
      jcCount++
    }
  }
  console.log(`  ✅ ${jcCount} job categories`)

  // ----------------------------------------------------------
  // STEP 6: Seed Departments (CTR-KR)
  // ----------------------------------------------------------
  console.log('📌 Seeding departments (CTR-KR)...')
  const ctrKrId = companyMap['CTR-KR']
  const deptMap: Record<string, string> = {} // code -> id

  // First pass: no parent
  for (const d of departmentData.filter(d => d.parentCode === null)) {
    const id = deterministicUUID('dept', `CTR-KR:${d.code}`)
    const dept = await prisma.department.upsert({
      where: { companyId_code: { companyId: ctrKrId, code: d.code } },
      update: { name: d.name, nameEn: d.nameEn, level: d.level, sortOrder: d.sortOrder },
      create: { id, companyId: ctrKrId, code: d.code, name: d.name, nameEn: d.nameEn, level: d.level, sortOrder: d.sortOrder },
    })
    deptMap[d.code] = dept.id
  }

  // Second pass: with parent
  for (const d of departmentData.filter(d => d.parentCode !== null)) {
    const id = deterministicUUID('dept', `CTR-KR:${d.code}`)
    const dept = await prisma.department.upsert({
      where: { companyId_code: { companyId: ctrKrId, code: d.code } },
      update: { name: d.name, nameEn: d.nameEn, level: d.level, sortOrder: d.sortOrder, parentId: deptMap[d.parentCode!] },
      create: { id, companyId: ctrKrId, code: d.code, name: d.name, nameEn: d.nameEn, level: d.level, sortOrder: d.sortOrder, parentId: deptMap[d.parentCode!] },
    })
    deptMap[d.code] = dept.id
  }
  console.log(`  ✅ ${Object.keys(deptMap).length} departments`)

  // ----------------------------------------------------------
  // STEP 7: Seed Job Grades (CTR-KR, 6)
  // Also seed for CTR-HQ for SUPER_ADMIN employee
  // ----------------------------------------------------------
  console.log('📌 Seeding job grades...')
  const gradeMap: Record<string, string> = {} // companyCode:gradeCode -> id

  for (const companyCode of ['CTR-HQ', 'CTR-KR']) {
    const compId = companyMap[companyCode]
    for (const g of jobGradeData) {
      const id = deterministicUUID('grade', `${companyCode}:${g.code}`)
      const grade = await prisma.jobGrade.upsert({
        where: { id },
        update: { name: g.name, rankOrder: g.rankOrder },
        create: { id, companyId: compId, code: g.code, name: g.name, rankOrder: g.rankOrder },
      })
      gradeMap[`${companyCode}:${g.code}`] = grade.id
    }
  }
  console.log(`  ✅ ${Object.keys(gradeMap).length} job grades`)

  // We also need departments for CTR-HQ for the SUPER_ADMIN employee
  const ctrHqId = companyMap['CTR-HQ']
  const hqDeptId = deterministicUUID('dept', 'CTR-HQ:MGMT')
  await prisma.department.upsert({
    where: { companyId_code: { companyId: ctrHqId, code: 'MGMT' } },
    update: { name: '경영지원본부', level: 1, sortOrder: 1 },
    create: { id: hqDeptId, companyId: ctrHqId, code: 'MGMT', name: '경영지원본부', nameEn: 'Management Support', level: 1, sortOrder: 1 },
  })

  // And a job category for CTR-HQ: OFFICE
  const hqOfficeCatId = jobCatMap['CTR-HQ:OFFICE']

  // ----------------------------------------------------------
  // STEP 8: Seed Test Accounts (4)
  // ----------------------------------------------------------
  console.log('📌 Seeding test accounts...')

  // Map employee to their department / grade / category
  const empConfig: Record<string, { deptCode: string; gradeCode: string; catCode: string }> = {
    'admin@ctr.co.kr': { deptCode: 'MGMT', gradeCode: 'G1', catCode: 'OFFICE' },
    'hr@ctr.co.kr': { deptCode: 'HR', gradeCode: 'G4', catCode: 'OFFICE' },
    'manager@ctr.co.kr': { deptCode: 'DEV', gradeCode: 'G3', catCode: 'OFFICE' },
    'employee@ctr.co.kr': { deptCode: 'DEV', gradeCode: 'G6', catCode: 'OFFICE' },
  }

  const employeeMap: Record<string, string> = {} // email -> id

  for (const acc of testAccounts) {
    const empId = deterministicUUID('employee', acc.email)
    const conf = empConfig[acc.email]
    const compId = companyMap[acc.companyCode]

    // For CTR-HQ admin, use HQ department; for CTR-KR employees, use CTR-KR departments
    let deptId: string
    let gradeId: string
    let catId: string

    if (acc.companyCode === 'CTR-HQ') {
      deptId = hqDeptId
      gradeId = gradeMap[`CTR-HQ:${conf.gradeCode}`]
      catId = hqOfficeCatId
    } else {
      deptId = deptMap[conf.deptCode]
      gradeId = gradeMap[`CTR-KR:${conf.gradeCode}`]
      catId = jobCatMap[`CTR-KR:${conf.catCode}`]
    }

    // Create / upsert employee (companyId/departmentId/status/employmentType are on EmployeeAssignment now)
    const emp = await prisma.employee.upsert({
      where: { employeeNo: acc.employeeNo },
      update: {
        name: acc.name,
        nameEn: acc.nameEn,
        email: acc.email,
      },
      create: {
        id: empId,
        employeeNo: acc.employeeNo,
        name: acc.name,
        nameEn: acc.nameEn,
        email: acc.email,
        hireDate: new Date('2024-01-01'),
      },
    })
    employeeMap[acc.email] = emp.id

    // Create EmployeeAssignment (primary, active)
    const assignId = deterministicUUID('assignment', acc.email)
    const existingAssign = await prisma.employeeAssignment.findFirst({
      where: { employeeId: emp.id, isPrimary: true, endDate: null },
    })
    if (!existingAssign) {
      await prisma.employeeAssignment.create({
        data: {
          id: assignId,
          employeeId: emp.id,
          companyId: compId,
          departmentId: deptId,
          jobGradeId: gradeId,
          jobCategoryId: catId,
          effectiveDate: new Date('2024-01-01'),
          changeType: 'HIRE',
          employmentType: 'FULL_TIME',
          status: 'ACTIVE',
          isPrimary: true,
        },
      })
    }

    // EmployeeAuth
    const authId = deterministicUUID('auth', acc.email)
    await prisma.employeeAuth.upsert({
      where: { employeeId: emp.id },
      update: { passwordHash: TEST_PASSWORD_HASH },
      create: { id: authId, employeeId: emp.id, passwordHash: TEST_PASSWORD_HASH },
    })

    // SsoIdentity
    const ssoId = deterministicUUID('sso', acc.email)
    const providerAccountId = deterministicUUID('sso-provider', acc.email)
    await prisma.ssoIdentity.upsert({
      where: { provider_providerAccountId: { provider: 'azure-ad', providerAccountId } },
      update: { email: acc.email },
      create: { id: ssoId, employeeId: emp.id, provider: 'azure-ad', providerAccountId, email: acc.email },
    })

    // EmployeeRole
    const eroleId = deterministicUUID('emprole', `${acc.email}:${acc.roleCode}`)
    const roleId = roleMap[acc.roleCode]
    await prisma.employeeRole.upsert({
      where: { employeeId_roleId_companyId: { employeeId: emp.id, roleId, companyId: compId } },
      update: {},
      create: { id: eroleId, employeeId: emp.id, roleId, companyId: compId, startDate: new Date('2024-01-01') },
    })
  }
  console.log(`  ✅ ${testAccounts.length} test accounts (employee + auth + sso + role)`)

  // ----------------------------------------------------------
  // STEP 9: Seed EMS Block Config (CTR-KR)
  // ----------------------------------------------------------
  console.log('📌 Seeding EMS block config...')
  const emsId = deterministicUUID('ems', 'CTR-KR')
  await prisma.emsBlockConfig.upsert({
    where: { id: emsId },
    update: {
      performanceThresholds: [0, 2.33, 3.67, 5.01],
      competencyThresholds: [0, 2.33, 3.67, 5.01],
      blockDefinitions: emsBlockDefinitions,
    },
    create: {
      id: emsId,
      companyId: ctrKrId,
      performanceAxisLabels: { low: 'Low', medium: 'Medium', high: 'High' },
      competencyAxisLabels: { A: 'Low', B: 'Medium', C: 'High' },
      performanceThresholds: [0, 2.33, 3.67, 5.01],
      competencyThresholds: [0, 2.33, 3.67, 5.01],
      blockDefinitions: emsBlockDefinitions,
    },
  })
  console.log('  ✅ 1 EMS block config (9 blocks)')

  // ----------------------------------------------------------
  // STEP 10: Seed Onboarding Template + Tasks (CTR-KR)
  // ----------------------------------------------------------
  console.log('📌 Seeding onboarding template...')
  const obTplId = deterministicUUID('onbtpl', 'CTR-KR:NEW_HIRE')
  await prisma.onboardingTemplate.upsert({
    where: { id: obTplId },
    update: { name: '신규입사 온보딩', isActive: true },
    create: {
      id: obTplId,
      companyId: ctrKrId,
      name: '신규입사 온보딩',
      description: 'CTR 신규 입사자 기본 온보딩 프로세스',
      targetType: 'NEW_HIRE',
      isActive: true,
    },
  })

  for (const t of onboardingTasks) {
    const tid = deterministicUUID('onbtask', `CTR-KR:${t.title}`)
    await prisma.onboardingTask.upsert({
      where: { id: tid },
      update: { title: t.title, description: t.description, assigneeType: t.assigneeType, dueDaysAfter: t.dueDaysAfter, sortOrder: t.sortOrder, category: t.category },
      create: { id: tid, templateId: obTplId, title: t.title, description: t.description, assigneeType: t.assigneeType, dueDaysAfter: t.dueDaysAfter, sortOrder: t.sortOrder, isRequired: true, category: t.category },
    })
  }
  console.log(`  ✅ 1 onboarding template + ${onboardingTasks.length} tasks`)

  // ----------------------------------------------------------
  // B5: CTR-US 온보딩 템플릿 (영문)
  // ----------------------------------------------------------
  const ctrUsId = companyMap['CTR-US']
  if (ctrUsId) {
    const usObTplId = deterministicUUID('onbtpl', 'CTR-US:NEW_HIRE')
    await prisma.onboardingTemplate.upsert({
      where: { id: usObTplId },
      update: { name: 'New Employee Onboarding', isActive: true },
      create: {
        id: usObTplId,
        companyId: ctrUsId,
        name: 'New Employee Onboarding',
        description: 'CTR US standard onboarding process for new hires',
        targetType: 'NEW_HIRE',
        planType: 'ONBOARDING',
        isActive: true,
      },
    })
    const usTasks = [
      { title: 'I-9 Employment Eligibility Verification', description: 'Complete Form I-9 with HR within 3 business days', assigneeType: 'HR' as const, dueDaysAfter: 1, sortOrder: 1, category: 'DOCUMENT' as const },
      { title: 'W-4 Federal Tax Withholding', description: 'Submit W-4 form for payroll tax setup', assigneeType: 'HR' as const, dueDaysAfter: 1, sortOrder: 2, category: 'DOCUMENT' as const },
      { title: 'Benefits Enrollment', description: 'Enroll in health, dental, vision, and 401(k) plans', assigneeType: 'HR' as const, dueDaysAfter: 7, sortOrder: 3, category: 'SETUP' as const },
      { title: 'Equipment & System Setup', description: 'Laptop, badge, email, VPN access configuration', assigneeType: 'HR' as const, dueDaysAfter: 1, sortOrder: 4, category: 'SETUP' as const },
      { title: 'Safety & Compliance Training', description: 'Complete mandatory OSHA and workplace safety modules', assigneeType: 'MANAGER' as const, dueDaysAfter: 5, sortOrder: 5, category: 'TRAINING' as const },
      { title: 'Department Introduction & Tour', description: 'Meet team members and tour the facility', assigneeType: 'MANAGER' as const, dueDaysAfter: 1, sortOrder: 6, category: 'INTRODUCTION' as const },
      { title: 'Job-Specific Training Plan', description: 'Review 90-day role training roadmap with manager', assigneeType: 'MANAGER' as const, dueDaysAfter: 3, sortOrder: 7, category: 'TRAINING' as const },
      { title: 'Ethics & Code of Conduct', description: 'Complete ethics policy acknowledgment', assigneeType: 'HR' as const, dueDaysAfter: 3, sortOrder: 8, category: 'OTHER' as const },
      { title: '30-Day Check-in with HR', description: 'Schedule and complete 30-day onboarding review', assigneeType: 'HR' as const, dueDaysAfter: 30, sortOrder: 9, category: 'OTHER' as const },
      { title: '90-Day Performance Review', description: 'Complete 90-day review with direct manager', assigneeType: 'MANAGER' as const, dueDaysAfter: 90, sortOrder: 10, category: 'OTHER' as const },
    ]
    for (const t of usTasks) {
      const tid = deterministicUUID('onbtask', `CTR-US:${t.title}`)
      await prisma.onboardingTask.upsert({
        where: { id: tid },
        update: { title: t.title, description: t.description, assigneeType: t.assigneeType as any, dueDaysAfter: t.dueDaysAfter, sortOrder: t.sortOrder, category: t.category as any },
        create: { id: tid, templateId: usObTplId, title: t.title, description: t.description, assigneeType: t.assigneeType as any, dueDaysAfter: t.dueDaysAfter, sortOrder: t.sortOrder, isRequired: true, category: t.category as any },
      })
    }
    console.log(`  ✅ CTR-US onboarding template + ${usTasks.length} tasks`)
  }

  // ----------------------------------------------------------
  // B5: 글로벌 기본 온보딩 템플릿 (companyId = null)
  // ----------------------------------------------------------
  const globalObTplId = deterministicUUID('onbtpl', 'GLOBAL:NEW_HIRE')
  await prisma.onboardingTemplate.upsert({
    where: { id: globalObTplId },
    update: { name: '글로벌 표준 온보딩', isActive: true },
    create: {
      id: globalObTplId,
      companyId: null,
      name: '글로벌 표준 온보딩',
      description: '법인 공통 적용 기본 온보딩 템플릿',
      targetType: 'NEW_HIRE',
      planType: 'ONBOARDING',
      isActive: true,
    },
  })
  const globalObTasks = [
    { title: '입사 서류 제출', description: '재직증명서, 주민등록증 사본 등 필수 서류 제출', assigneeType: 'HR' as const, dueDaysAfter: 1, sortOrder: 1, category: 'DOCUMENT' as const },
    { title: 'IT 계정 및 장비 설정', description: '이메일 계정, 사내 시스템 접근 권한, 노트북 지급', assigneeType: 'HR' as const, dueDaysAfter: 1, sortOrder: 2, category: 'SETUP' as const },
    { title: '회사 정책 및 행동강령 교육', description: '윤리강령, 보안정책, 개인정보 처리방침 이수', assigneeType: 'HR' as const, dueDaysAfter: 3, sortOrder: 3, category: 'OTHER' as const },
    { title: '조직 소개 및 주요 관계자 미팅', description: '부서 소개, 핵심 협업 부서 인사', assigneeType: 'MANAGER' as const, dueDaysAfter: 2, sortOrder: 4, category: 'INTRODUCTION' as const },
    { title: '직무 교육 계획 수립', description: '30/60/90일 직무 로드맵 작성 및 공유', assigneeType: 'MANAGER' as const, dueDaysAfter: 5, sortOrder: 5, category: 'TRAINING' as const },
    { title: '30일 온보딩 체크인', description: '온보딩 중간 점검 및 적응 지원', assigneeType: 'HR' as const, dueDaysAfter: 30, sortOrder: 6, category: 'OTHER' as const },
    { title: '90일 수습 평가', description: '수습 기간 종료 성과 평가 및 정규직 전환 검토', assigneeType: 'MANAGER' as const, dueDaysAfter: 90, sortOrder: 7, category: 'OTHER' as const },
  ]
  for (const t of globalObTasks) {
    const tid = deterministicUUID('onbtask', `GLOBAL:OB:${t.title}`)
    await prisma.onboardingTask.upsert({
      where: { id: tid },
      update: { title: t.title, description: t.description, assigneeType: t.assigneeType as any, dueDaysAfter: t.dueDaysAfter, sortOrder: t.sortOrder, category: t.category as any },
      create: { id: tid, templateId: globalObTplId, title: t.title, description: t.description, assigneeType: t.assigneeType as any, dueDaysAfter: t.dueDaysAfter, sortOrder: t.sortOrder, isRequired: true, category: t.category as any },
    })
  }
  console.log(`  ✅ 글로벌 기본 온보딩 + ${globalObTasks.length} tasks`)

  // ----------------------------------------------------------
  // B5: Cross-boarding 출발 템플릿 (글로벌)
  // ----------------------------------------------------------
  const xdepTplId = deterministicUUID('onbtpl', 'GLOBAL:CROSSBOARDING_DEPARTURE')
  await prisma.onboardingTemplate.upsert({
    where: { id: xdepTplId },
    update: { name: '크로스보딩 출발 체크리스트', isActive: true },
    create: {
      id: xdepTplId,
      companyId: null,
      name: '크로스보딩 출발 체크리스트',
      description: '법인 간 이동 시 출발 법인 처리 절차',
      targetType: 'NEW_HIRE',
      planType: 'CROSSBOARDING_DEPARTURE',
      isActive: true,
    },
  })
  const xdepTasks = [
    { title: '크로스보딩 발령 통보 수령', description: '이동 법인, 포지션, 발령일 공식 확인', assigneeType: 'HR' as const, dueDaysAfter: 0, sortOrder: 1, category: 'DOCUMENT' as const },
    { title: '현 법인 급여/복리후생 정산', description: '급여 정산일 확인, 퇴직금 처리 (해당 시), 복리후생 종료', assigneeType: 'HR' as const, dueDaysAfter: -5, sortOrder: 2, category: 'OTHER' as const },
    { title: 'IT 시스템 권한 이관 준비', description: '현 법인 시스템 접근 권한 목록 작성, IT 이관 요청', assigneeType: 'HR' as const, dueDaysAfter: -3, sortOrder: 3, category: 'SETUP' as const },
    { title: '업무 인수인계 완료', description: '진행 업무, 주요 연락처, 미결 사항 문서화 및 후임자 인수인계', assigneeType: 'MANAGER' as const, dueDaysAfter: -1, sortOrder: 4, category: 'OTHER' as const },
    { title: '출발 법인 물품 반납', description: '사원증, 장비, 사무용품 등 법인 자산 반납', assigneeType: 'MANAGER' as const, dueDaysAfter: 0, sortOrder: 5, category: 'OTHER' as const },
    { title: '출발 법인 시스템 계정 비활성화', description: 'HR/IT 협력하여 현 법인 계정 전환 처리', assigneeType: 'HR' as const, dueDaysAfter: 0, sortOrder: 6, category: 'SETUP' as const },
  ]
  for (const t of xdepTasks) {
    const tid = deterministicUUID('onbtask', `GLOBAL:XDEP:${t.title}`)
    await prisma.onboardingTask.upsert({
      where: { id: tid },
      update: { title: t.title, description: t.description, assigneeType: t.assigneeType as any, dueDaysAfter: t.dueDaysAfter, sortOrder: t.sortOrder, category: t.category as any },
      create: { id: tid, templateId: xdepTplId, title: t.title, description: t.description, assigneeType: t.assigneeType as any, dueDaysAfter: t.dueDaysAfter, sortOrder: t.sortOrder, isRequired: true, category: t.category as any },
    })
  }
  console.log(`  ✅ 크로스보딩 출발 템플릿 + ${xdepTasks.length} tasks`)

  // ----------------------------------------------------------
  // B5: Cross-boarding 도착 템플릿 (글로벌)
  // ----------------------------------------------------------
  const xarrTplId = deterministicUUID('onbtpl', 'GLOBAL:CROSSBOARDING_ARRIVAL')
  await prisma.onboardingTemplate.upsert({
    where: { id: xarrTplId },
    update: { name: '크로스보딩 도착 온보딩', isActive: true },
    create: {
      id: xarrTplId,
      companyId: null,
      name: '크로스보딩 도착 온보딩',
      description: '법인 간 이동 시 도착 법인 적응 지원 절차',
      targetType: 'NEW_HIRE',
      planType: 'CROSSBOARDING_ARRIVAL',
      isActive: true,
    },
  })
  const xarrTasks = [
    { title: '도착 법인 발령 수령 및 환영', description: '공식 발령장 수령, HR 담당자 및 팀 소개', assigneeType: 'HR' as const, dueDaysAfter: 0, sortOrder: 1, category: 'INTRODUCTION' as const },
    { title: '도착 법인 IT 계정 및 장비 발급', description: '이메일, 사내 시스템, 노트북, 사원증 발급', assigneeType: 'HR' as const, dueDaysAfter: 0, sortOrder: 2, category: 'SETUP' as const },
    { title: '급여/복리후생 신규 등록', description: '도착 법인 급여 체계, 복리후생 등록 및 안내', assigneeType: 'HR' as const, dueDaysAfter: 1, sortOrder: 3, category: 'OTHER' as const },
    { title: '법인 특화 규정 및 컴플라이언스 교육', description: '현지 노동법, 취업규칙, 보안 정책 이수', assigneeType: 'HR' as const, dueDaysAfter: 3, sortOrder: 4, category: 'OTHER' as const },
    { title: '버디 배정 및 첫 미팅', description: '도착 법인 적응 지원 버디 배정 및 초기 미팅', assigneeType: 'MANAGER' as const, dueDaysAfter: 1, sortOrder: 5, category: 'INTRODUCTION' as const },
    { title: '30일 적응 체크인', description: '도착 법인 적응 현황 및 지원 필요 사항 점검', assigneeType: 'HR' as const, dueDaysAfter: 30, sortOrder: 6, category: 'OTHER' as const },
    { title: '90일 크로스보딩 완료 평가', description: '새로운 법인 내 역할 안착 여부 최종 평가', assigneeType: 'MANAGER' as const, dueDaysAfter: 90, sortOrder: 7, category: 'OTHER' as const },
  ]
  for (const t of xarrTasks) {
    const tid = deterministicUUID('onbtask', `GLOBAL:XARR:${t.title}`)
    await prisma.onboardingTask.upsert({
      where: { id: tid },
      update: { title: t.title, description: t.description, assigneeType: t.assigneeType as any, dueDaysAfter: t.dueDaysAfter, sortOrder: t.sortOrder, category: t.category as any },
      create: { id: tid, templateId: xarrTplId, title: t.title, description: t.description, assigneeType: t.assigneeType as any, dueDaysAfter: t.dueDaysAfter, sortOrder: t.sortOrder, isRequired: true, category: t.category as any },
    })
  }
  console.log(`  ✅ 크로스보딩 도착 온보딩 + ${xarrTasks.length} tasks`)

  // ----------------------------------------------------------
  // STEP 11: Seed Offboarding Checklist + Tasks (CTR-KR)
  // ----------------------------------------------------------
  console.log('📌 Seeding offboarding checklist...')
  const offChkId = deterministicUUID('offchk', 'CTR-KR:VOLUNTARY')
  await prisma.offboardingChecklist.upsert({
    where: { id: offChkId },
    update: { name: '자발적 퇴직 체크리스트', isActive: true },
    create: {
      id: offChkId,
      companyId: ctrKrId,
      name: '자발적 퇴직 체크리스트',
      targetType: 'VOLUNTARY',
      isActive: true,
    },
  })

  for (const t of offboardingTasks) {
    const tid = deterministicUUID('offtask', `CTR-KR:${t.title}`)
    await prisma.offboardingTask.upsert({
      where: { id: tid },
      update: { title: t.title, description: t.description, assigneeType: t.assigneeType, dueDaysBefore: t.dueDaysBefore, sortOrder: t.sortOrder },
      create: { id: tid, checklistId: offChkId, title: t.title, description: t.description, assigneeType: t.assigneeType, dueDaysBefore: t.dueDaysBefore, sortOrder: t.sortOrder, isRequired: true },
    })
  }
  console.log(`  ✅ 1 offboarding checklist + ${offboardingTasks.length} tasks`)

  // ----------------------------------------------------------
  // STEP 12: Seed Salary Bands (CTR-KR, 6 grades, OFFICE)
  // ----------------------------------------------------------
  console.log('📌 Seeding salary bands...')
  const officeCatId = jobCatMap['CTR-KR:OFFICE']

  for (const sb of salaryBandData) {
    const gId = gradeMap[`CTR-KR:${sb.gradeCode}`]
    const id = deterministicUUID('salband', `CTR-KR:${sb.gradeCode}:OFFICE`)
    await prisma.salaryBand.upsert({
      where: { id },
      update: { minSalary: sb.min, midSalary: sb.mid, maxSalary: sb.max },
      create: {
        id,
        companyId: ctrKrId,
        jobGradeId: gId,
        jobCategoryId: officeCatId,
        currency: 'KRW',
        minSalary: sb.min,
        midSalary: sb.mid,
        maxSalary: sb.max,
        effectiveFrom: new Date('2025-01-01'),
      },
    })
  }
  console.log(`  ✅ ${salaryBandData.length} salary bands`)

  // ----------------------------------------------------------
  // STEP 13: Seed Benefit Policies (CTR-KR, 3)
  // ----------------------------------------------------------
  console.log('📌 Seeding benefit policies...')

  for (const bp of benefitPolicyData) {
    const id = deterministicUUID('benefit', `CTR-KR:${bp.name}`)
    await prisma.benefitPolicy.upsert({
      where: { id },
      update: { amount: bp.amount, frequency: bp.frequency, isTaxable: bp.isTaxable, isActive: true },
      create: {
        id,
        companyId: ctrKrId,
        name: bp.name,
        category: bp.category,
        amount: bp.amount,
        frequency: bp.frequency,
        currency: 'KRW',
        isTaxable: bp.isTaxable,
        effectiveFrom: new Date('2025-01-01'),
        isActive: true,
      },
    })
  }
  console.log(`  ✅ ${benefitPolicyData.length} benefit policies`)

  // ----------------------------------------------------------
  // STEP 14: Seed Notification Triggers
  // ----------------------------------------------------------
  console.log('📌 Seeding notification triggers...')

  for (const nt of notificationTriggerData) {
    const id = deterministicUUID('nftrig', nt.eventType)
    await prisma.notificationTrigger.upsert({
      where: { eventType: nt.eventType },
      update: { template: nt.template, channels: nt.channels, isActive: true },
      create: { id, eventType: nt.eventType, template: nt.template, channels: nt.channels, isActive: true },
    })
  }
  console.log(`  ✅ ${notificationTriggerData.length} notification triggers`)

  // ----------------------------------------------------------
  // STEP 15: Seed Holidays (CTR-KR, 2025-2026)
  // ----------------------------------------------------------
  console.log('📌 Seeding holidays...')
  // Deduplicate by date (some dates overlap, e.g. 2025-10-03)
  const seenDates = new Set<string>()
  let holidayCount = 0

  for (const h of koreanHolidays) {
    const dateKey = h.date
    if (seenDates.has(dateKey)) continue
    seenDates.add(dateKey)

    const dt = new Date(h.date + 'T00:00:00+09:00')
    const id = deterministicUUID('holiday', `CTR-KR:${h.date}`)
    await prisma.holiday.upsert({
      where: { companyId_date: { companyId: ctrKrId, date: dt } },
      update: { name: h.name, year: h.year, isSubstitute: !!h.isSub },
      create: { id, companyId: ctrKrId, name: h.name, date: dt, year: h.year, isSubstitute: !!h.isSub },
    })
    holidayCount++
  }
  console.log(`  ✅ ${holidayCount} holidays`)

  // ----------------------------------------------------------
  // STEP 16: Seed Tenant Settings (13 companies)
  // ----------------------------------------------------------
  console.log('📌 Seeding tenant settings...')

  for (const c of companyData) {
    const compId = companyMap[c.code]
    const ts = getTenantSettings(c.code, c.locale, c.timezone)
    const id = deterministicUUID('tenant', c.code)
    await prisma.tenantSetting.upsert({
      where: { companyId: compId },
      update: {
        primaryColor: ts.primaryColor,
        secondaryColor: ts.secondaryColor,
        accentColor: ts.accentColor,
        coreValues: ts.coreValues,
        enabledModules: ts.enabledModules,
        defaultLocale: ts.defaultLocale,
        timezone: ts.timezone,
        maxOvertimeWeeklyHours: ts.maxOvertimeWeeklyHours,
        ratingScaleMin: 1,
        ratingScaleMax: 5,
        gradeLabels: { S: '최우수', A: '우수', B: '보통', C: '미흡', D: '부진' },
        ratingLabels: ['매우 부족', '부족', '보통', '우수', '탁월'],
        fiscalYearStartMonth: 1,
        probationMonths: 3,
      },
      create: {
        id,
        companyId: compId,
        primaryColor: ts.primaryColor,
        secondaryColor: ts.secondaryColor,
        accentColor: ts.accentColor,
        coreValues: ts.coreValues,
        enabledModules: ts.enabledModules,
        defaultLocale: ts.defaultLocale,
        timezone: ts.timezone,
        maxOvertimeWeeklyHours: ts.maxOvertimeWeeklyHours,
        ratingScaleMin: 1,
        ratingScaleMax: 5,
        gradeLabels: { S: '최우수', A: '우수', B: '보통', C: '미흡', D: '부진' },
        ratingLabels: ['매우 부족', '부족', '보통', '우수', '탁월'],
        fiscalYearStartMonth: 1,
        probationMonths: 3,
      },
    })
  }
  console.log(`  ✅ ${companyData.length} tenant settings`)

  // ----------------------------------------------------------
  // STEP 17: Seed Term Overrides (14 keys × 13 companies)
  // ----------------------------------------------------------
  console.log('📌 Seeding term overrides...')
  let termCount = 0

  for (const c of companyData) {
    const compId = companyMap[c.code]
    for (const tk of termKeys) {
      const id = deterministicUUID('term', `${c.code}:${tk.key}`)
      await prisma.termOverride.upsert({
        where: { companyId_termKey: { companyId: compId, termKey: tk.key } },
        update: { labelKo: tk.labelKo, labelEn: tk.labelEn },
        create: { id, companyId: compId, termKey: tk.key, labelKo: tk.labelKo, labelEn: tk.labelEn },
      })
      termCount++
    }
  }
  console.log(`  ✅ ${termCount} term overrides`)

  // ----------------------------------------------------------
  // STEP 18: Seed Tenant Enum Options (8 groups, ~60 options per company)
  // ----------------------------------------------------------
  console.log('📌 Seeding tenant enum options...')
  let enumCount = 0

  for (const c of companyData) {
    const compId = companyMap[c.code]
    for (const eo of enumOptionData) {
      const id = deterministicUUID('enumopt', `${c.code}:${eo.group}:${eo.key}`)
      await prisma.tenantEnumOption.upsert({
        where: { companyId_enumGroup_optionKey: { companyId: compId, enumGroup: eo.group, optionKey: eo.key } },
        update: { label: eo.label, sortOrder: eo.sortOrder, isSystem: true, isActive: true },
        create: { id, companyId: compId, enumGroup: eo.group, optionKey: eo.key, label: eo.label, sortOrder: eo.sortOrder, isSystem: true, isActive: true },
      })
      enumCount++
    }
  }
  console.log(`  ✅ ${enumCount} tenant enum options`)

  // ----------------------------------------------------------
  // STEP 19: Seed Workflow Rules + Steps (CTR-KR, 4 rules)
  // ----------------------------------------------------------
  console.log('📌 Seeding workflow rules...')

  for (const wf of workflowData) {
    const ruleId = deterministicUUID('workflow', `CTR-KR:${wf.workflowType}`)
    await prisma.workflowRule.upsert({
      where: { companyId_workflowType_name: { companyId: ctrKrId, workflowType: wf.workflowType, name: wf.name } },
      update: { totalSteps: wf.totalSteps, isActive: true },
      create: { id: ruleId, companyId: ctrKrId, workflowType: wf.workflowType, name: wf.name, totalSteps: wf.totalSteps, isActive: true },
    })

    for (const s of wf.steps) {
      const stepId = deterministicUUID('wfstep', `CTR-KR:${wf.workflowType}:${s.stepOrder}`)
      const approverRoleId = s.approverRoleCode ? roleMap[s.approverRoleCode] : null
      await prisma.workflowStep.upsert({
        where: { ruleId_stepOrder: { ruleId, stepOrder: s.stepOrder } },
        update: { approverType: s.approverType, approverRoleId },
        create: { id: stepId, ruleId, stepOrder: s.stepOrder, approverType: s.approverType, approverRoleId },
      })
    }
  }
  console.log(`  ✅ ${workflowData.length} workflow rules + ${workflowData.reduce((a, w) => a + w.steps.length, 0)} steps`)

  // ----------------------------------------------------------
  // STEP 20: Seed Email Templates (CTR-KR, ~15)
  // ----------------------------------------------------------
  console.log('📌 Seeding email templates...')

  for (const et of emailTemplateData) {
    const id = deterministicUUID('emailtpl', `CTR-KR:${et.eventType}:${et.channel}`)
    await prisma.emailTemplate.upsert({
      where: { companyId_eventType_channel_locale: { companyId: ctrKrId, eventType: et.eventType, channel: et.channel, locale: 'ko' } },
      update: { subject: et.subject, body: et.body, variables: et.variables, isActive: true, isSystem: true },
      create: { id, companyId: ctrKrId, eventType: et.eventType, channel: et.channel, locale: 'ko', subject: et.subject, body: et.body, variables: et.variables, isActive: true, isSystem: true },
    })
  }
  console.log(`  ✅ ${emailTemplateData.length} email templates`)

  // ----------------------------------------------------------
  // STEP 21: Seed Export Templates (CTR-KR, 3)
  // ----------------------------------------------------------
  console.log('📌 Seeding export templates...')

  for (const ex of exportTemplateData) {
    const id = deterministicUUID('exptpl', `CTR-KR:${ex.entityType}`)
    await prisma.exportTemplate.upsert({
      where: { companyId_entityType_name: { companyId: ctrKrId, entityType: ex.entityType, name: ex.name } },
      update: { columns: ex.columns, fileFormat: ex.fileFormat, isDefault: ex.isDefault },
      create: { id, companyId: ctrKrId, entityType: ex.entityType, name: ex.name, columns: ex.columns, fileFormat: ex.fileFormat, isDefault: ex.isDefault },
    })
  }
  console.log(`  ✅ ${exportTemplateData.length} export templates`)

  // ----------------------------------------------------------
  // STEP 22: New CTR-KR Departments (5 more) + Other Company Departments
  // ----------------------------------------------------------
  console.log('📌 Seeding new departments...')
  let newDeptCount = 0

  // 5 new CTR-KR departments
  const newKrDepts = [
    { code: 'MFG', name: '생산/제조팀', nameEn: 'Manufacturing Team', level: 1, sortOrder: 5 },
    { code: 'QA', name: '품질관리팀', nameEn: 'Quality Control Team', level: 1, sortOrder: 6 },
    { code: 'FIN', name: '재무/회계팀', nameEn: 'Finance & Accounting', level: 1, sortOrder: 7 },
    { code: 'PUR', name: '구매/조달팀', nameEn: 'Procurement Team', level: 1, sortOrder: 8 },
    { code: 'RANDD', name: '연구개발팀', nameEn: 'R&D Team', level: 1, sortOrder: 9 },
  ]

  for (const d of newKrDepts) {
    const id = deterministicUUID('dept', `CTR-KR:${d.code}`)
    await prisma.department.upsert({
      where: { companyId_code: { companyId: ctrKrId, code: d.code } },
      update: { name: d.name, nameEn: d.nameEn },
      create: { id, companyId: ctrKrId, code: d.code, name: d.name, nameEn: d.nameEn, level: d.level, sortOrder: d.sortOrder },
    })
    deptMap[`CTR-KR:${d.code}`] = id
    newDeptCount++
  }

  // Also normalize existing deptMap to use company-prefixed keys
  // (existing deptMap uses code only: 'MGMT', 'HR', etc.)
  deptMap['CTR-KR:MGMT'] = deterministicUUID('dept', 'CTR-KR:MGMT')
  deptMap['CTR-KR:HR'] = deterministicUUID('dept', 'CTR-KR:HR')
  deptMap['CTR-KR:DEV'] = deterministicUUID('dept', 'CTR-KR:DEV')
  deptMap['CTR-KR:SALES'] = deterministicUUID('dept', 'CTR-KR:SALES')

  // Other company departments (1-2 each)
  const otherDepts = [
    { companyCode: 'CTR-HQ', code: 'STRAT', name: 'Strategy & Planning', nameEn: 'Strategy & Planning', level: 1, sortOrder: 2 },
    { companyCode: 'CTR-MOB', code: 'ENG', name: 'Engineering', nameEn: 'Engineering', level: 1, sortOrder: 1 },
    { companyCode: 'CTR-MOB', code: 'MFG', name: 'Production', nameEn: 'Production', level: 1, sortOrder: 2 },
    { companyCode: 'CTR-ECO', code: 'ENG', name: 'Engineering', nameEn: 'Engineering', level: 1, sortOrder: 1 },
    { companyCode: 'CTR-ECO', code: 'OPS', name: 'Operations', nameEn: 'Operations', level: 1, sortOrder: 2 },
    { companyCode: 'CTR-ROB', code: 'ENG', name: 'Robotics Engineering', nameEn: 'Robotics Engineering', level: 1, sortOrder: 1 },
    { companyCode: 'CTR-ROB', code: 'MFG', name: 'Manufacturing', nameEn: 'Manufacturing', level: 1, sortOrder: 2 },
    { companyCode: 'CTR-ENG', code: 'ENG', name: 'Engineering', nameEn: 'Engineering', level: 1, sortOrder: 1 },
    { companyCode: 'CTR-ENG', code: 'RD', name: 'R&D', nameEn: 'R&D', level: 1, sortOrder: 2 },
    { companyCode: 'FML', code: 'OPS', name: 'Operations', nameEn: 'Operations', level: 1, sortOrder: 1 },
    { companyCode: 'FML', code: 'FIN', name: 'Finance', nameEn: 'Finance', level: 1, sortOrder: 2 },
    { companyCode: 'CTR-US', code: 'OPS', name: 'Operations', nameEn: 'Operations', level: 1, sortOrder: 1 },
    { companyCode: 'CTR-US', code: 'SALES', name: 'Sales', nameEn: 'Sales', level: 1, sortOrder: 2 },
    { companyCode: 'CTR-CN', code: 'MFG', name: '生产部', nameEn: 'Manufacturing', level: 1, sortOrder: 1 },
    { companyCode: 'CTR-CN', code: 'QA', name: '质量部', nameEn: 'Quality Assurance', level: 1, sortOrder: 2 },
    { companyCode: 'CTR-RU', code: 'MFG', name: 'Производство', nameEn: 'Manufacturing', level: 1, sortOrder: 1 },
    { companyCode: 'CTR-RU', code: 'ENG', name: 'Инженерия', nameEn: 'Engineering', level: 1, sortOrder: 2 },
    { companyCode: 'CTR-VN', code: 'MFG', name: 'Sản xuất', nameEn: 'Manufacturing', level: 1, sortOrder: 1 },
    { companyCode: 'CTR-VN', code: 'ASM', name: 'Lắp ráp', nameEn: 'Assembly', level: 1, sortOrder: 2 },
    { companyCode: 'CTR-EU', code: 'ENG', name: 'Engineering', nameEn: 'Engineering', level: 1, sortOrder: 1 },
    { companyCode: 'CTR-EU', code: 'SALES', name: 'Sales', nameEn: 'Sales', level: 1, sortOrder: 2 },
    { companyCode: 'CTR-MX', code: 'MFG', name: 'Manufactura', nameEn: 'Manufacturing', level: 1, sortOrder: 1 },
    { companyCode: 'CTR-MX', code: 'ASM', name: 'Ensamble', nameEn: 'Assembly', level: 1, sortOrder: 2 },
  ]

  for (const d of otherDepts) {
    const compId = companyMap[d.companyCode]
    const id = deterministicUUID('dept', `${d.companyCode}:${d.code}`)
    await prisma.department.upsert({
      where: { companyId_code: { companyId: compId, code: d.code } },
      update: { name: d.name, nameEn: d.nameEn },
      create: { id, companyId: compId, code: d.code, name: d.name, nameEn: d.nameEn, level: d.level, sortOrder: d.sortOrder },
    })
    deptMap[`${d.companyCode}:${d.code}`] = id
    newDeptCount++
  }
  console.log(`  ✅ ${newDeptCount} new departments`)

  // ----------------------------------------------------------
  // STEP 23: Global Jobs (15, companyId: null)
  // ----------------------------------------------------------
  console.log('📌 Seeding global jobs...')
  const jobMap: Record<string, string> = {} // code -> id

  const globalJobs = [
    { id: deterministicUUID('job', 'SW_ENG'), code: 'SW_ENG', titleKo: '소프트웨어 엔지니어', titleEn: 'Software Engineer' },
    { id: deterministicUUID('job', 'HR_MGR'), code: 'HR_MGR', titleKo: 'HR 매니저', titleEn: 'HR Manager' },
    { id: deterministicUUID('job', 'HR_SPEC'), code: 'HR_SPEC', titleKo: 'HR 담당', titleEn: 'HR Specialist' },
    { id: deterministicUUID('job', 'MFG_OPS'), code: 'MFG_OPS', titleKo: '생산직', titleEn: 'Manufacturing Operator' },
    { id: deterministicUUID('job', 'MFG_SUP'), code: 'MFG_SUP', titleKo: '생산감독', titleEn: 'Manufacturing Supervisor' },
    { id: deterministicUUID('job', 'QA_ENG'), code: 'QA_ENG', titleKo: '품질 엔지니어', titleEn: 'Quality Engineer' },
    { id: deterministicUUID('job', 'FIN_MGR'), code: 'FIN_MGR', titleKo: '재무 매니저', titleEn: 'Finance Manager' },
    { id: deterministicUUID('job', 'SALES_MGR'), code: 'SALES_MGR', titleKo: '영업 매니저', titleEn: 'Sales Manager' },
    { id: deterministicUUID('job', 'RND_ENG'), code: 'RND_ENG', titleKo: '연구개발 엔지니어', titleEn: 'R&D Engineer' },
    { id: deterministicUUID('job', 'PUR_SPEC'), code: 'PUR_SPEC', titleKo: '구매 전문가', titleEn: 'Procurement Specialist' },
    { id: deterministicUUID('job', 'PLANT_MGR'), code: 'PLANT_MGR', titleKo: '공장장', titleEn: 'Plant Manager' },
    { id: deterministicUUID('job', 'OPS_MGR'), code: 'OPS_MGR', titleKo: '운영 매니저', titleEn: 'Operations Manager' },
    { id: deterministicUUID('job', 'IT_ENG'), code: 'IT_ENG', titleKo: 'IT 엔지니어', titleEn: 'IT Engineer' },
    { id: deterministicUUID('job', 'EXEC_ASST'), code: 'EXEC_ASST', titleKo: '임원 보좌', titleEn: 'Executive Assistant' },
    { id: deterministicUUID('job', 'ADMIN_MGR'), code: 'ADMIN_MGR', titleKo: '총무 매니저', titleEn: 'Administrative Manager' },
  ]

  for (const j of globalJobs) {
    await prisma.job.upsert({
      where: { id: j.id },
      update: { titleKo: j.titleKo, titleEn: j.titleEn },
      create: { id: j.id, code: j.code, titleKo: j.titleKo, titleEn: j.titleEn, companyId: null },
    })
    jobMap[j.code] = j.id
  }
  console.log(`  ✅ ${globalJobs.length} global jobs`)

  // ----------------------------------------------------------
  // STEP 24: CTR-KR Positions (~55 across 9 departments)
  // ----------------------------------------------------------
  console.log('📌 Seeding CTR-KR positions...')
  const posMap: Record<string, string> = {} // posCode -> id

  // Helper to get grade id
  const krGrade = (code: string) => gradeMap[`CTR-KR:${code}`]

  // Get dept IDs (using normalized deptMap keys)
  const d = {
    MGMT: deptMap['CTR-KR:MGMT'],
    HR: deptMap['CTR-KR:HR'],
    DEV: deptMap['CTR-KR:DEV'],
    SALES: deptMap['CTR-KR:SALES'],
    MFG: deterministicUUID('dept', 'CTR-KR:MFG'),
    QA: deterministicUUID('dept', 'CTR-KR:QA'),
    FIN: deterministicUUID('dept', 'CTR-KR:FIN'),
    PUR: deterministicUUID('dept', 'CTR-KR:PUR'),
    RANDD: deterministicUUID('dept', 'CTR-KR:RANDD'),
  }

  const krPositions = [
    // ── MGMT (6) ─────────────────────────────────────────────
    { code: 'CTR-KR-MGMT-001', titleKo: '대표이사', titleEn: 'CEO', deptId: d.MGMT, jobCode: 'ADMIN_MGR', gradeCode: 'G1' },
    { code: 'CTR-KR-MGMT-002', titleKo: '경영지원본부장', titleEn: 'Head of Management', deptId: d.MGMT, jobCode: 'ADMIN_MGR', gradeCode: 'G2' },
    { code: 'CTR-KR-MGMT-003', titleKo: '경영지원팀장', titleEn: 'Management Team Lead', deptId: d.MGMT, jobCode: 'ADMIN_MGR', gradeCode: 'G3' },
    { code: 'CTR-KR-MGMT-004', titleKo: '경영지원선임', titleEn: 'Senior Admin Specialist', deptId: d.MGMT, jobCode: 'ADMIN_MGR', gradeCode: 'G4' },
    { code: 'CTR-KR-MGMT-005', titleKo: '경영지원담당', titleEn: 'Admin Specialist', deptId: d.MGMT, jobCode: 'EXEC_ASST', gradeCode: 'G5' },
    { code: 'CTR-KR-MGMT-006', titleKo: '총무사원', titleEn: 'Admin Staff', deptId: d.MGMT, jobCode: 'EXEC_ASST', gradeCode: 'G6' },
    // ── HR (4) ───────────────────────────────────────────────
    { code: 'CTR-KR-HR-001', titleKo: '인사팀장', titleEn: 'HR Team Lead', deptId: d.HR, jobCode: 'HR_MGR', gradeCode: 'G3' },
    { code: 'CTR-KR-HR-002', titleKo: '인사담당선임', titleEn: 'Senior HR Specialist', deptId: d.HR, jobCode: 'HR_SPEC', gradeCode: 'G4' },
    { code: 'CTR-KR-HR-003', titleKo: '인사담당', titleEn: 'HR Specialist', deptId: d.HR, jobCode: 'HR_SPEC', gradeCode: 'G5' },
    { code: 'CTR-KR-HR-004', titleKo: '인사사원', titleEn: 'HR Staff', deptId: d.HR, jobCode: 'HR_SPEC', gradeCode: 'G6' },
    // ── DEV (7) ──────────────────────────────────────────────
    { code: 'CTR-KR-DEV-001', titleKo: '개발팀장', titleEn: 'Dev Team Lead', deptId: d.DEV, jobCode: 'SW_ENG', gradeCode: 'G3' },
    { code: 'CTR-KR-DEV-002', titleKo: '수석개발자A', titleEn: 'Senior Developer A', deptId: d.DEV, jobCode: 'SW_ENG', gradeCode: 'G4' },
    { code: 'CTR-KR-DEV-003', titleKo: '수석개발자B', titleEn: 'Senior Developer B', deptId: d.DEV, jobCode: 'SW_ENG', gradeCode: 'G4' },
    { code: 'CTR-KR-DEV-004', titleKo: '개발자A', titleEn: 'Developer A', deptId: d.DEV, jobCode: 'SW_ENG', gradeCode: 'G5' },
    { code: 'CTR-KR-DEV-005', titleKo: '개발자B', titleEn: 'Developer B', deptId: d.DEV, jobCode: 'SW_ENG', gradeCode: 'G5' },
    { code: 'CTR-KR-DEV-006', titleKo: '개발사원A', titleEn: 'Dev Staff A', deptId: d.DEV, jobCode: 'SW_ENG', gradeCode: 'G6' },
    { code: 'CTR-KR-DEV-007', titleKo: '개발사원B', titleEn: 'Dev Staff B', deptId: d.DEV, jobCode: 'SW_ENG', gradeCode: 'G6' },
    // ── SALES (7) ────────────────────────────────────────────
    { code: 'CTR-KR-SALES-001', titleKo: '영업팀장', titleEn: 'Sales Team Lead', deptId: d.SALES, jobCode: 'SALES_MGR', gradeCode: 'G3' },
    { code: 'CTR-KR-SALES-002', titleKo: '영업선임A', titleEn: 'Senior Sales A', deptId: d.SALES, jobCode: 'SALES_MGR', gradeCode: 'G4' },
    { code: 'CTR-KR-SALES-003', titleKo: '영업선임B', titleEn: 'Senior Sales B', deptId: d.SALES, jobCode: 'SALES_MGR', gradeCode: 'G4' },
    { code: 'CTR-KR-SALES-004', titleKo: '영업담당A', titleEn: 'Sales Specialist A', deptId: d.SALES, jobCode: 'SALES_MGR', gradeCode: 'G5' },
    { code: 'CTR-KR-SALES-005', titleKo: '영업담당B', titleEn: 'Sales Specialist B', deptId: d.SALES, jobCode: 'SALES_MGR', gradeCode: 'G5' },
    { code: 'CTR-KR-SALES-006', titleKo: '영업사원A', titleEn: 'Sales Staff A', deptId: d.SALES, jobCode: 'SALES_MGR', gradeCode: 'G6' },
    { code: 'CTR-KR-SALES-007', titleKo: '영업사원B', titleEn: 'Sales Staff B', deptId: d.SALES, jobCode: 'SALES_MGR', gradeCode: 'G6' },
    // ── MFG (10) ─────────────────────────────────────────────
    { code: 'CTR-KR-MFG-001', titleKo: '생산팀장', titleEn: 'Manufacturing Team Lead', deptId: d.MFG, jobCode: 'PLANT_MGR', gradeCode: 'G3' },
    { code: 'CTR-KR-MFG-002', titleKo: '생산감독A', titleEn: 'Production Supervisor A', deptId: d.MFG, jobCode: 'MFG_SUP', gradeCode: 'G4' },
    { code: 'CTR-KR-MFG-003', titleKo: '생산감독B', titleEn: 'Production Supervisor B', deptId: d.MFG, jobCode: 'MFG_SUP', gradeCode: 'G4' },
    { code: 'CTR-KR-MFG-004', titleKo: '생산반장A', titleEn: 'Line Leader A', deptId: d.MFG, jobCode: 'MFG_SUP', gradeCode: 'G5' },
    { code: 'CTR-KR-MFG-005', titleKo: '생산반장B', titleEn: 'Line Leader B', deptId: d.MFG, jobCode: 'MFG_SUP', gradeCode: 'G5' },
    { code: 'CTR-KR-MFG-006', titleKo: '생산반장C', titleEn: 'Line Leader C', deptId: d.MFG, jobCode: 'MFG_SUP', gradeCode: 'G5' },
    { code: 'CTR-KR-MFG-007', titleKo: '생산사원A', titleEn: 'Operator A', deptId: d.MFG, jobCode: 'MFG_OPS', gradeCode: 'G6' },
    { code: 'CTR-KR-MFG-008', titleKo: '생산사원B', titleEn: 'Operator B', deptId: d.MFG, jobCode: 'MFG_OPS', gradeCode: 'G6' },
    { code: 'CTR-KR-MFG-009', titleKo: '생산사원C', titleEn: 'Operator C', deptId: d.MFG, jobCode: 'MFG_OPS', gradeCode: 'G6' },
    { code: 'CTR-KR-MFG-010', titleKo: '생산사원D', titleEn: 'Operator D', deptId: d.MFG, jobCode: 'MFG_OPS', gradeCode: 'G6' },
    // ── QA (7) ───────────────────────────────────────────────
    { code: 'CTR-KR-QA-001', titleKo: '품질팀장', titleEn: 'QA Team Lead', deptId: d.QA, jobCode: 'QA_ENG', gradeCode: 'G3' },
    { code: 'CTR-KR-QA-002', titleKo: '품질감독A', titleEn: 'QA Supervisor A', deptId: d.QA, jobCode: 'QA_ENG', gradeCode: 'G4' },
    { code: 'CTR-KR-QA-003', titleKo: '품질감독B', titleEn: 'QA Supervisor B', deptId: d.QA, jobCode: 'QA_ENG', gradeCode: 'G4' },
    { code: 'CTR-KR-QA-004', titleKo: '품질담당A', titleEn: 'QA Specialist A', deptId: d.QA, jobCode: 'QA_ENG', gradeCode: 'G5' },
    { code: 'CTR-KR-QA-005', titleKo: '품질담당B', titleEn: 'QA Specialist B', deptId: d.QA, jobCode: 'QA_ENG', gradeCode: 'G5' },
    { code: 'CTR-KR-QA-006', titleKo: '품질사원A', titleEn: 'QA Staff A', deptId: d.QA, jobCode: 'QA_ENG', gradeCode: 'G6' },
    { code: 'CTR-KR-QA-007', titleKo: '품질사원B', titleEn: 'QA Staff B', deptId: d.QA, jobCode: 'QA_ENG', gradeCode: 'G6' },
    // ── FIN (5) ──────────────────────────────────────────────
    { code: 'CTR-KR-FIN-001', titleKo: '재무팀장', titleEn: 'Finance Team Lead', deptId: d.FIN, jobCode: 'FIN_MGR', gradeCode: 'G3' },
    { code: 'CTR-KR-FIN-002', titleKo: '재무선임', titleEn: 'Senior Finance Specialist', deptId: d.FIN, jobCode: 'FIN_MGR', gradeCode: 'G4' },
    { code: 'CTR-KR-FIN-003', titleKo: '재무담당A', titleEn: 'Finance Specialist A', deptId: d.FIN, jobCode: 'FIN_MGR', gradeCode: 'G5' },
    { code: 'CTR-KR-FIN-004', titleKo: '재무담당B', titleEn: 'Finance Specialist B', deptId: d.FIN, jobCode: 'FIN_MGR', gradeCode: 'G5' },
    { code: 'CTR-KR-FIN-005', titleKo: '재무사원', titleEn: 'Finance Staff', deptId: d.FIN, jobCode: 'FIN_MGR', gradeCode: 'G6' },
    // ── PUR (5) ──────────────────────────────────────────────
    { code: 'CTR-KR-PUR-001', titleKo: '구매팀장', titleEn: 'Procurement Team Lead', deptId: d.PUR, jobCode: 'PUR_SPEC', gradeCode: 'G3' },
    { code: 'CTR-KR-PUR-002', titleKo: '구매선임', titleEn: 'Senior Procurement Spec', deptId: d.PUR, jobCode: 'PUR_SPEC', gradeCode: 'G4' },
    { code: 'CTR-KR-PUR-003', titleKo: '구매담당A', titleEn: 'Procurement Specialist A', deptId: d.PUR, jobCode: 'PUR_SPEC', gradeCode: 'G5' },
    { code: 'CTR-KR-PUR-004', titleKo: '구매담당B', titleEn: 'Procurement Specialist B', deptId: d.PUR, jobCode: 'PUR_SPEC', gradeCode: 'G5' },
    { code: 'CTR-KR-PUR-005', titleKo: '구매사원', titleEn: 'Procurement Staff', deptId: d.PUR, jobCode: 'PUR_SPEC', gradeCode: 'G6' },
    // ── RANDD (8) ────────────────────────────────────────────
    { code: 'CTR-KR-RANDD-001', titleKo: '연구소장', titleEn: 'R&D Director', deptId: d.RANDD, jobCode: 'RND_ENG', gradeCode: 'G2' },
    { code: 'CTR-KR-RANDD-002', titleKo: '연구팀장', titleEn: 'R&D Team Lead', deptId: d.RANDD, jobCode: 'RND_ENG', gradeCode: 'G3' },
    { code: 'CTR-KR-RANDD-003', titleKo: '선임연구원A', titleEn: 'Senior Researcher A', deptId: d.RANDD, jobCode: 'RND_ENG', gradeCode: 'G4' },
    { code: 'CTR-KR-RANDD-004', titleKo: '선임연구원B', titleEn: 'Senior Researcher B', deptId: d.RANDD, jobCode: 'RND_ENG', gradeCode: 'G4' },
    { code: 'CTR-KR-RANDD-005', titleKo: '연구원A', titleEn: 'Researcher A', deptId: d.RANDD, jobCode: 'RND_ENG', gradeCode: 'G5' },
    { code: 'CTR-KR-RANDD-006', titleKo: '연구원B', titleEn: 'Researcher B', deptId: d.RANDD, jobCode: 'RND_ENG', gradeCode: 'G5' },
    { code: 'CTR-KR-RANDD-007', titleKo: '연구사원A', titleEn: 'Research Staff A', deptId: d.RANDD, jobCode: 'RND_ENG', gradeCode: 'G6' },
    { code: 'CTR-KR-RANDD-008', titleKo: '연구사원B', titleEn: 'Research Staff B', deptId: d.RANDD, jobCode: 'RND_ENG', gradeCode: 'G6' },
  ]

  // First pass: create all positions without reportsToPositionId
  for (const p of krPositions) {
    const id = deterministicUUID('pos', p.code)
    await prisma.position.upsert({
      where: { id },
      update: { titleKo: p.titleKo, titleEn: p.titleEn },
      create: {
        id,
        code: p.code,
        titleKo: p.titleKo,
        titleEn: p.titleEn,
        companyId: ctrKrId,
        departmentId: p.deptId,
        jobId: jobMap[p.jobCode],
        jobGradeId: krGrade(p.gradeCode),
      },
    })
    posMap[p.code] = id
  }

  // Second pass: set reportsToPositionId
  const solidLineReporting: Array<[string, string]> = [
    // code -> reportsTo code
    // MGMT chain
    ['CTR-KR-MGMT-002', 'CTR-KR-MGMT-001'], // 경영지원본부장 -> 대표이사
    ['CTR-KR-MGMT-003', 'CTR-KR-MGMT-002'], // 경영지원팀장 -> 경영지원본부장
    ['CTR-KR-MGMT-004', 'CTR-KR-MGMT-003'],
    ['CTR-KR-MGMT-005', 'CTR-KR-MGMT-003'],
    ['CTR-KR-MGMT-006', 'CTR-KR-MGMT-005'],
    // HR chain (reports to 경영지원본부장)
    ['CTR-KR-HR-001', 'CTR-KR-MGMT-002'],
    ['CTR-KR-HR-002', 'CTR-KR-HR-001'],
    ['CTR-KR-HR-003', 'CTR-KR-HR-002'],
    ['CTR-KR-HR-004', 'CTR-KR-HR-003'],
    // DEV chain
    ['CTR-KR-DEV-001', 'CTR-KR-MGMT-002'],
    ['CTR-KR-DEV-002', 'CTR-KR-DEV-001'],
    ['CTR-KR-DEV-003', 'CTR-KR-DEV-001'],
    ['CTR-KR-DEV-004', 'CTR-KR-DEV-002'],
    ['CTR-KR-DEV-005', 'CTR-KR-DEV-003'],
    ['CTR-KR-DEV-006', 'CTR-KR-DEV-004'],
    ['CTR-KR-DEV-007', 'CTR-KR-DEV-005'],
    // SALES chain
    ['CTR-KR-SALES-001', 'CTR-KR-MGMT-002'],
    ['CTR-KR-SALES-002', 'CTR-KR-SALES-001'],
    ['CTR-KR-SALES-003', 'CTR-KR-SALES-001'],
    ['CTR-KR-SALES-004', 'CTR-KR-SALES-002'],
    ['CTR-KR-SALES-005', 'CTR-KR-SALES-003'],
    ['CTR-KR-SALES-006', 'CTR-KR-SALES-004'],
    ['CTR-KR-SALES-007', 'CTR-KR-SALES-005'],
    // MFG chain
    ['CTR-KR-MFG-001', 'CTR-KR-MGMT-002'],
    ['CTR-KR-MFG-002', 'CTR-KR-MFG-001'],
    ['CTR-KR-MFG-003', 'CTR-KR-MFG-001'],
    ['CTR-KR-MFG-004', 'CTR-KR-MFG-002'],
    ['CTR-KR-MFG-005', 'CTR-KR-MFG-002'],
    ['CTR-KR-MFG-006', 'CTR-KR-MFG-003'],
    ['CTR-KR-MFG-007', 'CTR-KR-MFG-004'],
    ['CTR-KR-MFG-008', 'CTR-KR-MFG-005'],
    ['CTR-KR-MFG-009', 'CTR-KR-MFG-006'],
    ['CTR-KR-MFG-010', 'CTR-KR-MFG-006'],
    // QA chain
    ['CTR-KR-QA-001', 'CTR-KR-MGMT-002'],
    ['CTR-KR-QA-002', 'CTR-KR-QA-001'],
    ['CTR-KR-QA-003', 'CTR-KR-QA-001'],
    ['CTR-KR-QA-004', 'CTR-KR-QA-002'],
    ['CTR-KR-QA-005', 'CTR-KR-QA-003'],
    ['CTR-KR-QA-006', 'CTR-KR-QA-004'],
    ['CTR-KR-QA-007', 'CTR-KR-QA-005'],
    // FIN chain
    ['CTR-KR-FIN-001', 'CTR-KR-MGMT-002'],
    ['CTR-KR-FIN-002', 'CTR-KR-FIN-001'],
    ['CTR-KR-FIN-003', 'CTR-KR-FIN-002'],
    ['CTR-KR-FIN-004', 'CTR-KR-FIN-002'],
    ['CTR-KR-FIN-005', 'CTR-KR-FIN-003'],
    // PUR chain
    ['CTR-KR-PUR-001', 'CTR-KR-MGMT-002'],
    ['CTR-KR-PUR-002', 'CTR-KR-PUR-001'],
    ['CTR-KR-PUR-003', 'CTR-KR-PUR-002'],
    ['CTR-KR-PUR-004', 'CTR-KR-PUR-002'],
    ['CTR-KR-PUR-005', 'CTR-KR-PUR-003'],
    // RANDD chain (연구소장 -> 대표이사, 연구팀장 -> 연구소장)
    ['CTR-KR-RANDD-001', 'CTR-KR-MGMT-001'],
    ['CTR-KR-RANDD-002', 'CTR-KR-RANDD-001'],
    ['CTR-KR-RANDD-003', 'CTR-KR-RANDD-002'],
    ['CTR-KR-RANDD-004', 'CTR-KR-RANDD-002'],
    ['CTR-KR-RANDD-005', 'CTR-KR-RANDD-003'],
    ['CTR-KR-RANDD-006', 'CTR-KR-RANDD-004'],
    ['CTR-KR-RANDD-007', 'CTR-KR-RANDD-005'],
    ['CTR-KR-RANDD-008', 'CTR-KR-RANDD-006'],
  ]

  for (const [posCode, reportsToCode] of solidLineReporting) {
    await prisma.position.update({
      where: { id: posMap[posCode] },
      data: { reportsToPositionId: posMap[reportsToCode] },
    })
  }

  console.log(`  ✅ ${krPositions.length} CTR-KR positions with reporting lines`)

  // ----------------------------------------------------------
  // STEP 25: Positions for Other Companies (simplified structure)
  // ----------------------------------------------------------
  console.log('📌 Seeding positions for other companies...')
  let otherPosCount = 0

  // Other companies' department structure:
  const otherCompanyDeptConfig: Record<string, string[]> = {
    'CTR-HQ': ['STRAT'],
    'CTR-MOB': ['ENG', 'MFG'],
    'CTR-ECO': ['ENG', 'OPS'],
    'CTR-ROB': ['ENG', 'MFG'],
    'CTR-ENG': ['ENG', 'RD'],
    'FML': ['OPS', 'FIN'],
    'CTR-US': ['OPS', 'SALES'],
    'CTR-CN': ['MFG', 'QA'],
    'CTR-RU': ['MFG', 'ENG'],
    'CTR-VN': ['MFG', 'ASM'],
    'CTR-EU': ['ENG', 'SALES'],
    'CTR-MX': ['MFG', 'ASM'],
  }

  for (const [compCode, deptCodes] of Object.entries(otherCompanyDeptConfig)) {
    const compId = companyMap[compCode]

    // GM position (company-level, no department)
    const gmCode = `${compCode}-GM-001`
    const gmId = deterministicUUID('pos', gmCode)
    await prisma.position.upsert({
      where: { id: gmId },
      update: { titleKo: 'General Manager', titleEn: 'General Manager' },
      create: {
        id: gmId,
        code: gmCode,
        titleKo: 'General Manager',
        titleEn: 'General Manager',
        companyId: compId,
        jobId: jobMap['OPS_MGR'],
      },
    })
    posMap[gmCode] = gmId
    otherPosCount++

    for (const deptCode of deptCodes) {
      const deptId = deptMap[`${compCode}:${deptCode}`]

      // Dept Head
      const headCode = `${compCode}-${deptCode}-HEAD`
      const headId = deterministicUUID('pos', headCode)
      await prisma.position.upsert({
        where: { id: headId },
        update: { titleKo: `${deptCode} Head`, titleEn: `${deptCode} Head` },
        create: {
          id: headId,
          code: headCode,
          titleKo: `${deptCode} Head`,
          titleEn: `${deptCode} Head`,
          companyId: compId,
          departmentId: deptId,
          jobId: jobMap['OPS_MGR'],
          reportsToPositionId: gmId,
        },
      })
      posMap[headCode] = headId
      otherPosCount++

      // Senior
      const srCode = `${compCode}-${deptCode}-SR`
      const srId = deterministicUUID('pos', srCode)
      await prisma.position.upsert({
        where: { id: srId },
        update: { titleKo: `Senior ${deptCode} Specialist`, titleEn: `Senior ${deptCode} Specialist` },
        create: {
          id: srId,
          code: srCode,
          titleKo: `Senior ${deptCode} Specialist`,
          titleEn: `Senior ${deptCode} Specialist`,
          companyId: compId,
          departmentId: deptId,
          reportsToPositionId: headId,
        },
      })
      posMap[srCode] = srId
      otherPosCount++

      // Staff
      const staffCode = `${compCode}-${deptCode}-STAFF`
      const staffId = deterministicUUID('pos', staffCode)
      await prisma.position.upsert({
        where: { id: staffId },
        update: { titleKo: `${deptCode} Staff`, titleEn: `${deptCode} Staff` },
        create: {
          id: staffId,
          code: staffCode,
          titleKo: `${deptCode} Staff`,
          titleEn: `${deptCode} Staff`,
          companyId: compId,
          departmentId: deptId,
          reportsToPositionId: srId,
        },
      })
      posMap[staffCode] = staffId
      otherPosCount++
    }
  }
  console.log(`  ✅ ${otherPosCount} positions for other companies`)

  // ----------------------------------------------------------
  // STEP 26: CompanyProcessSettings (global defaults + per-company overrides)
  // ----------------------------------------------------------
  console.log('📌 Seeding company process settings...')

  // Clean up legacy lowercase-type records from earlier seed runs
  await prisma.companyProcessSetting.deleteMany({
    where: { settingType: { in: ['evaluation', 'attendance', 'leave', 'payroll', 'recruitment'] } },
  })

  let settingCount = 0

  const globalSettings = [
    { type: 'EVALUATION', key: 'config', value: { grading_scale: 'S_A_B_C', forced_distribution: true, distribution_rules: [{ grade: 'S', min_pct: 0, max_pct: 10 }, { grade: 'A', min_pct: 15, max_pct: 30 }, { grade: 'B', min_pct: 40, max_pct: 60 }, { grade: 'C', min_pct: 10, max_pct: 30 }], review_sequence: ['SELF', 'MANAGER', 'CALIBRATION'], bei_enabled: true, mbo_weight: 70, bei_weight: 30 } },
    { type: 'PROMOTION', key: 'config', value: { min_tenure_by_grade: { G5: 3, G4: 4, G3: 4, G2: 5 }, requires_evaluation_grade: ['S', 'A'], approval_chain: ['TEAM_LEAD', 'DIVISION_HEAD', 'HR_COMMITTEE'] } },
    { type: 'ATTENDANCE', key: 'config', value: { work_hours_per_day: 8, work_days_per_week: 5, weekly_hour_limit: 40, overtime_requires_approval: true, shift_enabled: false } },
    { type: 'LEAVE', key: 'config', value: { leave_types: [{ code: 'ANNUAL', name: '연차', paid: true, default_days: 15 }, { code: 'SICK', name: '병가', paid: false, default_days: 5 }], accrual_rules: [{ tenure_years: 0, annual_days: 11 }, { tenure_years: 1, annual_days: 15 }], carryover_max_days: 10, carryover_expiry_months: 6 } },
    { type: 'ONBOARDING', key: 'config', value: { probation_period_months: 3, required_documents: ['ID', 'DEGREE', 'BANK_ACCOUNT'], buddy_assignment: true } },
    { type: 'RECRUITMENT', key: 'config', value: { pipeline_stages: ['APPLIED', 'SCREEN', 'INTERVIEW_1', 'INTERVIEW_2', 'OFFER', 'ACCEPTED'], approval_required: true, approval_chain: ['HR', 'DEPT_HEAD', 'EXEC'], ai_screening_enabled: true } },
    { type: 'BENEFITS', key: 'config', value: { eligible_programs: ['HEALTH', 'PENSION', 'MEAL', 'TRANSPORT'], currency: 'KRW' } },
    { type: 'COMPENSATION', key: 'pay_day', value: { dayOfMonth: 25 } },
  ]

  for (const s of globalSettings) {
    const id = deterministicUUID('procsetting', `global:${s.type}:${s.key}`)
    const existing = await prisma.companyProcessSetting.findFirst({
      where: { companyId: null, settingType: s.type, settingKey: s.key },
    })
    if (existing) {
      await prisma.companyProcessSetting.update({ where: { id: existing.id }, data: { settingValue: s.value } })
    } else {
      await prisma.companyProcessSetting.create({ data: { id, companyId: null, settingType: s.type, settingKey: s.key, settingValue: s.value } })
    }
    settingCount++
  }

  // ── Per-company overrides ──
  const companyOverrides = [
    // CTR-KR: Korean labor law (52h weekly limit, extended maternity, 4대보험)
    { companyCode: 'CTR-KR', type: 'ATTENDANCE', key: 'config', value: { work_hours_per_day: 8, work_days_per_week: 5, weekly_hour_limit: 52, overtime_requires_approval: true, shift_enabled: false } },
    { companyCode: 'CTR-KR', type: 'LEAVE', key: 'config', value: { leave_types: [{ code: 'ANNUAL', name: '연차', paid: true, default_days: 15 }, { code: 'SICK', name: '병가', paid: false, default_days: 5 }, { code: 'MATERNITY', name: '출산휴가', paid: true, default_days: 90 }], accrual_rules: [{ tenure_years: 0, annual_days: 11 }, { tenure_years: 1, annual_days: 15 }, { tenure_years: 3, annual_days: 16 }], carryover_max_days: 10, carryover_expiry_months: 6 } },
    { companyCode: 'CTR-KR', type: 'ONBOARDING', key: 'config', value: { probation_period_months: 3, required_documents: ['ID', 'DEGREE', 'BANK_ACCOUNT', 'HEALTH_INSURANCE', 'EMPLOYMENT_INSURANCE'], buddy_assignment: true } },
    // CTR-CN: Chinese labor law (44h/week, 春节 bonus leave)
    { companyCode: 'CTR-CN', type: 'ATTENDANCE', key: 'config', value: { work_hours_per_day: 8, work_days_per_week: 5, weekly_hour_limit: 44, overtime_requires_approval: true, shift_enabled: true } },
    { companyCode: 'CTR-CN', type: 'LEAVE', key: 'config', value: { leave_types: [{ code: 'ANNUAL', name: '年假', paid: true, default_days: 5 }, { code: 'SPRING_FESTIVAL', name: '春节', paid: true, default_days: 7 }, { code: 'SICK', name: '病假', paid: false, default_days: 7 }], accrual_rules: [{ tenure_years: 0, annual_days: 5 }, { tenure_years: 10, annual_days: 10 }, { tenure_years: 20, annual_days: 15 }], carryover_max_days: 5, carryover_expiry_months: 12 } },
    // CTR-US: US practices (PTO unified, bi-weekly pay, I-9/W-4 docs)
    { companyCode: 'CTR-US', type: 'EVALUATION', key: 'config', value: { grading_scale: 'A_B_C_D_E', forced_distribution: false, review_sequence: ['SELF', 'MANAGER'], bei_enabled: false, mbo_weight: 100, bei_weight: 0 } },
    { companyCode: 'CTR-US', type: 'LEAVE', key: 'config', value: { leave_types: [{ code: 'PTO', name: 'PTO', paid: true, default_days: 15 }, { code: 'SICK', name: 'Sick Leave', paid: true, default_days: 5 }], accrual_rules: [{ tenure_years: 0, annual_days: 15 }, { tenure_years: 5, annual_days: 20 }], carryover_max_days: 5, carryover_expiry_months: 3 } },
    { companyCode: 'CTR-US', type: 'COMPENSATION', key: 'pay_day', value: { dayOfMonth: 15, biWeekly: true, currency: 'USD' } },
    { companyCode: 'CTR-US', type: 'ONBOARDING', key: 'config', value: { probation_period_months: 0, required_documents: ['I9', 'W4', 'STATE_TAX', 'DIRECT_DEPOSIT', '401K_ENROLLMENT'], buddy_assignment: true } },
    // CTR-RU: Russian labor law (28 days annual, military docs)
    { companyCode: 'CTR-RU', type: 'LEAVE', key: 'config', value: { leave_types: [{ code: 'ANNUAL', name: 'Ежегодный отпуск', paid: true, default_days: 28 }, { code: 'SICK', name: 'Больничный', paid: true, default_days: 14 }], accrual_rules: [{ tenure_years: 0, annual_days: 28 }], carryover_max_days: 14, carryover_expiry_months: 18 } },
    { companyCode: 'CTR-RU', type: 'ONBOARDING', key: 'config', value: { probation_period_months: 3, required_documents: ['PASSPORT', 'MILITARY_ID', 'WORKBOOK', 'INN', 'SNILS'], buddy_assignment: false } },
    // CTR-VN: Vietnamese labor law (12 days annual, notarized contract)
    { companyCode: 'CTR-VN', type: 'LEAVE', key: 'config', value: { leave_types: [{ code: 'ANNUAL', name: 'Nghỉ phép năm', paid: true, default_days: 12 }, { code: 'SICK', name: 'Nghỉ ốm', paid: true, default_days: 30 }], accrual_rules: [{ tenure_years: 0, annual_days: 12 }, { tenure_years: 5, annual_days: 13 }, { tenure_years: 10, annual_days: 14 }], carryover_max_days: 5, carryover_expiry_months: 12 } },
    { companyCode: 'CTR-VN', type: 'ONBOARDING', key: 'config', value: { probation_period_months: 2, required_documents: ['CITIZEN_ID', 'HOUSEHOLD_REGISTRATION', 'DEGREE', 'HEALTH_CERT'], buddy_assignment: false } },
    // CTR-MX: Mexican labor law (graduated vacation, bi-weekly MXN)
    { companyCode: 'CTR-MX', type: 'LEAVE', key: 'config', value: { leave_types: [{ code: 'ANNUAL', name: 'Vacaciones', paid: true, default_days: 12 }, { code: 'SICK', name: 'Incapacidad', paid: true, default_days: 3 }], accrual_rules: [{ tenure_years: 1, annual_days: 12 }, { tenure_years: 2, annual_days: 14 }, { tenure_years: 3, annual_days: 16 }], carryover_max_days: 0, carryover_expiry_months: 12 } },
    { companyCode: 'CTR-MX', type: 'COMPENSATION', key: 'pay_day', value: { dayOfMonth: 15, biWeekly: true, currency: 'MXN' } },
  ]

  for (const s of companyOverrides) {
    const compId = companyMap[s.companyCode]
    if (!compId) continue
    const id = deterministicUUID('procsetting', `${s.companyCode}:${s.type}:${s.key}`)
    await prisma.companyProcessSetting.upsert({
      where: { companyId_settingType_settingKey: { companyId: compId, settingType: s.type, settingKey: s.key } },
      update: { settingValue: s.value },
      create: { id, companyId: compId, settingType: s.type, settingKey: s.key, settingValue: s.value },
    })
    settingCount++
  }

  console.log(`  ✅ ${settingCount} process settings`)

  // ----------------------------------------------------------
  // Assign CTR-KR employees to positions
  // ----------------------------------------------------------
  console.log('📌 Assigning employees to positions...')

  // hr@ctr.co.kr → 인사담당선임 (CTR-KR-HR-002, G4)
  const hrEmpId = deterministicUUID('employee', 'hr@ctr.co.kr')
  await prisma.employeeAssignment.updateMany({
    where: { employeeId: hrEmpId, isPrimary: true, endDate: null },
    data: { positionId: posMap['CTR-KR-HR-002'] },
  })

  // manager@ctr.co.kr → 개발팀장 (CTR-KR-DEV-001, G3)
  const mgEmpId = deterministicUUID('employee', 'manager@ctr.co.kr')
  await prisma.employeeAssignment.updateMany({
    where: { employeeId: mgEmpId, isPrimary: true, endDate: null },
    data: { positionId: posMap['CTR-KR-DEV-001'] },
  })

  // employee@ctr.co.kr → 개발파트장A (CTR-KR-DEV-002, G4 - reports to CTR-KR-DEV-001)
  // departmentId도 DEV로 맞춤 (empConfig에서 이미 DEV 설정됨, position과 동일 부서 보장)
  const empEmpId = deterministicUUID('employee', 'employee@ctr.co.kr')
  await prisma.employeeAssignment.updateMany({
    where: { employeeId: empEmpId, isPrimary: true, endDate: null },
    data: {
      positionId: posMap['CTR-KR-DEV-002'],
      departmentId: deptMap['CTR-KR:DEV'],
    },
  })

  console.log('  ✅ 3 CTR-KR employee position assignments')

  // ----------------------------------------------------------
  // B1: 평가/승진/보상 설정 시드
  // ----------------------------------------------------------
  console.log('📌 Seeding B1 evaluation settings...')
  let b1Count = 0
  const krCompanyId = companyMap['CTR-KR']
  const usCompanyId = companyMap['CTR-US']
  const cnCompanyId = companyMap['CTR-CN']

  // 헬퍼: companyId=null 포함 idempotent create
  async function b1Create<T>(
    model: 'evaluationSetting' | 'promotionSetting' | 'compensationSetting',
    companyId: string | null,
    data: Record<string, unknown>
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma[model] as any).findFirst({ where: { companyId } })
    if (!existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma[model] as any).create({ data: { ...data, companyId } })
    }
    b1Count++
  }

  // ── 평가 설정 ────────────────────────────────────────────────
  await b1Create('evaluationSetting', null, {
    id: deterministicUUID('evalsetting', 'global'),
    methodology: 'MBO_BEI',
    mboGrades: [
      { code: 'O', label: '탁월', order: 1 },
      { code: 'E', label: '우수', order: 2 },
      { code: 'M', label: '보통', order: 3 },
      { code: 'S', label: '미흡', order: 4 },
    ],
    beiGrades: [
      { code: 'O', label: '탁월', order: 1 },
      { code: 'E', label: '우수', order: 2 },
      { code: 'M', label: '보통', order: 3 },
      { code: 'S', label: '미흡', order: 4 },
    ],
    overallGradeEnabled: true,
    overallGradeMethod: 'WEIGHTED',
    mboWeight: 60,
    beiWeight: 40,
    forcedDistribution: true,
    forcedDistributionType: 'SOFT',
    distributionRules: [
      { gradeCode: 'O', minPct: 0, maxPct: 10 },
      { gradeCode: 'E', minPct: 15, maxPct: 30 },
      { gradeCode: 'M', minPct: 40, maxPct: 60 },
      { gradeCode: 'S', minPct: 10, maxPct: 30 },
    ],
    reviewProcessOrder: ['self', 'manager', 'calibration'],
  })

  if (krCompanyId) {
    await b1Create('evaluationSetting', krCompanyId, {
      id: deterministicUUID('evalsetting', 'CTR-KR'),
      methodology: 'MBO_BEI',
      mboGrades: [
        { code: 'S', label: 'S', order: 1 },
        { code: 'A', label: 'A', order: 2 },
        { code: 'Bp', label: 'B+', order: 3 },
        { code: 'B', label: 'B', order: 4 },
        { code: 'C', label: 'C', order: 5 },
      ],
      beiGrades: [
        { code: 'S', label: 'S', order: 1 },
        { code: 'A', label: 'A', order: 2 },
        { code: 'B', label: 'B', order: 3 },
        { code: 'C', label: 'C', order: 4 },
      ],
      overallGradeEnabled: true,
      overallGradeMethod: 'WEIGHTED',
      mboWeight: 60,
      beiWeight: 40,
      forcedDistribution: true,
      forcedDistributionType: 'SOFT',
      distributionRules: [
        { gradeCode: 'S', minPct: 0, maxPct: 5 },
        { gradeCode: 'A', minPct: 10, maxPct: 25 },
        { gradeCode: 'Bp', minPct: 25, maxPct: 40 },
        { gradeCode: 'B', minPct: 30, maxPct: 45 },
        { gradeCode: 'C', minPct: 5, maxPct: 15 },
      ],
      reviewProcessOrder: ['self', 'manager', 'peer', 'calibration'],
    })
  }

  if (usCompanyId) {
    await b1Create('evaluationSetting', usCompanyId, {
      id: deterministicUUID('evalsetting', 'CTR-US'),
      methodology: 'MBO_ONLY',
      mboGrades: [
        { code: '5', label: 'Outstanding', order: 1 },
        { code: '4', label: 'Exceeds', order: 2 },
        { code: '3', label: 'Meets', order: 3 },
        { code: '2', label: 'Below', order: 4 },
        { code: '1', label: 'Unsatisfactory', order: 5 },
      ],
      beiGrades: [],
      overallGradeEnabled: false,
      overallGradeMethod: 'WEIGHTED',
      mboWeight: 100,
      beiWeight: 0,
      forcedDistribution: false,
      forcedDistributionType: 'SOFT',
      distributionRules: [],
      reviewProcessOrder: ['self', 'manager'],
    })
  }

  // ── 승진 설정 ────────────────────────────────────────────────
  await b1Create('promotionSetting', null, {
    id: deterministicUUID('promsetting', 'global'),
    jobLevels: [
      { code: 'S1', label: 'Junior', order: 1 },
      { code: 'S2', label: 'Senior', order: 2 },
      { code: 'S3', label: 'Lead', order: 3 },
      { code: 'S4', label: 'Principal', order: 4 },
    ],
    promotionRules: [
      { fromLevel: 'S1', toLevel: 'S2', minMonths: 36, requiredGrade: 'A' },
      { fromLevel: 'S2', toLevel: 'S3', minMonths: 36, requiredGrade: 'A' },
      { fromLevel: 'S3', toLevel: 'S4', minMonths: 48, requiredGrade: 'S' },
    ],
    promotionCycle: 'ANNUAL',
    promotionMonth: 1,
    approvalChain: [
      { stepOrder: 1, approverRole: 'direct_manager' },
      { stepOrder: 2, approverRole: 'hr_admin' },
    ],
  })

  if (krCompanyId) {
    await b1Create('promotionSetting', krCompanyId, {
      id: deterministicUUID('promsetting', 'CTR-KR'),
      jobLevels: [
        { code: 'G6', label: '사원', order: 1 },
        { code: 'G5', label: '대리', order: 2 },
        { code: 'G4', label: '과장', order: 3 },
        { code: 'G3', label: '차장', order: 4 },
        { code: 'G2', label: '부장', order: 5 },
        { code: 'G1', label: '임원', order: 6 },
      ],
      promotionRules: [
        { fromLevel: 'G6', toLevel: 'G5', minMonths: 36, requiredGrade: 'B' },
        { fromLevel: 'G5', toLevel: 'G4', minMonths: 48, requiredGrade: 'A' },
        { fromLevel: 'G4', toLevel: 'G3', minMonths: 48, requiredGrade: 'A' },
        { fromLevel: 'G3', toLevel: 'G2', minMonths: 60, requiredGrade: 'S' },
      ],
      promotionCycle: 'ANNUAL',
      promotionMonth: 1,
      approvalChain: [
        { stepOrder: 1, approverRole: 'direct_manager' },
        { stepOrder: 2, approverRole: 'dept_head' },
        { stepOrder: 3, approverRole: 'hr_admin' },
      ],
    })
  }

  if (usCompanyId) {
    await b1Create('promotionSetting', usCompanyId, {
      id: deterministicUUID('promsetting', 'CTR-US'),
      jobLevels: [
        { code: 'L1', label: 'Associate', order: 1, trackType: 'IC' },
        { code: 'L2', label: 'Professional', order: 2, trackType: 'IC' },
        { code: 'L3', label: 'Senior', order: 3, trackType: 'IC' },
        { code: 'M1', label: 'Manager', order: 4, trackType: 'MANAGER' },
        { code: 'M2', label: 'Senior Manager', order: 5, trackType: 'MANAGER' },
      ],
      promotionRules: [
        { fromLevel: 'L1', toLevel: 'L2', minMonths: 24, requiredGrade: 'Meets' },
        { fromLevel: 'L2', toLevel: 'L3', minMonths: 36, requiredGrade: 'Exceeds' },
      ],
      promotionCycle: 'ANNUAL',
      promotionMonth: 7,
      approvalChain: [
        { stepOrder: 1, approverRole: 'direct_manager' },
        { stepOrder: 2, approverRole: 'hr_admin' },
      ],
    })
  }

  // ── 보상 설정 ────────────────────────────────────────────────
  await b1Create('compensationSetting', null, {
    id: deterministicUUID('compsetting', 'global'),
    payComponents: [
      { code: 'BASE', label: '기본급', type: 'BASE', taxable: true, required: true },
      { code: 'POSITION', label: '직책수당', type: 'ALLOWANCE', taxable: true, required: false },
    ],
    salaryBands: [],
    raiseMatrix: [
      { grade: 'S', bandPosition: 'LOWER', raisePct: 8 },
      { grade: 'S', bandPosition: 'MID', raisePct: 6 },
      { grade: 'S', bandPosition: 'UPPER', raisePct: 4 },
      { grade: 'A', bandPosition: 'LOWER', raisePct: 5 },
      { grade: 'A', bandPosition: 'MID', raisePct: 4 },
      { grade: 'A', bandPosition: 'UPPER', raisePct: 3 },
      { grade: 'B', bandPosition: 'LOWER', raisePct: 3 },
      { grade: 'B', bandPosition: 'MID', raisePct: 2.5 },
      { grade: 'B', bandPosition: 'UPPER', raisePct: 2 },
      { grade: 'C', bandPosition: 'LOWER', raisePct: 1 },
      { grade: 'C', bandPosition: 'MID', raisePct: 0.5 },
      { grade: 'C', bandPosition: 'UPPER', raisePct: 0 },
    ],
    bonusType: 'GRADE_BASED',
    bonusRules: [
      { grade: 'S', months: 3 },
      { grade: 'A', months: 2 },
      { grade: 'B', months: 1 },
      { grade: 'C', months: 0 },
    ],
    currency: 'KRW',
  })

  if (krCompanyId) {
    await b1Create('compensationSetting', krCompanyId, {
      id: deterministicUUID('compsetting', 'CTR-KR'),
      payComponents: [
        { code: 'BASE', label: '기본급', type: 'BASE', taxable: true, required: true },
        { code: 'POSITION', label: '직책수당', type: 'ALLOWANCE', taxable: true, required: false },
        { code: 'MEAL', label: '식대', type: 'ALLOWANCE', taxable: false, required: true, maxNonTaxable: 200000 },
        { code: 'VEHICLE', label: '차량유지비', type: 'ALLOWANCE', taxable: false, required: false, maxNonTaxable: 200000 },
      ],
      salaryBands: [],
      raiseMatrix: [],
      bonusType: 'GRADE_BASED',
      bonusRules: [
        { grade: 'S', months: 4 },
        { grade: 'A', months: 3 },
        { grade: 'Bp', months: 2 },
        { grade: 'B', months: 1.5 },
        { grade: 'C', months: 0.5 },
      ],
      currency: 'KRW',
    })
  }

  if (usCompanyId) {
    await b1Create('compensationSetting', usCompanyId, {
      id: deterministicUUID('compsetting', 'CTR-US'),
      payComponents: [
        { code: 'BASE', label: 'Base Salary', type: 'BASE', taxable: true, required: true },
        { code: 'BONUS', label: 'Annual Bonus', type: 'BONUS', taxable: true, required: false },
      ],
      salaryBands: [],
      raiseMatrix: [],
      bonusType: 'GRADE_BASED',
      bonusRules: [
        { grade: 'Outstanding', pct: 15 },
        { grade: 'Exceeds', pct: 10 },
        { grade: 'Meets', pct: 5 },
      ],
      currency: 'USD',
    })
  }

  if (cnCompanyId) {
    await b1Create('compensationSetting', cnCompanyId, {
      id: deterministicUUID('compsetting', 'CTR-CN'),
      payComponents: [
        { code: 'BASE', label: '基本工资', type: 'BASE', taxable: true, required: true },
        { code: 'HOUSING', label: '住房补贴', type: 'ALLOWANCE', taxable: false, required: false },
        { code: 'TRANSPORT', label: '交通补贴', type: 'ALLOWANCE', taxable: false, required: false },
      ],
      salaryBands: [],
      raiseMatrix: [],
      bonusType: 'GRADE_BASED',
      bonusRules: [],
      currency: 'CNY',
    })
  }

  // ----------------------------------------------------------
  // B7-2: 환율 시드 (ExchangeRate) — year/month 기반 (3개월치)
  // ----------------------------------------------------------
  const exchangeRateDefs = [
    { from: 'USD', to: 'KRW', rates: ['1366.0', '1372.5', '1358.0'] },
    { from: 'CNY', to: 'KRW', rates: ['185.5', '186.2', '184.8'] },
    { from: 'RUB', to: 'KRW', rates: ['14.8', '15.1', '14.6'] },
    { from: 'VND', to: 'KRW', rates: ['0.0540', '0.0542', '0.0538'] },
    { from: 'MXN', to: 'KRW', rates: ['78.2', '79.0', '77.8'] },
  ]
  // 2025년 1월~3월
  const rateMonths = [
    { year: 2025, month: 1 },
    { year: 2025, month: 2 },
    { year: 2025, month: 3 },
  ]

  for (const def of exchangeRateDefs) {
    for (let i = 0; i < rateMonths.length; i++) {
      const { year, month } = rateMonths[i]
      const existing = await prisma.exchangeRate.findFirst({
        where: { year, month, fromCurrency: def.from, toCurrency: def.to },
      })
      if (!existing) {
        await prisma.exchangeRate.create({
          data: {
            id: deterministicUUID('exrate', `${def.from}:${def.to}:${year}:${month}`),
            year,
            month,
            fromCurrency: def.from,
            toCurrency: def.to,
            rate: def.rates[i],
            source: 'manual',
          },
        })
      }
      b1Count++
    }
  }

  // ----------------------------------------------------------
  // B1: 승인 플로우 시드 (ApprovalFlow + ApprovalFlowStep)
  // ----------------------------------------------------------

  const flowDefs = [
    // 1단계: HR 확인
    { name: '건강검진 신청', module: 'benefits', steps: [{ role: 'hr_admin' }] },
    { name: '출산축하금 신청', module: 'benefits', steps: [{ role: 'hr_admin' }] },
    // 2단계: 팀장 → HR
    { name: '경조사 지원금', module: 'benefits', steps: [{ role: 'direct_manager' }, { role: 'hr_admin' }] },
    { name: '자기개발비/학자금', module: 'benefits', steps: [{ role: 'direct_manager' }, { role: 'hr_admin' }] },
    { name: '일반 채용 승인', module: 'recruitment', steps: [{ role: 'direct_manager' }, { role: 'hr_admin' }] },
    { name: '휴가 신청', module: 'leave', steps: [{ role: 'direct_manager' }, { role: 'hr_admin' }] },
    // 3단계: 팀장 → 경영관리 → HR
    { name: '숙소 지원 신청', module: 'benefits', steps: [{ role: 'direct_manager' }, { role: 'finance' }, { role: 'hr_admin' }] },
    // 4단계: 팀장 → 부서장 → HR → 대표
    { name: '임원급 채용', module: 'recruitment', steps: [{ role: 'direct_manager' }, { role: 'dept_head' }, { role: 'hr_admin' }, { role: 'ceo' }] },
    { name: '승진 심의', module: 'promotion', steps: [{ role: 'direct_manager' }, { role: 'dept_head' }, { role: 'hr_admin' }, { role: 'ceo' }] },
  ]

  for (const fd of flowDefs) {
    const flowId = deterministicUUID('flow', `global:${fd.module}:${fd.name}`)
    const existingFlow = await prisma.approvalFlow.findFirst({ where: { id: flowId } })
    if (!existingFlow) {
      await prisma.approvalFlow.create({
        data: {
          id: flowId,
          name: fd.name,
          companyId: null,
          module: fd.module,
          isActive: true,
          steps: {
            create: fd.steps.map((s, i) => ({
              id: deterministicUUID('flowstep', `${flowId}:${i}`),
              stepOrder: i + 1,
              approverType: 'role',
              approverRole: s.role,
              isRequired: true,
            })),
          },
        },
      })
    }
    b1Count++
  }

  console.log(`  ✅ ${b1Count} B1 settings records (eval + promotion + compensation + exchange rates + approval flows)`)

  // ----------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------
  console.log('\n========================================')
  console.log('🌱 Seed completed successfully!')
  console.log('========================================')
  console.log(`  Companies:           ${Object.keys(companyMap).length}`)
  console.log(`  Roles:               ${Object.keys(roleMap).length}`)
  console.log(`  Permissions:         ${Object.keys(permMap).length}`)
  console.log(`  Role-Permissions:    ${rpCount}`)
  console.log(`  Job Categories:      ${jcCount}`)
  console.log(`  Departments:         ${Object.keys(deptMap).length + 1}`) // +1 for CTR-HQ MGMT
  console.log(`  Job Grades:          ${Object.keys(gradeMap).length}`)
  console.log(`  Test Accounts:       ${testAccounts.length}`)
  console.log(`  EMS Block Config:    1`)
  console.log(`  Onboarding Tasks:    ${onboardingTasks.length}`)
  console.log(`  Offboarding Tasks:   ${offboardingTasks.length}`)
  console.log(`  Salary Bands:        ${salaryBandData.length}`)
  console.log(`  Benefit Policies:    ${benefitPolicyData.length}`)
  console.log(`  Notif Triggers:      ${notificationTriggerData.length}`)
  console.log(`  Holidays:            ${holidayCount}`)
  console.log(`  Tenant Settings:     ${companyData.length}`)
  console.log(`  Term Overrides:      ${termCount}`)
  console.log(`  Enum Options:        ${enumCount}`)
  console.log(`  Workflow Rules:      ${workflowData.length}`)
  console.log(`  Email Templates:     ${emailTemplateData.length}`)
  console.log(`  Export Templates:    ${exportTemplateData.length}`)
  console.log(`  Global Jobs:         ${globalJobs.length}`)
  console.log(`  CTR-KR Positions:    ${krPositions.length}`)
  console.log(`  Other Co Positions:  ${otherPosCount}`)
  // ================================================================
  // B3-1: Competency Framework Seed
  // ================================================================

  // ── 카테고리 ────────────────────────────────────────────────────
  const catCoreValue = await prisma.competencyCategory.upsert({
    where: { code: 'core_value' },
    update: {},
    create: { code: 'core_value', name: '핵심가치 역량', nameEn: 'Core Value Competency', displayOrder: 1 },
  })
  const catLeadership = await prisma.competencyCategory.upsert({
    where: { code: 'leadership' },
    update: {},
    create: { code: 'leadership', name: '리더십 역량', nameEn: 'Leadership Competency', displayOrder: 2 },
  })
  const catTechnical = await prisma.competencyCategory.upsert({
    where: { code: 'technical' },
    update: {},
    create: { code: 'technical', name: '직무 전문 역량', nameEn: 'Technical Competency', displayOrder: 3 },
  })

  // ── 헬퍼: 역량 + 지표 + 레벨 생성 ──────────────────────────────
  async function upsertCompetency(params: {
    categoryId: string
    code: string
    name: string
    nameEn: string
    order: number
    indicators: string[]
  }) {
    const comp = await prisma.competency.upsert({
      where: { categoryId_code: { categoryId: params.categoryId, code: params.code } },
      update: {},
      create: { categoryId: params.categoryId, code: params.code, name: params.name, nameEn: params.nameEn, displayOrder: params.order },
    })
    // 행동지표
    for (let i = 0; i < params.indicators.length; i++) {
      await prisma.competencyIndicator.upsert({
        where: { competencyId_displayOrder: { competencyId: comp.id, displayOrder: i + 1 } },
        update: { indicatorText: params.indicators[i] },
        create: { competencyId: comp.id, indicatorText: params.indicators[i], displayOrder: i + 1 },
      })
    }
    // 숙련도 레벨 5단계
    const levelLabels = ['기초', '보통', '우수', '탁월', '전문가']
    for (let lvl = 1; lvl <= 5; lvl++) {
      await prisma.competencyLevel.upsert({
        where: { competencyId_level: { competencyId: comp.id, level: lvl } },
        update: {},
        create: { competencyId: comp.id, level: lvl, label: levelLabels[lvl - 1] },
      })
    }
    return comp
  }

  // ── 핵심가치 역량 ────────────────────────────────────────────────
  const challengeComp = await upsertCompetency({
    categoryId: catCoreValue.id, code: 'challenge', name: '도전', nameEn: 'Challenge', order: 1,
    indicators: [
      '현재에 안주하지 않고 더 높은 목표를 설정한다',
      '새로운 방법을 시도하며 실패를 학습 기회로 활용한다',
      '변화에 능동적으로 대응하고 개선을 주도한다',
      '도전적 과제를 자발적으로 수행한다',
    ],
  })
  const trustComp = await upsertCompetency({
    categoryId: catCoreValue.id, code: 'trust', name: '신뢰', nameEn: 'Trust', order: 2,
    indicators: [
      '약속을 지키고 일관된 행동으로 신뢰를 쌓는다',
      '투명하게 정보를 공유하고 솔직하게 소통한다',
      '동료의 역량을 믿고 적절히 위임한다',
    ],
  })
  const responsComp = await upsertCompetency({
    categoryId: catCoreValue.id, code: 'responsibility', name: '책임', nameEn: 'Responsibility', order: 3,
    indicators: [
      '맡은 업무에 대해 끝까지 책임지고 완수한다',
      '문제 발생 시 원인을 찾고 해결책을 제시한다',
      '조직의 목표를 개인 업무에 연결하여 실행한다',
    ],
  })
  const respectComp = await upsertCompetency({
    categoryId: catCoreValue.id, code: 'respect', name: '존중', nameEn: 'Respect', order: 4,
    indicators: [
      '다양한 의견을 경청하고 건설적으로 반응한다',
      '동료의 기여를 인정하고 감사를 표현한다',
      '다른 문화와 배경을 이해하고 존중한다',
    ],
  })

  // 핵심가치 직급별 기대레벨 (전 법인 공통, companyId=null)
  const coreValueComps = [challengeComp, trustComp, responsComp, respectComp]
  const coreValueLevelMap: Record<string, number> = { S1: 2, S2: 3, S3: 4, S4: 4 }
  for (const comp of coreValueComps) {
    for (const [jlCode, expectedLevel] of Object.entries(coreValueLevelMap)) {
      const existing = await prisma.competencyRequirement.findFirst({
        where: { competencyId: comp.id, jobLevelCode: jlCode, companyId: null, jobId: null },
      })
      if (!existing) {
        await prisma.competencyRequirement.create({
          data: { competencyId: comp.id, jobLevelCode: jlCode, expectedLevel },
        })
      }
    }
  }

  // ── 리더십 역량 ────────────────────────────────────────────────
  const leadershipDefs = [
    { code: 'strategic_thinking', name: '전략적 사고', nameEn: 'Strategic Thinking', order: 1 },
    { code: 'team_building', name: '팀 빌딩', nameEn: 'Team Building', order: 2 },
    { code: 'decision_making', name: '의사결정', nameEn: 'Decision Making', order: 3 },
  ]
  const leadershipComps = []
  for (const ld of leadershipDefs) {
    const comp = await upsertCompetency({ categoryId: catLeadership.id, ...ld, indicators: [] })
    leadershipComps.push(comp)
  }
  // 리더십 직급별 기대레벨 (S3, S4만)
  for (const comp of leadershipComps) {
    for (const [jlCode, expectedLevel] of [['S3', 3], ['S4', 4]] as const) {
      const existing = await prisma.competencyRequirement.findFirst({
        where: { competencyId: comp.id, jobLevelCode: jlCode, companyId: null, jobId: null },
      })
      if (!existing) {
        await prisma.competencyRequirement.create({
          data: { competencyId: comp.id, jobLevelCode: jlCode, expectedLevel },
        })
      }
    }
  }

  // ── 직무 전문 역량 ────────────────────────────────────────────────
  const technicalDefs = [
    { code: 'welding', name: '용접 기술', nameEn: 'Welding Technology', order: 1 },
    { code: 'quality_mgmt', name: '품질 관리', nameEn: 'Quality Management', order: 2 },
    { code: 'mold_design', name: '금형 설계', nameEn: 'Mold Design', order: 3 },
    { code: 'injection_molding', name: '사출성형', nameEn: 'Injection Molding', order: 4 },
    { code: 'plc_programming', name: 'PLC 프로그래밍', nameEn: 'PLC Programming', order: 5 },
  ]
  for (const td of technicalDefs) {
    await upsertCompetency({ categoryId: catTechnical.id, ...td, indicators: [] })
  }

  const competencyCount = await prisma.competency.count()
  const indicatorCount = await prisma.competencyIndicator.count()
  const requirementCount = await prisma.competencyRequirement.count()
  console.log(`  Competencies:        ${competencyCount}`)
  console.log(`  Indicators:          ${indicatorCount}`)
  console.log(`  Requirements:        ${requirementCount}`)

  console.log(`  Process Settings:    ${settingCount}`)
  console.log('========================================\n')

  // ═══════════════════════════════════════════════════════════
  // B9-1: LMS Lite — 교육과정 + 의무교육 설정 시드
  // ═══════════════════════════════════════════════════════════
  console.log('📚 B9-1: Training Courses + Mandatory Configs ...')

  // ── 법정 의무교육 (3개) ─────────────────────────────────────
  const legalCourses = [
    {
      code: 'LEG-001',
      title: '산업안전보건교육',
      titleEn: 'Occupational Safety & Health Training',
      category: 'SAFETY_TRAINING',
      format: 'offline',
      isMandatory: true,
      durationHours: 8,
      validityMonths: 12,
      provider: 'CTR 안전보건팀',
      description: '산업안전보건법 제29조에 따른 법정 의무교육',
      isActive: true,
    },
    {
      code: 'LEG-002',
      title: '성희롱 예방교육',
      titleEn: 'Sexual Harassment Prevention',
      category: 'COMPLIANCE',
      format: 'online',
      isMandatory: true,
      durationHours: 1,
      validityMonths: 12,
      provider: 'CTR HR팀',
      description: '남녀고용평등법 제13조에 따른 법정 의무교육',
      isActive: true,
    },
    {
      code: 'LEG-003',
      title: '개인정보보호 교육',
      titleEn: 'Personal Data Protection Training',
      category: 'COMPLIANCE',
      format: 'online',
      isMandatory: true,
      durationHours: 2,
      validityMonths: 12,
      provider: 'CTR IT보안팀',
      description: '개인정보보호법에 따른 임직원 의무교육',
      isActive: true,
    },
  ]

  // ── 직무 필수 과정 (5개) ───────────────────────────────────
  const jobRequiredCourses = [
    {
      code: 'JOB-001',
      title: '리더십 기본 과정',
      titleEn: 'Leadership Fundamentals',
      category: 'LEADERSHIP',
      format: 'blended',
      isMandatory: true,
      durationHours: 16,
      validityMonths: 36,
      provider: 'CTR 인재개발팀',
      description: '신임 관리자 필수 리더십 교육 프로그램',
      isActive: true,
    },
    {
      code: 'JOB-002',
      title: '품질관리 심화 과정',
      titleEn: 'Advanced Quality Management',
      category: 'TECHNICAL',
      format: 'offline',
      isMandatory: true,
      durationHours: 24,
      validityMonths: 24,
      provider: 'CTR 품질혁신팀',
      description: 'ISO 9001 기반 품질관리 프로세스 교육',
      isActive: true,
    },
    {
      code: 'JOB-003',
      title: '신입직원 온보딩 교육',
      titleEn: 'New Employee Onboarding',
      category: 'ONBOARDING_TRAINING',
      format: 'blended',
      isMandatory: true,
      durationHours: 8,
      validityMonths: null,
      provider: 'CTR HR팀',
      description: '입사 후 30일 이내 이수 필수',
      isActive: true,
    },
    {
      code: 'JOB-004',
      title: '용접 안전 실무',
      titleEn: 'Welding Safety Practice',
      category: 'SAFETY_TRAINING',
      format: 'offline',
      isMandatory: true,
      durationHours: 4,
      validityMonths: 12,
      provider: 'CTR 생산기술팀',
      description: '용접 작업 전 필수 안전 교육',
      isActive: true,
    },
    {
      code: 'JOB-005',
      title: '인사담당자 필수 과정',
      titleEn: 'HR Practitioner Essentials',
      category: 'COMPLIANCE',
      format: 'online',
      isMandatory: true,
      durationHours: 8,
      validityMonths: 24,
      provider: 'CTR HR팀',
      description: 'HR 담당자 법적 의무 및 실무 역량 교육',
      isActive: true,
    },
  ]

  // ── 자기개발 과정 (4개) ────────────────────────────────────
  const selfDevCourses = [
    {
      code: 'DEV-001',
      title: '데이터 분석 입문',
      titleEn: 'Introduction to Data Analytics',
      category: 'TECHNICAL',
      format: 'self_paced',
      isMandatory: false,
      durationHours: 12,
      validityMonths: null,
      provider: 'Coursera',
      description: 'Excel·Power BI 기반 데이터 분석 실습',
      isActive: true,
    },
    {
      code: 'DEV-002',
      title: '글로벌 커뮤니케이션',
      titleEn: 'Global Communication Skills',
      category: 'LEADERSHIP',
      format: 'online',
      isMandatory: false,
      durationHours: 6,
      validityMonths: null,
      provider: 'CTR 교육센터',
      description: '영어 비즈니스 커뮤니케이션 및 이메일 작성',
      isActive: true,
    },
    {
      code: 'DEV-003',
      title: 'PLC 프로그래밍 실무',
      titleEn: 'PLC Programming Fundamentals',
      category: 'TECHNICAL',
      format: 'offline',
      isMandatory: false,
      durationHours: 20,
      validityMonths: null,
      provider: 'CTR 생산기술팀',
      description: 'Siemens S7 기반 PLC 프로그래밍 실무 과정',
      isActive: true,
    },
    {
      code: 'DEV-004',
      title: '코칭 리더십',
      titleEn: 'Coaching Leadership',
      category: 'LEADERSHIP',
      format: 'blended',
      isMandatory: false,
      durationHours: 8,
      validityMonths: null,
      provider: 'CTR 인재개발팀',
      description: '1:1 코칭 스킬 및 팀 성과관리 리더십 향상',
      isActive: true,
    },
  ]

  const allCourseDefs = [...legalCourses, ...jobRequiredCourses, ...selfDevCourses]
  const createdCourseMap = new Map<string, string>() // code → id

  for (const c of allCourseDefs) {
    const existing = await prisma.trainingCourse.findFirst({ where: { code: c.code } })
    let course
    if (existing) {
      course = await prisma.trainingCourse.update({
        where: { id: existing.id },
        data: {
          title: c.title,
          titleEn: c.titleEn,
          format: c.format,
          isMandatory: c.isMandatory,
          durationHours: c.durationHours,
          validityMonths: c.validityMonths,
          provider: c.provider,
          description: c.description,
          isActive: c.isActive,
        },
      })
    } else {
      course = await prisma.trainingCourse.create({
        data: {
          code: c.code,
          title: c.title,
          titleEn: c.titleEn,
          category: c.category as never,
          format: c.format,
          isMandatory: c.isMandatory,
          durationHours: c.durationHours,
          validityMonths: c.validityMonths,
          provider: c.provider,
          description: c.description,
          isActive: c.isActive,
          companyId: null,
        },
      })
    }
    createdCourseMap.set(c.code, course.id)
  }

  // ── 의무교육 설정 (MandatoryTrainingConfig) ────────────────
  const mandatoryConfigs = [
    { courseCode: 'LEG-001', targetGroup: 'all', frequency: 'annual', deadlineMonth: 12 },
    { courseCode: 'LEG-002', targetGroup: 'all', frequency: 'annual', deadlineMonth: 12 },
    { courseCode: 'LEG-003', targetGroup: 'all', frequency: 'annual', deadlineMonth: 6 },
    { courseCode: 'JOB-001', targetGroup: 'manager', frequency: 'once', deadlineMonth: null },
    { courseCode: 'JOB-003', targetGroup: 'new_hire', frequency: 'once', deadlineMonth: null },
    { courseCode: 'JOB-004', targetGroup: 'production', frequency: 'annual', deadlineMonth: 3 },
  ]

  for (const cfg of mandatoryConfigs) {
    const courseId = createdCourseMap.get(cfg.courseCode)
    if (!courseId) continue
    await prisma.mandatoryTrainingConfig.upsert({
      where: {
        // compound: courseId + targetGroup + frequency (no unique — use findFirst pattern)
        // MandatoryTrainingConfig has no compound unique → use id-based upsert with create only
        id: `seed-mtc-${cfg.courseCode}-${cfg.targetGroup}`,
      },
      update: {
        targetGroup: cfg.targetGroup,
        frequency: cfg.frequency,
        deadlineMonth: cfg.deadlineMonth,
        isActive: true,
      },
      create: {
        id: `seed-mtc-${cfg.courseCode}-${cfg.targetGroup}`,
        courseId,
        companyId: null, // 전사 공통
        targetGroup: cfg.targetGroup,
        frequency: cfg.frequency,
        deadlineMonth: cfg.deadlineMonth,
        isActive: true,
      },
    })
  }

  const courseCount = await prisma.trainingCourse.count()
  const configCount = await prisma.mandatoryTrainingConfig.count()
  console.log(`  Training Courses:       ${courseCount}`)
  console.log(`  Mandatory Configs:      ${configCount}`)
  console.log('========================================\n')

  // ═══════════════════════════════════════════════════════════
  // B6-2: 법인별 휴가 유형 정의 + 연차 부여 규칙
  // ═══════════════════════════════════════════════════════════
  console.log('🏖 B6-2: Leave Type Defs + Accrual Rules ...')

  // ── 법인 ID 조회 ───────────────────────────────────────────
  const companies = await prisma.company.findMany({
    select: { id: true, code: true },
  })
  const companyByCode = Object.fromEntries(companies.map(c => [c.code, c.id]))

  // ── 글로벌 공통 휴가 유형 (companyId = null) ───────────────
  const globalLeaveTypes = [
    { code: 'annual', name: '연차휴가', nameEn: 'Annual Leave', isPaid: true, allowHalfDay: true, requiresProof: false, displayOrder: 1 },
    { code: 'sick', name: '병가', nameEn: 'Sick Leave', isPaid: true, allowHalfDay: false, requiresProof: true, displayOrder: 2 },
    { code: 'bereavement', name: '경조휴가', nameEn: 'Bereavement Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 5, displayOrder: 3 },
    { code: 'maternity', name: '출산휴가', nameEn: 'Maternity Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 90, displayOrder: 4 },
    { code: 'paternity', name: '배우자출산휴가', nameEn: 'Paternity Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 10, displayOrder: 5 },
    { code: 'unpaid', name: '무급휴가', nameEn: 'Unpaid Leave', isPaid: false, allowHalfDay: true, requiresProof: false, displayOrder: 6 },
  ]

  for (const lt of globalLeaveTypes) {
    const existing = await prisma.leaveTypeDef.findFirst({ where: { companyId: null, code: lt.code } })
    if (!existing) {
      await prisma.leaveTypeDef.create({
        data: { ...lt, companyId: null, isActive: true },
      })
    }
  }

  // ── CTR-KR 전용 휴가 유형 ─────────────────────────────────
  const krId = companyByCode['CTR-KR']
  if (krId) {
    const krTypes = [
      { code: 'annual', name: '연차유급휴가', nameEn: 'Annual Paid Leave', isPaid: true, allowHalfDay: true, requiresProof: false, displayOrder: 1 },
      { code: 'sick', name: '병가', nameEn: 'Sick Leave', isPaid: true, allowHalfDay: false, requiresProof: true, displayOrder: 2 },
      { code: 'bereavement', name: '경조휴가', nameEn: 'Bereavement Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 5, displayOrder: 3 },
      { code: 'maternity', name: '출산전후휴가', nameEn: 'Maternity Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 90, displayOrder: 4 },
      { code: 'paternity', name: '배우자출산휴가', nameEn: 'Paternity Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 10, displayOrder: 5 },
      { code: 'childcare', name: '육아휴직', nameEn: 'Childcare Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 365, displayOrder: 6 },
      { code: 'special', name: '특별휴가', nameEn: 'Special Leave', isPaid: true, allowHalfDay: false, requiresProof: false, displayOrder: 7 },
      { code: 'unpaid', name: '무급휴가', nameEn: 'Unpaid Leave', isPaid: false, allowHalfDay: true, requiresProof: false, displayOrder: 8 },
    ]
    for (const lt of krTypes) {
      const existing = await prisma.leaveTypeDef.findFirst({ where: { companyId: krId, code: lt.code } })
      if (!existing) {
        await prisma.leaveTypeDef.create({ data: { ...lt, companyId: krId, isActive: true } })
      }
    }
    // CTR-KR 연차 부여 규칙 (근로기준법)
    const krAnnual = await prisma.leaveTypeDef.findFirst({ where: { companyId: krId, code: 'annual' } })
    if (krAnnual) {
      const existing = await prisma.leaveAccrualRule.findFirst({ where: { leaveTypeDefId: krAnnual.id } })
      if (!existing) {
        await prisma.leaveAccrualRule.create({
          data: {
            leaveTypeDefId: krAnnual.id,
            accrualType: 'mixed',
            accrualBasis: 'hire_date_anniversary',
            rules: [
              { minTenureMonths: 0, maxTenureMonths: 11, daysPerMonth: 1, type: 'monthly' },
              { minTenureMonths: 12, maxTenureMonths: 35, daysPerYear: 15, type: 'annual' },
              { minTenureMonths: 36, maxTenureMonths: null, daysPerYear: 15, bonusPerTwoYears: 1, maxDays: 25, type: 'annual' },
            ],
            carryOverType: 'none',
          },
        })
      }
    }
  }

  // ── CTR-US 전용 휴가 유형 (PTO 통합제) ─────────────────────
  const usId = companyByCode['CTR-US']
  if (usId) {
    const usTypes = [
      { code: 'pto', name: 'PTO', nameEn: 'Paid Time Off', isPaid: true, allowHalfDay: true, requiresProof: false, displayOrder: 1 },
      { code: 'sick', name: 'Sick Leave', nameEn: 'Sick Leave', isPaid: true, allowHalfDay: true, requiresProof: false, displayOrder: 2 },
      { code: 'bereavement', name: 'Bereavement Leave', nameEn: 'Bereavement Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 5, displayOrder: 3 },
      { code: 'maternity', name: 'Maternity/FMLA', nameEn: 'Maternity/FMLA Leave', isPaid: false, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 84, displayOrder: 4 },
      { code: 'paternity', name: 'Paternity Leave', nameEn: 'Paternity Leave', isPaid: false, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 14, displayOrder: 5 },
      { code: 'unpaid', name: 'Unpaid Leave', nameEn: 'Unpaid Leave', isPaid: false, allowHalfDay: true, requiresProof: false, displayOrder: 6 },
    ]
    for (const lt of usTypes) {
      const existing = await prisma.leaveTypeDef.findFirst({ where: { companyId: usId, code: lt.code } })
      if (!existing) {
        await prisma.leaveTypeDef.create({ data: { ...lt, companyId: usId, isActive: true } })
      }
    }
    const usPto = await prisma.leaveTypeDef.findFirst({ where: { companyId: usId, code: 'pto' } })
    if (usPto) {
      const existing = await prisma.leaveAccrualRule.findFirst({ where: { leaveTypeDefId: usPto.id } })
      if (!existing) {
        await prisma.leaveAccrualRule.create({
          data: {
            leaveTypeDefId: usPto.id,
            accrualType: 'annual',
            accrualBasis: 'calendar_year',
            rules: [
              { minTenureMonths: 0, maxTenureMonths: null, daysPerYear: 20, type: 'annual' },
            ],
            carryOverType: 'limited',
            carryOverMaxDays: 5,
            carryOverExpiryMonths: 3,
          },
        })
      }
    }
  }

  // ── CTR-CN 전용 휴가 유형 ─────────────────────────────────
  const cnId = companyByCode['CTR-CN']
  if (cnId) {
    const cnTypes = [
      { code: 'annual', name: '年假', nameEn: 'Annual Leave', isPaid: true, allowHalfDay: false, requiresProof: false, displayOrder: 1 },
      { code: 'sick', name: '病假', nameEn: 'Sick Leave', isPaid: true, allowHalfDay: false, requiresProof: true, displayOrder: 2 },
      { code: 'marriage', name: '婚假', nameEn: 'Marriage Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3, displayOrder: 3 },
      { code: 'maternity', name: '产假', nameEn: 'Maternity Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 98, displayOrder: 4 },
      { code: 'paternity', name: '陪产假', nameEn: 'Paternity Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 15, displayOrder: 5 },
      { code: 'bereavement', name: '丧假', nameEn: 'Bereavement Leave', isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3, displayOrder: 6 },
      { code: 'spring_festival', name: '春节特别假', nameEn: 'Spring Festival Leave', isPaid: true, allowHalfDay: false, requiresProof: false, maxConsecutiveDays: 7, displayOrder: 7 },
      { code: 'unpaid', name: '事假', nameEn: 'Unpaid Leave', isPaid: false, allowHalfDay: false, requiresProof: false, displayOrder: 8 },
    ]
    for (const lt of cnTypes) {
      const existing = await prisma.leaveTypeDef.findFirst({ where: { companyId: cnId, code: lt.code } })
      if (!existing) {
        await prisma.leaveTypeDef.create({ data: { ...lt, companyId: cnId, isActive: true } })
      }
    }
    const cnAnnual = await prisma.leaveTypeDef.findFirst({ where: { companyId: cnId, code: 'annual' } })
    if (cnAnnual) {
      const existing = await prisma.leaveAccrualRule.findFirst({ where: { leaveTypeDefId: cnAnnual.id } })
      if (!existing) {
        await prisma.leaveAccrualRule.create({
          data: {
            leaveTypeDefId: cnAnnual.id,
            accrualType: 'annual',
            accrualBasis: 'calendar_year',
            rules: [
              { minTenureMonths: 12, maxTenureMonths: 119, daysPerYear: 5, type: 'annual' },
              { minTenureMonths: 120, maxTenureMonths: 239, daysPerYear: 10, type: 'annual' },
              { minTenureMonths: 240, maxTenureMonths: null, daysPerYear: 15, type: 'annual' },
            ],
            carryOverType: 'none',
          },
        })
      }
    }
  }

  // ── CTR-RU 글로벌 기본 상속 + 28일 규칙 ─────────────────────
  // ── CTR-VN 글로벌 기본 상속 + 12일 규칙 ─────────────────────
  // ── CTR-MX 글로벌 기본 상속 + 12일 근속 규칙 ────────────────
  const globalAnnual = await prisma.leaveTypeDef.findFirst({ where: { companyId: null, code: 'annual' } })
  if (globalAnnual) {
    const existingRule = await prisma.leaveAccrualRule.findFirst({ where: { leaveTypeDefId: globalAnnual.id } })
    if (!existingRule) {
      await prisma.leaveAccrualRule.create({
        data: {
          leaveTypeDefId: globalAnnual.id,
          accrualType: 'annual',
          accrualBasis: 'calendar_year',
          rules: [
            { minTenureMonths: 0, maxTenureMonths: null, daysPerYear: 15, type: 'annual' },
          ],
          carryOverType: 'limited',
          carryOverMaxDays: 5,
          carryOverExpiryMonths: 3,
        },
      })
    }
  }

  const leaveTypeDefCount = await prisma.leaveTypeDef.count()
  const accrualRuleCount = await prisma.leaveAccrualRule.count()
  console.log(`  LeaveTypeDefs:          ${leaveTypeDefCount}`)
  console.log(`  LeaveAccrualRules:      ${accrualRuleCount}`)
  console.log('========================================\n')

  // ─── B7-1a: 4대보험 요율 + 비과세 한도 시드 ─────────────────────────
  console.log('💰 B7-1a: InsuranceRates + NontaxableLimits 2025 ...')

  // 2025년 4대보험 요율
  const insuranceRates2025 = [
    {
      year: 2025,
      type: 'national_pension',
      employeeRate: 4.5,
      employerRate: 4.5,
      upperLimit: 5_900_000,
      lowerLimit: 370_000,
      notes: '국민연금 (월 보수월액 상한 590만원, 하한 37만원)',
    },
    {
      year: 2025,
      type: 'health_insurance',
      employeeRate: 3.545,
      employerRate: 3.545,
      upperLimit: null,
      lowerLimit: null,
      notes: '건강보험 (2025년 기준)',
    },
    {
      year: 2025,
      type: 'long_term_care',
      employeeRate: 12.81,
      employerRate: 12.81,
      upperLimit: null,
      lowerLimit: null,
      notes: '장기요양보험 — 건강보험료의 12.81% (특수 계산: employeeRate를 배율로 사용)',
    },
    {
      year: 2025,
      type: 'employment_insurance',
      employeeRate: 0.9,
      employerRate: 1.15,
      upperLimit: null,
      lowerLimit: null,
      notes: '고용보험 (150인 미만 기준)',
    },
    {
      year: 2025,
      type: 'industrial_accident',
      employeeRate: 0,
      employerRate: 1.47,
      upperLimit: null,
      lowerLimit: null,
      notes: '산재보험 — 사업주 전액 부담 (제조업 기준)',
    },
  ]

  for (const rate of insuranceRates2025) {
    await prisma.insuranceRate.upsert({
      where: { year_type: { year: rate.year, type: rate.type } },
      update: { employeeRate: rate.employeeRate, employerRate: rate.employerRate, upperLimit: rate.upperLimit, lowerLimit: rate.lowerLimit, notes: rate.notes },
      create: rate,
    })
  }

  // 2025년 비과세 한도
  const nontaxableLimits2025 = [
    { year: 2025, code: 'meal_allowance', name: '식대', monthlyLimit: 200_000, annualLimit: null },
    { year: 2025, code: 'vehicle_allowance', name: '자기차량 운전보조금', monthlyLimit: 200_000, annualLimit: null },
    { year: 2025, code: 'childcare', name: '육아수당', monthlyLimit: 200_000, annualLimit: null },
    { year: 2025, code: 'research_allowance', name: '연구활동비(기업연구소)', monthlyLimit: 200_000, annualLimit: null },
  ]

  for (const limit of nontaxableLimits2025) {
    await prisma.nontaxableLimit.upsert({
      where: { year_code: { year: limit.year, code: limit.code } },
      update: { name: limit.name, monthlyLimit: limit.monthlyLimit, annualLimit: limit.annualLimit },
      create: limit,
    })
  }

  const insuranceRateCount = await prisma.insuranceRate.count()
  const nontaxableLimitCount = await prisma.nontaxableLimit.count()
  console.log(`  InsuranceRates:         ${insuranceRateCount}`)
  console.log(`  NontaxableLimits:       ${nontaxableLimitCount}`)
  console.log('========================================\n')

  // ================================================================
  // B7-1b: 연말정산 시드 데이터 (2025)
  // ================================================================
  console.log('Seeding Year-End Settlement configs (2025)...')

  // YearEndDeductionConfig 2025
  const yearEndDeductionConfigs2025 = [
    // income_deduction
    {
      year: 2025, category: 'income_deduction', code: 'personal', name: '인적공제', displayOrder: 1,
      rules: { basePerPerson: 1500000, additionalSenior: 1000000, additionalDisabled: 2000000, additionalSingleParent: 1000000 }
    },
    {
      year: 2025, category: 'income_deduction', code: 'national_pension', name: '국민연금 공제', displayOrder: 2,
      rules: { rate: 1.0 }
    },
    {
      year: 2025, category: 'income_deduction', code: 'health_insurance', name: '건강보험 공제', displayOrder: 3,
      rules: { rate: 1.0 }
    },
    {
      year: 2025, category: 'income_deduction', code: 'credit_card', name: '신용카드 등 소득공제', displayOrder: 4,
      rules: {
        thresholdRate: 0.25,
        rates: { credit_card: 0.15, debit_card: 0.30, cash_receipt: 0.30, traditional_market: 0.40, public_transport: 0.40, culture: 0.30 },
        limits: { salary_under_7000: 3000000, salary_7000_12000: 2500000, salary_over_12000: 2000000 },
        additionalLimits: { traditional_market: 1000000, public_transport: 1000000, culture: 1000000 }
      }
    },
    {
      year: 2025, category: 'income_deduction', code: 'housing_savings', name: '주택마련저축 공제', displayOrder: 5,
      rules: { rate: 0.4, annualLimit: 2400000, salaryLimit: 70000000 }
    },
    {
      year: 2025, category: 'income_deduction', code: 'housing_loan_interest', name: '주택임차차입금 이자 공제', displayOrder: 6,
      rules: { limits: { lease_deposit: 3000000, mortgage_fixed_15y: 15000000, mortgage_fixed_10y: 3000000 } }
    },
    // tax_credit
    {
      year: 2025, category: 'tax_credit', code: 'earned_income_credit', name: '근로소득 세액공제', displayOrder: 10,
      rules: {
        brackets: [{ maxTax: 1300000, rate: 0.55 }, { minTax: 1300000, rate: 0.30, base: 715000 }],
        limits: { salary_under_3300: 740000, salary_3300_7000: 660000, salary_over_7000: 500000 }
      }
    },
    {
      year: 2025, category: 'tax_credit', code: 'child_credit', name: '자녀 세액공제', displayOrder: 11,
      rules: { first: 150000, second: 350000, thirdPlus: 300000 }
    },
    {
      year: 2025, category: 'tax_credit', code: 'medical_credit', name: '의료비 세액공제', displayOrder: 12,
      rules: { thresholdRate: 0.03, rate: 0.15, seniorDisabledRate: 0.15, limit: 7000000, seniorDisabledNoLimit: true }
    },
    {
      year: 2025, category: 'tax_credit', code: 'education_credit', name: '교육비 세액공제', displayOrder: 13,
      rules: { rate: 0.15, selfNoLimit: true, childLimit: 3000000, kindergartenLimit: 3000000 }
    },
    {
      year: 2025, category: 'tax_credit', code: 'donation_credit', name: '기부금 세액공제', displayOrder: 14,
      rules: { politicalLimit: 100000, rate15: 0.15, rate30threshold: 10000000, rate30: 0.30 }
    },
    {
      year: 2025, category: 'tax_credit', code: 'rent_credit', name: '월세 세액공제', displayOrder: 15,
      rules: { salaryLimit: 70000000, annualLimit: 7500000, rate_under_5500: 0.17, rate_5500_7000: 0.15 }
    },
  ]

  for (const config of yearEndDeductionConfigs2025) {
    await prisma.yearEndDeductionConfig.upsert({
      where: { year_code: { year: config.year, code: config.code } },
      update: { rules: config.rules as any, name: config.name, displayOrder: config.displayOrder },
      create: { ...config, rules: config.rules as any },
    })
  }

  // IncomeTaxRate 2025
  const taxRates2025 = [
    { year: 2025, minAmount: BigInt(0), maxAmount: BigInt(14000000), rate: 6, progressiveDeduction: BigInt(0) },
    { year: 2025, minAmount: BigInt(14000000), maxAmount: BigInt(50000000), rate: 15, progressiveDeduction: BigInt(1260000) },
    { year: 2025, minAmount: BigInt(50000000), maxAmount: BigInt(88000000), rate: 24, progressiveDeduction: BigInt(5760000) },
    { year: 2025, minAmount: BigInt(88000000), maxAmount: BigInt(150000000), rate: 35, progressiveDeduction: BigInt(15440000) },
    { year: 2025, minAmount: BigInt(150000000), maxAmount: BigInt(300000000), rate: 38, progressiveDeduction: BigInt(19940000) },
    { year: 2025, minAmount: BigInt(300000000), maxAmount: BigInt(500000000), rate: 40, progressiveDeduction: BigInt(25940000) },
    { year: 2025, minAmount: BigInt(500000000), maxAmount: BigInt(1000000000), rate: 42, progressiveDeduction: BigInt(35940000) },
    { year: 2025, minAmount: BigInt(1000000000), maxAmount: null, rate: 45, progressiveDeduction: BigInt(65940000) },
  ]

  for (const rate of taxRates2025) {
    await prisma.incomeTaxRate.upsert({
      where: { year_minAmount: { year: rate.year, minAmount: rate.minAmount } },
      update: { maxAmount: rate.maxAmount, rate: rate.rate, progressiveDeduction: rate.progressiveDeduction },
      create: rate,
    })
  }

  const yearEndDeductionConfigCount = await prisma.yearEndDeductionConfig.count()
  const incomeTaxRateCount = await prisma.incomeTaxRate.count()
  console.log(`  YearEndDeductionConfigs: ${yearEndDeductionConfigCount}`)
  console.log(`  IncomeTaxRates:          ${incomeTaxRateCount}`)
  console.log('========================================\n')

  // ═══════════════════════════════════════════════════════════
  // B8-3: 스킬 매트릭스 — 시드 데이터
  // CTR-KR 생산팀 6명 + 역량 평가 (2026-H1)
  // 시나리오: PLC 프로그래밍 큰 갭 / 도전 강점
  // ═══════════════════════════════════════════════════════════
  console.log('🔧 B8-3: Skill Matrix seed (CTR-KR MFG employees + assessments)...')

  const SKILL_PERIOD = '2026-H1'
  const mfgDeptId = deterministicUUID('dept', 'CTR-KR:MFG')
  const productionCatId = jobCatMap['CTR-KR:PRODUCTION']

  // ── 1. 직급별 역량 기대레벨 추가 (G3~G6) ────────────────────
  // 핵심가치 (challenge, trust, responsibility, respect)
  const coreValueGradeMap: Record<string, number> = { G3: 4, G4: 3, G5: 3, G6: 2 }
  // 직무 전문 역량
  const technicalGradeMap: Record<string, Record<string, number>> = {
    welding: { G3: 5, G4: 4, G5: 3, G6: 2 },
    quality_mgmt: { G3: 5, G4: 4, G5: 3, G6: 2 },
    mold_design: { G3: 4, G4: 3, G5: 2, G6: 1 },
    injection_molding: { G3: 4, G4: 3, G5: 3, G6: 2 },
    plc_programming: { G3: 5, G4: 4, G5: 3, G6: 2 },
  }

  const coreValueCodes = ['challenge', 'trust', 'responsibility', 'respect']
  for (const code of coreValueCodes) {
    const comp = await prisma.competency.findFirst({ where: { code } })
    if (!comp) continue
    for (const [gradeCode, expectedLevel] of Object.entries(coreValueGradeMap)) {
      const existing = await prisma.competencyRequirement.findFirst({
        where: { competencyId: comp.id, jobLevelCode: gradeCode, companyId: ctrKrId },
      })
      if (!existing) {
        await prisma.competencyRequirement.create({
          data: { competencyId: comp.id, jobLevelCode: gradeCode, companyId: ctrKrId, expectedLevel },
        })
      }
    }
  }

  for (const [code, gradeMap2] of Object.entries(technicalGradeMap)) {
    const comp = await prisma.competency.findFirst({ where: { code } })
    if (!comp) continue
    for (const [gradeCode, expectedLevel] of Object.entries(gradeMap2)) {
      const existing = await prisma.competencyRequirement.findFirst({
        where: { competencyId: comp.id, jobLevelCode: gradeCode, companyId: ctrKrId },
      })
      if (!existing) {
        await prisma.competencyRequirement.create({
          data: { competencyId: comp.id, jobLevelCode: gradeCode, companyId: ctrKrId, expectedLevel },
        })
      }
    }
  }

  // ── 2. CTR-KR 생산팀 직원 6명 생성 ─────────────────────────
  const mfgEmployees = [
    {
      no: 'CTR-KR-2001', name: '김현식', nameEn: 'Kim Hyunshik', grade: 'G4', email: 'kim.hyunshik@ctr.co.kr',
      scores: { challenge: 5, trust: 4, responsibility: 4, respect: 3, welding: 4, quality_mgmt: 4, mold_design: 3, injection_molding: 3, plc_programming: 2 }
    },
    {
      no: 'CTR-KR-2002', name: '이태준', nameEn: 'Lee Taejun', grade: 'G4', email: 'lee.taejun@ctr.co.kr',
      scores: { challenge: 4, trust: 3, responsibility: 3, respect: 4, welding: 4, quality_mgmt: 3, mold_design: 2, injection_molding: 3, plc_programming: 1 }
    },
    {
      no: 'CTR-KR-2003', name: '박재홍', nameEn: 'Park Jaehong', grade: 'G5', email: 'park.jaehong@ctr.co.kr',
      scores: { challenge: 4, trust: 3, responsibility: 3, respect: 3, welding: 3, quality_mgmt: 3, mold_design: 2, injection_molding: 2, plc_programming: 2 }
    },
    {
      no: 'CTR-KR-2004', name: '최민준', nameEn: 'Choi Minjun', grade: 'G5', email: 'choi.minjun@ctr.co.kr',
      scores: { challenge: 3, trust: 4, responsibility: 3, respect: 3, welding: 4, quality_mgmt: 3, mold_design: 1, injection_molding: 3, plc_programming: 1 }
    },
    {
      no: 'CTR-KR-2005', name: '정수현', nameEn: 'Jeong Suhyun', grade: 'G6', email: 'jeong.suhyun@ctr.co.kr',
      scores: { challenge: 3, trust: 3, responsibility: 3, respect: 2, welding: 3, quality_mgmt: 2, mold_design: 1, injection_molding: 2, plc_programming: 1 }
    },
    {
      no: 'CTR-KR-2006', name: '홍기영', nameEn: 'Hong Giyeong', grade: 'G6', email: 'hong.giyeong@ctr.co.kr',
      scores: { challenge: 3, trust: 3, responsibility: 2, respect: 3, welding: 2, quality_mgmt: 2, mold_design: 1, injection_molding: 2, plc_programming: 2 }
    },
  ]

  let skillEmpCount = 0
  let skillAssessCount = 0

  for (const m of mfgEmployees) {
    const empId = deterministicUUID('employee', `mfg:${m.no}`)
    const gradeId = gradeMap[`CTR-KR:${m.grade}`]

    // Employee 생성
    const emp = await prisma.employee.upsert({
      where: { employeeNo: m.no },
      update: { name: m.name, nameEn: m.nameEn },
      create: { id: empId, employeeNo: m.no, name: m.name, nameEn: m.nameEn, email: m.email, hireDate: new Date('2023-03-01') },
    })

    // EmployeeAssignment 생성
    const existingA = await prisma.employeeAssignment.findFirst({
      where: { employeeId: emp.id, isPrimary: true, endDate: null },
    })
    if (!existingA) {
      await prisma.employeeAssignment.create({
        data: {
          id: deterministicUUID('assignment', `mfg:${m.no}`),
          employeeId: emp.id,
          companyId: ctrKrId,
          departmentId: mfgDeptId,
          jobGradeId: gradeId,
          jobCategoryId: productionCatId,
          effectiveDate: new Date('2023-03-01'),
          changeType: 'HIRE',
          employmentType: 'FULL_TIME',
          status: 'ACTIVE',
          isPrimary: true,
        },
      })
    }

    // EmployeeRole (EMPLOYEE)
    const empRoleId = deterministicUUID('emprole', `mfg:${m.no}:EMPLOYEE`)
    const employeeRoleId = roleMap['EMPLOYEE']
    if (employeeRoleId) {
      await prisma.employeeRole.upsert({
        where: { employeeId_roleId_companyId: { employeeId: emp.id, roleId: employeeRoleId, companyId: ctrKrId } },
        update: {},
        create: { id: empRoleId, employeeId: emp.id, roleId: employeeRoleId, companyId: ctrKrId, startDate: new Date('2023-03-01') },
      })
    }

    skillEmpCount++

    // ── 3. 역량 평가 생성 (2026-H1, 자기평가=매니저평가=최종) ──
    for (const [code, level] of Object.entries(m.scores)) {
      const comp = await prisma.competency.findFirst({ where: { code } })
      if (!comp) continue
      await prisma.employeeSkillAssessment.upsert({
        where: {
          employeeId_competencyId_assessmentPeriod: {
            employeeId: emp.id,
            competencyId: comp.id,
            assessmentPeriod: SKILL_PERIOD,
          },
        },
        update: { selfLevel: level, managerLevel: level, finalLevel: level },
        create: {
          employeeId: emp.id,
          competencyId: comp.id,
          assessmentPeriod: SKILL_PERIOD,
          selfLevel: level,
          managerLevel: level,
          finalLevel: level,
          assessedAt: new Date('2026-01-15'),
        },
      })
      skillAssessCount++
    }
  }

  console.log(`  ✅ ${skillEmpCount} MFG employees`)
  console.log(`  ✅ ${skillAssessCount} skill assessments (period: ${SKILL_PERIOD})`)
  console.log('========================================\n')

  // ================================================================
  // B7-2: 해외법인 급여 시드 (5법인 × 5~10명)
  // ================================================================
  console.log('🌍 B7-2: Foreign Payroll Seed (5 companies)...')
  let foreignPayrollCount = 0

  const foreignPayrollDefs = [
    {
      companyCode: 'CTR-US', currency: 'USD', yearMonth: '2025-03', year: 2025, month: 3,
      employees: [
        { num: 'US001', name: 'John Smith', base: 8500, allowances: 2000, deductions: 2100, net: 8400 },
        { num: 'US002', name: 'Jane Doe', base: 7200, allowances: 1500, deductions: 1740, net: 6960 },
        { num: 'US003', name: 'Michael Johnson', base: 12500, allowances: 3000, deductions: 3750, net: 11750 },
        { num: 'US004', name: 'Emily Davis', base: 9800, allowances: 2200, deductions: 2640, net: 9360 },
        { num: 'US005', name: 'Robert Wilson', base: 6500, allowances: 1200, deductions: 1500, net: 6200 },
        { num: 'US006', name: 'Sarah Taylor', base: 11000, allowances: 2500, deductions: 3150, net: 10350 },
        { num: 'US007', name: 'David Brown', base: 7800, allowances: 1600, deductions: 1920, net: 7480 },
        { num: 'US008', name: 'Jennifer Martinez', base: 8200, allowances: 1800, deductions: 2100, net: 7900 },
        { num: 'US009', name: 'James Anderson', base: 10200, allowances: 2300, deductions: 2880, net: 9620 },
        { num: 'US010', name: 'Jessica Garcia', base: 6800, allowances: 1300, deductions: 1620, net: 6480 },
      ],
    },
    {
      companyCode: 'CTR-CN', currency: 'CNY', yearMonth: '2025-03', year: 2025, month: 3,
      employees: [
        { num: 'CN001', name: '王伟', base: 18000, allowances: 3500, deductions: 3780, net: 17720 },
        { num: 'CN002', name: '李娜', base: 15000, allowances: 2800, deductions: 3000, net: 14800 },
        { num: 'CN003', name: '张磊', base: 22000, allowances: 4200, deductions: 4800, net: 21400 },
        { num: 'CN004', name: '刘芳', base: 12000, allowances: 2000, deductions: 2400, net: 11600 },
        { num: 'CN005', name: '陈强', base: 16500, allowances: 3000, deductions: 3300, net: 16200 },
        { num: 'CN006', name: '杨洋', base: 25000, allowances: 5000, deductions: 5500, net: 24500 },
        { num: 'CN007', name: '赵静', base: 13500, allowances: 2500, deductions: 2700, net: 13300 },
        { num: 'CN008', name: '黄明', base: 19000, allowances: 3800, deductions: 4100, net: 18700 },
        { num: 'CN009', name: '周丽', base: 14000, allowances: 2600, deductions: 2800, net: 13800 },
        { num: 'CN010', name: '吴刚', base: 20000, allowances: 4000, deductions: 4400, net: 19600 },
      ],
    },
    {
      companyCode: 'CTR-RU', currency: 'RUB', yearMonth: '2025-03', year: 2025, month: 3,
      employees: [
        { num: 'RU001', name: 'Иванов Алексей', base: 180000, allowances: 35000, deductions: 28600, net: 186400 },
        { num: 'RU002', name: 'Петрова Мария', base: 150000, allowances: 28000, deductions: 23100, net: 154900 },
        { num: 'RU003', name: 'Сидоров Игорь', base: 220000, allowances: 42000, deductions: 34060, net: 227940 },
        { num: 'RU004', name: 'Козлова Наталья', base: 135000, allowances: 25000, deductions: 20800, net: 139200 },
        { num: 'RU005', name: 'Морозов Дмитрий', base: 200000, allowances: 38000, deductions: 30940, net: 207060 },
      ],
    },
    {
      companyCode: 'CTR-VN', currency: 'VND', yearMonth: '2025-03', year: 2025, month: 3,
      employees: [
        { num: 'VN001', name: 'Nguyen Van An', base: 35000000, allowances: 7000000, deductions: 5040000, net: 36960000 },
        { num: 'VN002', name: 'Tran Thi Binh', base: 28000000, allowances: 5500000, deductions: 3990000, net: 29510000 },
        { num: 'VN003', name: 'Le Van Cuong', base: 42000000, allowances: 8500000, deductions: 6075000, net: 44425000 },
        { num: 'VN004', name: 'Pham Thi Dung', base: 25000000, allowances: 4800000, deductions: 3570000, net: 26230000 },
        { num: 'VN005', name: 'Hoang Van Em', base: 32000000, allowances: 6200000, deductions: 4578000, net: 33622000 },
        { num: 'VN006', name: 'Dang Thi Phuong', base: 38000000, allowances: 7500000, deductions: 5415000, net: 40085000 },
        { num: 'VN007', name: 'Bui Van Giang', base: 22000000, allowances: 4000000, deductions: 3120000, net: 22880000 },
        { num: 'VN008', name: 'Vu Thi Hoa', base: 45000000, allowances: 9000000, deductions: 6480000, net: 47520000 },
      ],
    },
    {
      companyCode: 'CTR-MX', currency: 'MXN', yearMonth: '2025-03', year: 2025, month: 3,
      employees: [
        { num: 'MX001', name: 'Garcia Lopez Carlos', base: 45000, allowances: 9000, deductions: 9540, net: 44460 },
        { num: 'MX002', name: 'Martinez Rodriguez Ana', base: 38000, allowances: 7500, deductions: 7980, net: 37520 },
        { num: 'MX003', name: 'Hernandez Torres Luis', base: 55000, allowances: 11000, deductions: 11880, net: 54120 },
        { num: 'MX004', name: 'Lopez Gonzalez Rosa', base: 32000, allowances: 6000, deductions: 6720, net: 31280 },
        { num: 'MX005', name: 'Perez Sanchez Juan', base: 48000, allowances: 9500, deductions: 10185, net: 47315 },
      ],
    },
  ]

  const companyMapB7: Record<string, string> = {}
  const allCompaniesB7 = await prisma.company.findMany({ select: { id: true, code: true } })
  for (const c of allCompaniesB7) companyMapB7[c.code] = c.id

  const hrAdminEmpB7 = await prisma.employee.findFirst({
    where: { assignments: { some: { isPrimary: true, endDate: null } } },
    select: { id: true },
  })
  const uploadedById = hrAdminEmpB7?.id ?? 'system'

  for (const def of foreignPayrollDefs) {
    const companyId = companyMapB7[def.companyCode]
    if (!companyId) continue

    // PayrollImportMapping
    const mappingId = deterministicUUID('pim', `${def.companyCode}:default`)
    const existingMapping = await prisma.payrollImportMapping.findFirst({ where: { id: mappingId } })
    if (!existingMapping) {
      const currencyMappings: Record<string, Array<{ sourceColumn: string; targetField: string }>> = {
        USD: [
          { sourceColumn: 'Employee ID', targetField: 'employeeId' },
          { sourceColumn: 'Base Salary', targetField: 'baseSalary' },
          { sourceColumn: 'Bonus', targetField: 'allowance:bonus' },
          { sourceColumn: 'Federal Tax', targetField: 'incomeTax' },
          { sourceColumn: 'Net Pay', targetField: 'netPay' },
        ],
        CNY: [
          { sourceColumn: '工号', targetField: 'employeeId' },
          { sourceColumn: '基本工资', targetField: 'baseSalary' },
          { sourceColumn: '住房补贴', targetField: 'allowance:housing' },
          { sourceColumn: '个人所得税', targetField: 'incomeTax' },
          { sourceColumn: '实发工资', targetField: 'netPay' },
        ],
        RUB: [
          { sourceColumn: 'Табельный номер', targetField: 'employeeId' },
          { sourceColumn: 'Оклад', targetField: 'baseSalary' },
          { sourceColumn: 'Премия', targetField: 'allowance:bonus' },
          { sourceColumn: 'НДФЛ', targetField: 'incomeTax' },
          { sourceColumn: 'К выплате', targetField: 'netPay' },
        ],
        VND: [
          { sourceColumn: 'Ma NV', targetField: 'employeeId' },
          { sourceColumn: 'Luong co ban', targetField: 'baseSalary' },
          { sourceColumn: 'Phu cap', targetField: 'allowance:allowance' },
          { sourceColumn: 'Thue TNCN', targetField: 'incomeTax' },
          { sourceColumn: 'Thuc linh', targetField: 'netPay' },
        ],
        MXN: [
          { sourceColumn: 'No. Empleado', targetField: 'employeeId' },
          { sourceColumn: 'Sueldo Base', targetField: 'baseSalary' },
          { sourceColumn: 'Bonos', targetField: 'allowance:bonus' },
          { sourceColumn: 'ISR', targetField: 'incomeTax' },
          { sourceColumn: 'Neto a Pagar', targetField: 'netPay' },
        ],
      }
      await prisma.payrollImportMapping.create({
        data: {
          id: mappingId,
          companyId,
          name: `${def.companyCode} Monthly Payroll`,
          fileType: 'xlsx',
          headerRow: 1,
          mappings: currencyMappings[def.currency] ?? [],
          currency: def.currency,
          isDefault: true,
        },
      })
    }

    // PayrollRun
    const runId = deterministicUUID('prun', `${def.companyCode}:${def.yearMonth}`)
    const existingRun = await prisma.payrollRun.findFirst({ where: { id: runId } })
    if (!existingRun) {
      const periodStart = new Date(`${def.yearMonth}-01`)
      const periodEnd = new Date(def.year, def.month, 0)
      const totalGross = def.employees.reduce((s, e) => s + e.base + e.allowances, 0)
      const totalNet = def.employees.reduce((s, e) => s + e.net, 0)
      const totalDed = def.employees.reduce((s, e) => s + e.deductions, 0)
      await prisma.payrollRun.create({
        data: {
          id: runId,
          companyId,
          name: `${def.companyCode} ${def.yearMonth} 급여`,
          runType: 'MONTHLY',
          yearMonth: def.yearMonth,
          frequency: 'MONTHLY',
          periodStart,
          periodEnd,
          status: 'PAID',
          currency: def.currency,
          headcount: def.employees.length,
          totalGross,
          totalDeductions: totalDed,
          totalNet,
          paidAt: new Date(`${def.yearMonth}-25`),
        },
      })
    }

    // PayrollImportLog
    const logId = deterministicUUID('plog', `${def.companyCode}:${def.yearMonth}`)
    const existingLog = await prisma.payrollImportLog.findFirst({ where: { id: logId } })
    if (!existingLog) {
      await prisma.payrollImportLog.create({
        data: {
          id: logId,
          companyId,
          mappingId,
          runId,
          year: def.year,
          month: def.month,
          fileName: `${def.companyCode}_payroll_${def.yearMonth}.xlsx`,
          employeeCount: def.employees.length,
          totalGross: def.employees.reduce((s, e) => s + e.base + e.allowances, 0),
          totalNet: def.employees.reduce((s, e) => s + e.net, 0),
          currency: def.currency,
          status: 'confirmed',
          uploadedBy: uploadedById,
          confirmedAt: new Date(`${def.yearMonth}-20`),
        },
      })
    }

    // PayrollItems
    const jobGrade = await prisma.jobGrade.findFirst({ where: { code: 'S3' } })
    for (const emp of def.employees) {
      const existingEmployee = await prisma.employee.findFirst({
        where: { employeeNo: emp.num },
        select: { id: true },
      })
      let employeeId = existingEmployee?.id
      if (!employeeId) {
        const syntheticEmpId = deterministicUUID('emp-foreign', `${def.companyCode}:${emp.num}`)
        const existingSynth = await prisma.employee.findFirst({ where: { id: syntheticEmpId } })
        if (!existingSynth) {
          await prisma.employee.create({
            data: {
              id: syntheticEmpId,
              employeeNo: emp.num,
              name: emp.name,
              email: `${emp.num.toLowerCase()}@ctr-${def.companyCode.toLowerCase().replace('ctr-', '')}.com`,
              hireDate: new Date('2022-01-01'),
              assignments: {
                create: {
                  companyId,
                  jobGradeId: jobGrade?.id,
                  employmentType: 'FULL_TIME',
                  status: 'ACTIVE',
                  isPrimary: true,
                  effectiveDate: new Date('2022-01-01'),
                  changeType: 'HIRE',
                },
              },
            },
          })
        }
        employeeId = syntheticEmpId
      }

      const itemId = deterministicUUID('pitem', `${runId}:${emp.num}`)
      const existingItem = await prisma.payrollItem.findFirst({ where: { id: itemId } })
      if (!existingItem) {
        await prisma.payrollItem.create({
          data: {
            id: itemId,
            runId,
            employeeId,
            baseSalary: emp.base,
            overtimePay: 0,
            bonus: 0,
            allowances: emp.allowances,
            grossPay: emp.base + emp.allowances,
            deductions: emp.deductions,
            netPay: emp.net,
            currency: def.currency,
            detail: { source: 'import', employeeNumber: emp.num, employeeName: emp.name },
          },
        })
        foreignPayrollCount++
      }
    }
  }

  console.log(`  ✅ ${foreignPayrollCount} PayrollItems (5 foreign companies)`)
  console.log('========================================\n')

  // ----------------------------------------------------------
  // STEP 27: Seed BenefitPlans (B9-2)
  // ----------------------------------------------------------
  console.log('📌 Seeding benefit plans...')

  const benefitPlansKR = [
    { code: 'KR-FAM-WED-SELF', name: '결혼축하금(본인)', nameEn: 'Wedding Gift (Self)', category: 'family', benefitType: 'fixed_amount', amount: 500000, maxAmount: 500000, frequency: 'per_event', requiresProof: true },
    { code: 'KR-FAM-WED-CHILD', name: '결혼축하금(자녀)', nameEn: 'Wedding Gift (Child)', category: 'family', benefitType: 'fixed_amount', amount: 300000, maxAmount: 300000, frequency: 'per_event', requiresProof: true },
    { code: 'KR-FAM-OBT-PARENT', name: '조의금(부모/배우자부모)', nameEn: 'Condolence (Parent)', category: 'family', benefitType: 'fixed_amount', amount: 500000, maxAmount: 500000, frequency: 'per_event', requiresProof: true },
    { code: 'KR-FAM-OBT-GRAND', name: '조의금(조부모)', nameEn: 'Condolence (Grandparent)', category: 'family', benefitType: 'fixed_amount', amount: 300000, maxAmount: 300000, frequency: 'per_event', requiresProof: true },
    { code: 'KR-FAM-BIRTH', name: '출산축하금', nameEn: 'Birth Congratulation', category: 'family', benefitType: 'fixed_amount', amount: 300000, maxAmount: 300000, frequency: 'per_event', requiresProof: true },
    { code: 'KR-EDU-TUITION', name: '대학학자금', nameEn: 'Tuition Support', category: 'education', benefitType: 'reimbursement', amount: null, maxAmount: 2000000, frequency: 'annual', requiresProof: true },
    { code: 'KR-EDU-SELF-DEV', name: '자기개발비', nameEn: 'Self Development', category: 'education', benefitType: 'reimbursement', amount: null, maxAmount: 1000000, frequency: 'annual', requiresProof: true },
    { code: 'KR-HLT-CHECKUP', name: '종합건강검진', nameEn: 'Health Checkup', category: 'health', benefitType: 'reimbursement', amount: null, maxAmount: 500000, frequency: 'annual', requiresProof: true },
    { code: 'KR-HLT-GLASSES', name: '안경/렌즈 지원', nameEn: 'Glasses/Lens Support', category: 'health', benefitType: 'reimbursement', amount: null, maxAmount: 200000, frequency: 'annual', requiresProof: true },
    { code: 'KR-LFS-CLUB', name: '사내동호회', nameEn: 'Club Activity', category: 'lifestyle', benefitType: 'subscription', amount: 50000, maxAmount: 50000, frequency: 'monthly', requiresProof: false },
  ]

  let bpCount = 0
  for (let i = 0; i < benefitPlansKR.length; i++) {
    const bp = benefitPlansKR[i]
    const id = deterministicUUID('benefit-plan', `CTR-KR:${bp.code}`)
    await prisma.benefitPlan.upsert({
      where: { id },
      update: { name: bp.name, isActive: true },
      create: {
        id,
        companyId: ctrKrId,
        code: bp.code,
        name: bp.name,
        nameEn: bp.nameEn,
        category: bp.category,
        benefitType: bp.benefitType,
        amount: bp.amount,
        maxAmount: bp.maxAmount,
        currency: 'KRW',
        frequency: bp.frequency,
        requiresApproval: true,
        requiresProof: bp.requiresProof,
        isActive: true,
        displayOrder: i,
      },
    })
    bpCount++
  }

  // CTR-US benefit plans
  const benefitPlansUS = [
    { code: 'US-FIN-401K', name: '401k Matching', nameEn: '401k Matching', category: 'financial', benefitType: 'subscription', amount: null, maxAmount: null, frequency: 'monthly', requiresProof: false },
    { code: 'US-FIN-ESPP', name: 'Stock Purchase Plan', nameEn: 'Employee Stock Purchase Plan', category: 'financial', benefitType: 'subscription', amount: null, maxAmount: null, frequency: 'monthly', requiresProof: false },
    { code: 'US-HLT-INSURE', name: 'Health Insurance Subsidy', nameEn: 'Health Insurance Subsidy', category: 'health', benefitType: 'subscription', amount: 500, maxAmount: 500, frequency: 'monthly', requiresProof: false },
    { code: 'US-HLT-GYM', name: 'Gym Membership', nameEn: 'Gym Membership Reimbursement', category: 'health', benefitType: 'reimbursement', amount: null, maxAmount: 50, frequency: 'monthly', requiresProof: true },
    { code: 'US-LFS-EAP', name: 'Employee Assistance Program', nameEn: 'Employee Assistance Program', category: 'lifestyle', benefitType: 'subscription', amount: null, maxAmount: null, frequency: 'monthly', requiresProof: false },
  ]

  for (let i = 0; i < benefitPlansUS.length; i++) {
    const bp = benefitPlansUS[i]
    const id = deterministicUUID('benefit-plan', `CTR-US:${bp.code}`)
    await prisma.benefitPlan.upsert({
      where: { id },
      update: { name: bp.name, isActive: true },
      create: {
        id,
        companyId: ctrUsId,
        code: bp.code,
        name: bp.name,
        nameEn: bp.nameEn,
        category: bp.category,
        benefitType: bp.benefitType,
        amount: bp.amount,
        maxAmount: bp.maxAmount,
        currency: 'USD',
        frequency: bp.frequency,
        requiresApproval: true,
        requiresProof: bp.requiresProof,
        isActive: true,
        displayOrder: i,
      },
    })
    bpCount++
  }

  // 나머지 법인 (CN/RU/VN/MX) — 글로벌 기본 2개씩
  const otherCompanies = ['CTR-CN', 'CTR-RU', 'CTR-VN', 'CTR-MX']
  const globalBasePlans = [
    { code: 'GLOBAL-HLT-CHECKUP', name: '건강검진', nameEn: 'Health Checkup', category: 'health', benefitType: 'reimbursement', maxAmount: 500 },
    { code: 'GLOBAL-FAM-OBT', name: '경조금', nameEn: 'Condolence/Celebration', category: 'family', benefitType: 'fixed_amount', maxAmount: 300 },
  ]
  for (const compCode of otherCompanies) {
    const compId = companyMap[compCode]
    if (!compId) continue
    for (let i = 0; i < globalBasePlans.length; i++) {
      const bp = globalBasePlans[i]
      const id = deterministicUUID('benefit-plan', `${compCode}:${bp.code}`)
      await prisma.benefitPlan.upsert({
        where: { id },
        update: {},
        create: {
          id,
          companyId: compId,
          code: bp.code,
          name: bp.name,
          nameEn: bp.nameEn,
          category: bp.category,
          benefitType: bp.benefitType,
          maxAmount: bp.maxAmount,
          currency: 'USD',
          frequency: 'per_event',
          requiresApproval: true,
          requiresProof: false,
          isActive: true,
          displayOrder: i,
        },
      })
      bpCount++
    }
  }

  console.log(`  ✅ ${bpCount} benefit plans`)

  // ----------------------------------------------------------
  // STEP 28: Seed BenefitBudgets 2025 (B9-2)
  // ----------------------------------------------------------
  console.log('📌 Seeding benefit budgets...')

  const krBudgets = [
    { category: 'family', totalBudget: 20000000 },
    { category: 'education', totalBudget: 15000000 },
    { category: 'health', totalBudget: 10000000 },
    { category: 'lifestyle', totalBudget: 5000000 },
  ]
  const usBudgets = [
    { category: 'financial', totalBudget: 50000 },
    { category: 'health', totalBudget: 30000 },
    { category: 'lifestyle', totalBudget: 10000 },
  ]

  let budgetCount = 0
  for (const b of krBudgets) {
    const id = deterministicUUID('benefit-budget', `CTR-KR:2025:${b.category}`)
    await prisma.benefitBudget.upsert({
      where: { companyId_year_category: { companyId: ctrKrId, year: 2025, category: b.category } },
      update: { totalBudget: b.totalBudget },
      create: { id, companyId: ctrKrId, year: 2025, category: b.category, totalBudget: b.totalBudget, usedAmount: 0 },
    })
    budgetCount++
  }
  for (const b of usBudgets) {
    const id = deterministicUUID('benefit-budget', `CTR-US:2025:${b.category}`)
    await prisma.benefitBudget.upsert({
      where: { companyId_year_category: { companyId: ctrUsId, year: 2025, category: b.category } },
      update: { totalBudget: b.totalBudget },
      create: { id, companyId: ctrUsId, year: 2025, category: b.category, totalBudget: b.totalBudget, usedAmount: 0 },
    })
    budgetCount++
  }

  console.log(`  ✅ ${budgetCount} benefit budgets (2025)`)
  console.log('========================================\n')

  // ─────────────────────────────────────────────────────────
  // SESSION 1: New Employee Expansion (KR +70, CN +18)
  // ─────────────────────────────────────────────────────────
  await seedNewEmployees(prisma)

  // ─────────────────────────────────────────────────────────
  // SESSION 2: Attendance + Leave (2025-09 ~ 2026-02)
  // ─────────────────────────────────────────────────────────
  await seedAttendance(prisma)
  await seedLeave(prisma)

  // ─────────────────────────────────────────────────────────
  // SESSION 3: Performance + Payroll
  // ─────────────────────────────────────────────────────────
  await seedPerformance(prisma)
  await seedPayroll(prisma)

  // ─────────────────────────────────────────────────────────
  // SESSION 4: Lifecycle + Notifications
  // ─────────────────────────────────────────────────────────
  await seedLifecycle(prisma)
  await seedNotifications(prisma)

  // ─────────────────────────────────────────────────────────
  // QA FIXES: Fill missing data (recent attendance, payslips, etc.)
  // ─────────────────────────────────────────────────────────
  await seedQAFixes(prisma)

  // ─────────────────────────────────────────────────────────
  // SESSION A: Recruitment + Compensation + Benefits
  // ─────────────────────────────────────────────────────────
  await seedRecruitment(prisma)
  await seedCompensation(prisma)
  await seedBenefits(prisma)

  // ─────────────────────────────────────────────────────────
  // SESSION B: Year-End + Succession + Peer-Review + Partial Fixes
  // ─────────────────────────────────────────────────────────
  await seedYearEnd(prisma)
  await seedSuccession(prisma)
  await seedPeerReview(prisma)
  await seedPartialFixes(prisma)

  // ─────────────────────────────────────────────────────────
  // SESSION GP#3: Payroll Pipeline QA Data (expanded)
  // ─────────────────────────────────────────────────────────
  await seedPayrollPipeline(prisma)

  // ─────────────────────────────────────────────────────────
  // SESSION GP#4: Performance Pipeline Foundation
  // ─────────────────────────────────────────────────────────
  await seedPerformancePipeline(prisma)

  // ─────────────────────────────────────────────────────────
  // SESSION GP#4-C: Peer Review Seed
  // ─────────────────────────────────────────────────────────
  await seedGP4PeerReview(prisma)

  // ─────────────────────────────────────────────────────────
  // SESSION GP#4-D1: Compensation Review Seed
  // ─────────────────────────────────────────────────────────
  await seedGP4CompReview(prisma)

  // E-2: Offboarding instances + exit interviews + asset returns
  await seedOffboardingInstances(prisma)

  // E-3: Crossboarding TRANSFER templates
  await seedCrossboarding(prisma)

  // F-2: Delegation system
  await seedDelegation(prisma)

  // F-3: Leave enhancement test data
  await seedLeaveEnhancement(prisma)

  // H-2c: Process settings defaults (payroll/attendance/performance/system)
  await seedProcessSettings(prisma)

  // QF-Final: Skills + Training + Pulse Survey + Cross-module test states
  await seedQASkillsTrainingPulse(prisma)

  // Discipline & Rewards
  await seedDiscipline(prisma)

  // Gap fills: Performance (skills 2026-H1, cycles FINALIZED/COMP_REVIEW, enrollments)
  await seedPerformanceGaps(prisma)

  // Gap fills: Compliance (GDPR DSAR/retention/DPIA, CN social insurance, KR severance)
  await seedComplianceGaps(prisma)

  // Gap fills: Payroll & Other (bank transfers, HR docs, recruitment costs, approval flows)
  await seedPayrollOtherGaps(prisma)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
