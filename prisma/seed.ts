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
  { code: 'CTR-HQ', name: 'CTR Holdings', nameEn: 'CTR Holdings', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: null },
  { code: 'CTR-KR', name: 'CTR', nameEn: 'CTR', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: 'CTR-HQ' },
  { code: 'CTR-MOB', name: 'CTR Mobility', nameEn: 'CTR Mobility', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: 'CTR-HQ' },
  { code: 'CTR-ECO', name: 'CTR Ecoforging', nameEn: 'CTR Ecoforging', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: 'CTR-HQ' },
  { code: 'CTR-ROB', name: 'CTR Robotics', nameEn: 'CTR Robotics', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: 'CTR-HQ' },
  { code: 'CTR-ENG', name: 'CTR Energy', nameEn: 'CTR Energy', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: 'CTR-HQ' },
  { code: 'FML', name: 'Formationlabs', nameEn: 'Formationlabs', countryCode: 'KR', timezone: 'Asia/Seoul', locale: 'ko', currency: 'KRW', parentCode: 'CTR-HQ' },
  { code: 'CTR-US', name: 'CTR America', nameEn: 'CTR America', countryCode: 'US', timezone: 'America/Chicago', locale: 'en', currency: 'USD', parentCode: 'CTR-KR' },
  { code: 'CTR-CN', name: 'CTR China', nameEn: 'CTR China', countryCode: 'CN', timezone: 'Asia/Shanghai', locale: 'zh', currency: 'CNY', parentCode: 'CTR-KR' },
  { code: 'CTR-RU', name: 'CTR Russia', nameEn: 'CTR Russia', countryCode: 'RU', timezone: 'Europe/Moscow', locale: 'ru', currency: 'RUB', parentCode: 'CTR-KR' },
  { code: 'CTR-VN', name: 'CTR Vietnam', nameEn: 'CTR Vietnam', countryCode: 'VN', timezone: 'Asia/Ho_Chi_Minh', locale: 'vi', currency: 'VND', parentCode: 'CTR-KR' },
  { code: 'CTR-EU', name: 'CTR Europe', nameEn: 'CTR Europe', countryCode: 'PL', timezone: 'Europe/Warsaw', locale: 'en', currency: 'PLN', parentCode: 'CTR-KR' },
  { code: 'CTR-MX', name: 'CTR Mexico', nameEn: 'CTR Mexico', countryCode: 'MX', timezone: 'America/Mexico_City', locale: 'es', currency: 'MXN', parentCode: 'CTR-KR' },
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
// 3. PERMISSIONS (11 modules × 6 actions = 66)
// ================================================================
const modules = [
  'employees', 'org', 'attendance', 'leave', 'recruitment',
  'performance', 'payroll', 'compensation', 'offboarding', 'discipline', 'benefits',
]
const actions = ['create', 'read', 'update', 'delete', 'export', 'manage']

// ================================================================
// 4. ROLE-PERMISSION MAPPING
// ================================================================
type PermKey = `${string}_${string}`

function buildRolePermissions(): Record<string, PermKey[]> {
  const all: PermKey[] = modules.flatMap(m => actions.map(a => `${m}_${a}` as PermKey))

  // HR_ADMIN: everything except payroll write (only read/export)
  const hrAdmin = all.filter(p => {
    if (p.startsWith('payroll_') && !['payroll_read', 'payroll_export'].includes(p)) return false
    return true
  })

  // MANAGER: team scoped
  const manager: PermKey[] = [
    'employees_read', 'attendance_read', 'leave_read', 'leave_update',
    'performance_read', 'performance_update', 'discipline_read',
  ]

  // EMPLOYEE: self scoped
  const employee: PermKey[] = [
    'employees_read', 'attendance_read', 'attendance_create',
    'leave_read', 'leave_create', 'performance_read', 'performance_create',
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
      update: { name: c.name, nameEn: c.nameEn, countryCode: c.countryCode, timezone: c.timezone, locale: c.locale, currency: c.currency },
      create: { id, code: c.code, name: c.name, nameEn: c.nameEn, countryCode: c.countryCode, timezone: c.timezone, locale: c.locale, currency: c.currency },
    })
    companyMap[c.code] = company.id
  }

  // Second pass: children
  for (const c of companyData.filter(c => c.parentCode !== null)) {
    const id = deterministicUUID('company', c.code)
    const parentId = companyMap[c.parentCode!]
    const company = await prisma.company.upsert({
      where: { code: c.code },
      update: { name: c.name, nameEn: c.nameEn, countryCode: c.countryCode, timezone: c.timezone, locale: c.locale, currency: c.currency, parentCompanyId: parentId },
      create: { id, code: c.code, name: c.name, nameEn: c.nameEn, countryCode: c.countryCode, timezone: c.timezone, locale: c.locale, currency: c.currency, parentCompanyId: parentId },
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
    'employee@ctr.co.kr': { deptCode: 'SALES', gradeCode: 'G6', catCode: 'OFFICE' },
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

    // Create / upsert employee
    const emp = await prisma.employee.upsert({
      where: { employeeNo: acc.employeeNo },
      update: {
        name: acc.name,
        nameEn: acc.nameEn,
        email: acc.email,
        status: 'ACTIVE',
        employmentType: 'FULL_TIME',
      },
      create: {
        id: empId,
        companyId: compId,
        departmentId: deptId,
        jobGradeId: gradeId,
        jobCategoryId: catId,
        employeeNo: acc.employeeNo,
        name: acc.name,
        nameEn: acc.nameEn,
        email: acc.email,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        hireDate: new Date('2024-01-01'),
      },
    })
    employeeMap[acc.email] = emp.id

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
  console.log('========================================\n')
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
