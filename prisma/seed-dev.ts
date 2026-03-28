/**
 * CTR HR Hub v3.2 — Dev Seed (테스트용 트랜잭션 데이터)
 * 대상: CTR-KR (한국) + CTR-CN (중국)
 * 전제: npx prisma db seed (마스터 시드) 실행 완료 후 실행
 * Usage: npm run seed:dev
 * Idempotent: deterministicUUID + upsert 기반
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set. Check .env.local or .env')

const adapter = new PrismaPg({ connectionString: DATABASE_URL })
const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

// ================================================================
// 유틸리티
// ================================================================

function deterministicUUID(namespace: string, key: string): string {
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

function pseudoRandom(seed: number): number {
  return ((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysLater(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(0, 0, 0, 0)
  return d
}

function dateOnly(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

const TEST_PASSWORD_HASH = '$2b$10$dummyHashForSeedOnlyNotRealBcryptHashValue000000000000'

// ================================================================
// STEP 1: DB에서 마스터 데이터 조회
// ================================================================

async function loadMasterData() {
  // 법인 ID
  const companies = await prisma.company.findMany({ select: { id: true, code: true } })
  const companyMap: Record<string, string> = {}
  companies.forEach(c => { companyMap[c.code] = c.id })

  const krId = companyMap['CTR-KR']
  const cnId = companyMap['CTR-CN']
  if (!krId) throw new Error('CTR-KR company not found. Run prisma db seed first.')
  if (!cnId) throw new Error('CTR-CN company not found. Run prisma db seed first.')

  // 역할
  const roles = await prisma.role.findMany({ select: { id: true, code: true } })
  const roleMap: Record<string, string> = {}
  roles.forEach(r => { roleMap[r.code] = r.id })

  // 직급 (CTR-KR)
  const grades = await prisma.jobGrade.findMany({
    where: { companyId: krId },
    select: { id: true, code: true }
  })
  const gradeMap: Record<string, string> = {}
  grades.forEach(g => { gradeMap[g.code] = g.id })

  // 직종
  const jobCats = await prisma.jobCategory.findMany({
    where: { companyId: krId },
    select: { id: true, code: true }
  })
  const jobCatMap: Record<string, string> = {}
  jobCats.forEach(j => { jobCatMap[j.code] = j.id })

  // CTR-CN 직급
  const cnGrades = await prisma.jobGrade.findMany({
    where: { companyId: cnId },
    select: { id: true, code: true }
  })
  const cnGradeMap: Record<string, string> = {}
  cnGrades.forEach(g => { cnGradeMap[g.code] = g.id })

  // CTR-CN 직종
  const cnJobCats = await prisma.jobCategory.findMany({
    where: { companyId: cnId },
    select: { id: true, code: true }
  })
  const cnJobCatMap: Record<string, string> = {}
  cnJobCats.forEach(j => { cnJobCatMap[j.code] = j.id })

  // 기존 부서 (CTR-KR)
  const krDepts = await prisma.department.findMany({
    where: { companyId: krId },
    select: { id: true, code: true }
  })
  const krDeptMap: Record<string, string> = {}
  krDepts.forEach(d => { krDeptMap[d.code] = d.id })

  // 기존 부서 (CTR-CN)
  const cnDepts = await prisma.department.findMany({
    where: { companyId: cnId },
    select: { id: true, code: true }
  })
  const cnDeptMap: Record<string, string> = {}
  cnDepts.forEach(d => { cnDeptMap[d.code] = d.id })

  return { krId, cnId, companyMap, roleMap, gradeMap, jobCatMap, cnGradeMap, cnJobCatMap, krDeptMap, cnDeptMap }
}

// ================================================================
// STEP 2: CTR-KR 부서 계층 구조 구성
// ================================================================

async function seedKrDepartments(krId: string, krDeptMap: Record<string, string>) {
  console.log('  📂 CTR-KR 부서 계층 구성...')

  // L1 사업본부 생성 (upsert)
  const l1Depts = [
    { code: 'MFG_HQ', name: '생산사업본부', nameEn: 'Manufacturing Division', sortOrder: 1 },
    { code: 'TECH_HQ', name: '기술연구본부', nameEn: 'Technology & R&D Division', sortOrder: 2 },
    { code: 'SALES_HQ', name: '영업마케팅본부', nameEn: 'Sales & Marketing Division', sortOrder: 3 },
  ]
  for (const d of l1Depts) {
    const id = deterministicUUID('dept-kr', d.code)
    await prisma.department.upsert({
      where: { companyId_code: { companyId: krId, code: d.code } },
      update: { name: d.name, nameEn: d.nameEn, level: 1, sortOrder: d.sortOrder },
      create: { id, companyId: krId, code: d.code, name: d.name, nameEn: d.nameEn, level: 1, sortOrder: d.sortOrder },
    })
    krDeptMap[d.code] = id
  }

  // MGMT 본부가 없으면 생성 (보통 seed.ts에서 생성됨)
  if (!krDeptMap['MGMT']) {
    const id = deterministicUUID('dept-kr', 'MGMT')
    await prisma.department.upsert({
      where: { companyId_code: { companyId: krId, code: 'MGMT' } },
      update: { name: '경영지원본부', level: 1, sortOrder: 0 },
      create: { id, companyId: krId, code: 'MGMT', name: '경영지원본부', nameEn: 'Management Support Division', level: 1, sortOrder: 0 },
    })
    krDeptMap['MGMT'] = id
  }

  // 기존 L2 팀들에 parentId 설정
  const parentMapping: Record<string, string> = {
    HR: 'MGMT',
    FIN: 'MGMT',
    MFG: 'MFG_HQ',
    QA: 'MFG_HQ',
    PUR: 'MFG_HQ',
    RANDD: 'TECH_HQ',
    DEV: 'TECH_HQ',
    SALES: 'SALES_HQ',
  }
  for (const [childCode, parentCode] of Object.entries(parentMapping)) {
    if (krDeptMap[childCode] && krDeptMap[parentCode]) {
      await prisma.department.update({
        where: { id: krDeptMap[childCode] },
        data: { parentId: krDeptMap[parentCode], level: 2 },
      })
    }
  }

  // 신규 L2 팀 생성
  const newL2 = [
    { code: 'LEGAL', name: '법무팀', nameEn: 'Legal Team', parentCode: 'MGMT', sortOrder: 3 },
    { code: 'MKT', name: '마케팅팀', nameEn: 'Marketing Team', parentCode: 'SALES_HQ', sortOrder: 2 },
    { code: 'IT', name: 'IT팀', nameEn: 'IT Team', parentCode: 'TECH_HQ', sortOrder: 3 },
  ]
  for (const d of newL2) {
    const id = deterministicUUID('dept-kr', d.code)
    await prisma.department.upsert({
      where: { companyId_code: { companyId: krId, code: d.code } },
      update: { name: d.name, nameEn: d.nameEn, level: 2, sortOrder: d.sortOrder, parentId: krDeptMap[d.parentCode] },
      create: { id, companyId: krId, code: d.code, name: d.name, nameEn: d.nameEn, level: 2, sortOrder: d.sortOrder, parentId: krDeptMap[d.parentCode] },
    })
    krDeptMap[d.code] = id
  }

  console.log(`  ✅ CTR-KR 부서 계층: ${Object.keys(krDeptMap).length}개`)
  return krDeptMap
}

// ================================================================
// STEP 3: CTR-CN 부서 계층 구조
// ================================================================

async function seedCnDepartments(cnId: string, cnDeptMap: Record<string, string>) {
  console.log('  📂 CTR-CN 부서 계층 구성...')

  // L1 본부
  const l1 = [
    { code: 'CN_MFG_HQ', name: '生产本部', nameEn: 'Manufacturing Division', sortOrder: 1 },
    { code: 'CN_MGMT_HQ', name: '经营支援本部', nameEn: 'Management Support Division', sortOrder: 2 },
  ]
  for (const d of l1) {
    const id = deterministicUUID('dept-cn', d.code)
    await prisma.department.upsert({
      where: { companyId_code: { companyId: cnId, code: d.code } },
      update: { name: d.name, nameEn: d.nameEn, level: 1, sortOrder: d.sortOrder },
      create: { id, companyId: cnId, code: d.code, name: d.name, nameEn: d.nameEn, level: 1, sortOrder: d.sortOrder },
    })
    cnDeptMap[d.code] = id
  }

  // L2 팀
  const l2 = [
    { code: 'CN_MFG', name: '生产팀', nameEn: 'Manufacturing Team', parentCode: 'CN_MFG_HQ', sortOrder: 1 },
    { code: 'CN_QA', name: '品质팀', nameEn: 'QA Team', parentCode: 'CN_MFG_HQ', sortOrder: 2 },
    { code: 'CN_HR', name: '人事行政팀', nameEn: 'HR & Admin Team', parentCode: 'CN_MGMT_HQ', sortOrder: 1 },
    { code: 'CN_FIN', name: '财务팀', nameEn: 'Finance Team', parentCode: 'CN_MGMT_HQ', sortOrder: 2 },
    { code: 'CN_TECH', name: '技术팀', nameEn: 'Technology Team', parentCode: 'CN_MFG_HQ', sortOrder: 3 },
  ]
  for (const d of l2) {
    const id = deterministicUUID('dept-cn', d.code)
    await prisma.department.upsert({
      where: { companyId_code: { companyId: cnId, code: d.code } },
      update: { name: d.name, nameEn: d.nameEn, level: 2, sortOrder: d.sortOrder, parentId: cnDeptMap[d.parentCode] },
      create: { id, companyId: cnId, code: d.code, name: d.name, nameEn: d.nameEn, level: 2, sortOrder: d.sortOrder, parentId: cnDeptMap[d.parentCode] },
    })
    cnDeptMap[d.code] = id
  }

  console.log(`  ✅ CTR-CN 부서: ${Object.keys(cnDeptMap).length}개`)
  return cnDeptMap
}

// ================================================================
// STEP 4: CTR-KR 직원 40명
// ================================================================

interface EmpDef {
  no: string
  name: string
  nameEn: string
  email: string
  dept: string
  grade: string
  cat: string
  hireDate: Date
  role: 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE'
  phone?: string
  birthDate?: Date
  gender?: 'M' | 'F'
}

const KR_EMPLOYEES: EmpDef[] = [
  // 경영지원본부
  { no: 'EMP-KR-001', name: '김대표', nameEn: 'Kim Daepyo', email: 'ceo.kim@ctr.co.kr', dept: 'MGMT', grade: 'G1', cat: 'MANAGEMENT', hireDate: dateOnly(2015, 3, 2), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0001' },
  { no: 'EMP-KR-002', name: '박부장', nameEn: 'Park Bujang', email: 'park.bj@ctr.co.kr', dept: 'MGMT', grade: 'G2', cat: 'OFFICE', hireDate: dateOnly(2017, 5, 10), role: 'MANAGER', gender: 'M', phone: '010-1001-0002' },

  // HR팀 (기존 hr@ctr.co.kr는 유지)
  { no: 'EMP-KR-003', name: '최인사', nameEn: 'Choi Insa', email: 'choi.hr@ctr.co.kr', dept: 'HR', grade: 'G5', cat: 'OFFICE', hireDate: dateOnly(2021, 3, 15), role: 'EMPLOYEE', gender: 'F', phone: '010-1001-0003' },
  { no: 'EMP-KR-004', name: '정사원', nameEn: 'Jung Sawon', email: 'jung.hr@ctr.co.kr', dept: 'HR', grade: 'G6', cat: 'OFFICE', hireDate: dateOnly(2024, 2, 5), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0004' },

  // 재무팀
  { no: 'EMP-KR-005', name: '이재무', nameEn: 'Lee Jaemu', email: 'lee.fin@ctr.co.kr', dept: 'FIN', grade: 'G3', cat: 'OFFICE', hireDate: dateOnly(2018, 7, 1), role: 'MANAGER', gender: 'M', phone: '010-1001-0005' },
  { no: 'EMP-KR-006', name: '한과장', nameEn: 'Han Gwajang', email: 'han.fin@ctr.co.kr', dept: 'FIN', grade: 'G4', cat: 'OFFICE', hireDate: dateOnly(2020, 1, 6), role: 'EMPLOYEE', gender: 'F', phone: '010-1001-0006' },
  { no: 'EMP-KR-007', name: '윤대리', nameEn: 'Yoon Daeri', email: 'yoon.fin@ctr.co.kr', dept: 'FIN', grade: 'G5', cat: 'OFFICE', hireDate: dateOnly(2022, 4, 4), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0007' },
  { no: 'EMP-KR-008', name: '장신입', nameEn: 'Jang Sinip', email: 'jang.fin@ctr.co.kr', dept: 'FIN', grade: 'G6', cat: 'OFFICE', hireDate: dateOnly(2024, 2, 26), role: 'EMPLOYEE', gender: 'F', phone: '010-1001-0008' },

  // 법무팀
  { no: 'EMP-KR-009', name: '노법무', nameEn: 'Noh Beopmu', email: 'noh.legal@ctr.co.kr', dept: 'LEGAL', grade: 'G3', cat: 'OFFICE', hireDate: dateOnly(2019, 6, 3), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0009' },
  { no: 'EMP-KR-010', name: '강주임', nameEn: 'Kang Juim', email: 'kang.legal@ctr.co.kr', dept: 'LEGAL', grade: 'G6', cat: 'OFFICE', hireDate: dateOnly(2023, 8, 1), role: 'EMPLOYEE', gender: 'F', phone: '010-1001-0010' },

  // 생산사업본부
  { no: 'EMP-KR-011', name: '오생산', nameEn: 'Oh Saengsan', email: 'oh.mfg@ctr.co.kr', dept: 'MFG_HQ', grade: 'G2', cat: 'MANAGEMENT', hireDate: dateOnly(2016, 9, 1), role: 'MANAGER', gender: 'M', phone: '010-1001-0011' },

  // 생산팀 (생산직)
  { no: 'EMP-KR-012', name: '임차장', nameEn: 'Im Chajang', email: 'im.mfg@ctr.co.kr', dept: 'MFG', grade: 'G3', cat: 'PRODUCTION', hireDate: dateOnly(2017, 3, 6), role: 'MANAGER', gender: 'M', phone: '010-1001-0012' },
  { no: 'EMP-KR-013', name: '서과장', nameEn: 'Seo Gwajang', email: 'seo.mfg@ctr.co.kr', dept: 'MFG', grade: 'G4', cat: 'PRODUCTION', hireDate: dateOnly(2019, 7, 15), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0013' },
  { no: 'EMP-KR-014', name: '권과장', nameEn: 'Kwon Gwajang', email: 'kwon.mfg@ctr.co.kr', dept: 'MFG', grade: 'G4', cat: 'PRODUCTION', hireDate: dateOnly(2020, 2, 10), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0014' },
  { no: 'EMP-KR-015', name: '황대리', nameEn: 'Hwang Daeri', email: 'hwang.mfg@ctr.co.kr', dept: 'MFG', grade: 'G5', cat: 'PRODUCTION', hireDate: dateOnly(2021, 11, 1), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0015' },
  { no: 'EMP-KR-016', name: '문대리', nameEn: 'Moon Daeri', email: 'moon.mfg@ctr.co.kr', dept: 'MFG', grade: 'G5', cat: 'PRODUCTION', hireDate: dateOnly(2022, 3, 7), role: 'EMPLOYEE', gender: 'F', phone: '010-1001-0016' },
  { no: 'EMP-KR-017', name: '배대리', nameEn: 'Bae Daeri', email: 'bae.mfg@ctr.co.kr', dept: 'MFG', grade: 'G5', cat: 'PRODUCTION', hireDate: dateOnly(2022, 9, 5), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0017' },
  { no: 'EMP-KR-018', name: '안사원', nameEn: 'Ahn Sawon', email: 'ahn.mfg@ctr.co.kr', dept: 'MFG', grade: 'G6', cat: 'PRODUCTION', hireDate: dateOnly(2023, 3, 2), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0018' },
  { no: 'EMP-KR-019', name: '전사원', nameEn: 'Jeon Sawon', email: 'jeon.mfg@ctr.co.kr', dept: 'MFG', grade: 'G6', cat: 'PRODUCTION', hireDate: dateOnly(2023, 8, 14), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0019' },
  { no: 'EMP-KR-020', name: '곽신입', nameEn: 'Gwak Sinip', email: 'gwak.mfg@ctr.co.kr', dept: 'MFG', grade: 'G6', cat: 'PRODUCTION', hireDate: dateOnly(2024, 3, 4), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0020' },

  // 품질관리팀
  { no: 'EMP-KR-021', name: '조품질', nameEn: 'Cho Pumjil', email: 'cho.qa@ctr.co.kr', dept: 'QA', grade: 'G4', cat: 'PRODUCTION', hireDate: dateOnly(2019, 4, 8), role: 'MANAGER', gender: 'F', phone: '010-1001-0021' },
  { no: 'EMP-KR-022', name: '유대리', nameEn: 'Yu Daeri', email: 'yu.qa@ctr.co.kr', dept: 'QA', grade: 'G5', cat: 'PRODUCTION', hireDate: dateOnly(2021, 6, 14), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0022' },
  { no: 'EMP-KR-023', name: '류사원', nameEn: 'Ryu Sawon', email: 'ryu.qa@ctr.co.kr', dept: 'QA', grade: 'G6', cat: 'PRODUCTION', hireDate: dateOnly(2023, 2, 20), role: 'EMPLOYEE', gender: 'F', phone: '010-1001-0023' },

  // 기술연구본부
  { no: 'EMP-KR-024', name: '신기술', nameEn: 'Shin Gisul', email: 'shin.tech@ctr.co.kr', dept: 'TECH_HQ', grade: 'G2', cat: 'MANAGEMENT', hireDate: dateOnly(2016, 1, 4), role: 'MANAGER', gender: 'M', phone: '010-1001-0024' },

  // 연구개발팀
  { no: 'EMP-KR-025', name: '고연구', nameEn: 'Ko Yeongu', email: 'ko.rd@ctr.co.kr', dept: 'RANDD', grade: 'G3', cat: 'R_AND_D', hireDate: dateOnly(2018, 5, 7), role: 'MANAGER', gender: 'M', phone: '010-1001-0025' },
  { no: 'EMP-KR-026', name: '홍과장', nameEn: 'Hong Gwajang', email: 'hong.rd@ctr.co.kr', dept: 'RANDD', grade: 'G4', cat: 'R_AND_D', hireDate: dateOnly(2020, 8, 3), role: 'EMPLOYEE', gender: 'F', phone: '010-1001-0026' },
  { no: 'EMP-KR-027', name: '남대리', nameEn: 'Nam Daeri', email: 'nam.rd@ctr.co.kr', dept: 'RANDD', grade: 'G5', cat: 'R_AND_D', hireDate: dateOnly(2022, 7, 4), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0027' },
  { no: 'EMP-KR-028', name: '심사원', nameEn: 'Sim Sawon', email: 'sim.rd@ctr.co.kr', dept: 'RANDD', grade: 'G6', cat: 'R_AND_D', hireDate: dateOnly(2024, 2, 26), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0028' },

  // 개발팀 (기존 manager@ctr.co.kr이 DEV 소속)
  { no: 'EMP-KR-029', name: '하과장', nameEn: 'Ha Gwajang', email: 'ha.dev@ctr.co.kr', dept: 'DEV', grade: 'G4', cat: 'R_AND_D', hireDate: dateOnly(2020, 11, 2), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0029' },
  { no: 'EMP-KR-030', name: '선대리', nameEn: 'Sun Daeri', email: 'sun.dev@ctr.co.kr', dept: 'DEV', grade: 'G5', cat: 'R_AND_D', hireDate: dateOnly(2022, 5, 16), role: 'EMPLOYEE', gender: 'F', phone: '010-1001-0030' },

  // 영업마케팅본부
  { no: 'EMP-KR-031', name: '방영업', nameEn: 'Bang Yeongup', email: 'bang.sales@ctr.co.kr', dept: 'SALES_HQ', grade: 'G2', cat: 'MANAGEMENT', hireDate: dateOnly(2015, 9, 7), role: 'MANAGER', gender: 'M', phone: '010-1001-0031' },

  // 영업팀 (기존 employee@ctr.co.kr은 SALES 소속)
  { no: 'EMP-KR-032', name: '복과장', nameEn: 'Bok Gwajang', email: 'bok.sales@ctr.co.kr', dept: 'SALES', grade: 'G4', cat: 'OFFICE', hireDate: dateOnly(2019, 10, 14), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0032' },
  { no: 'EMP-KR-033', name: '탁과장', nameEn: 'Tak Gwajang', email: 'tak.sales@ctr.co.kr', dept: 'SALES', grade: 'G4', cat: 'OFFICE', hireDate: dateOnly(2020, 6, 1), role: 'EMPLOYEE', gender: 'F', phone: '010-1001-0033' },
  { no: 'EMP-KR-034', name: '도대리', nameEn: 'Do Daeri', email: 'do.sales@ctr.co.kr', dept: 'SALES', grade: 'G5', cat: 'OFFICE', hireDate: dateOnly(2022, 1, 10), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0034' },
  { no: 'EMP-KR-035', name: '길사원', nameEn: 'Gil Sawon', email: 'gil.sales@ctr.co.kr', dept: 'SALES', grade: 'G6', cat: 'OFFICE', hireDate: dateOnly(2023, 5, 22), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0035' },

  // 마케팅팀
  { no: 'EMP-KR-036', name: '표마케팅', nameEn: 'Pyo Marketing', email: 'pyo.mkt@ctr.co.kr', dept: 'MKT', grade: 'G4', cat: 'OFFICE', hireDate: dateOnly(2020, 3, 2), role: 'MANAGER', gender: 'F', phone: '010-1001-0036' },
  { no: 'EMP-KR-037', name: '구대리', nameEn: 'Gu Daeri', email: 'gu.mkt@ctr.co.kr', dept: 'MKT', grade: 'G5', cat: 'OFFICE', hireDate: dateOnly(2022, 8, 22), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0037' },

  // 구매조달팀
  { no: 'EMP-KR-038', name: '마구매', nameEn: 'Ma Gumat', email: 'ma.pur@ctr.co.kr', dept: 'PUR', grade: 'G4', cat: 'OFFICE', hireDate: dateOnly(2019, 2, 11), role: 'MANAGER', gender: 'M', phone: '010-1001-0038' },
  { no: 'EMP-KR-039', name: '나대리', nameEn: 'Na Daeri', email: 'na.pur@ctr.co.kr', dept: 'PUR', grade: 'G5', cat: 'OFFICE', hireDate: dateOnly(2021, 10, 4), role: 'EMPLOYEE', gender: 'F', phone: '010-1001-0039' },
  { no: 'EMP-KR-040', name: '다사원', nameEn: 'Da Sawon', email: 'da.pur@ctr.co.kr', dept: 'PUR', grade: 'G6', cat: 'OFFICE', hireDate: dateOnly(2023, 12, 4), role: 'EMPLOYEE', gender: 'M', phone: '010-1001-0040' },
]

async function seedKrEmployees(
  krId: string,
  krDeptMap: Record<string, string>,
  gradeMap: Record<string, string>,
  jobCatMap: Record<string, string>,
  roleMap: Record<string, string>
): Promise<Record<string, string>> {
  console.log('  👥 CTR-KR 직원 40명 생성...')
  const empMap: Record<string, string> = {}

  for (const e of KR_EMPLOYEES) {
    const empId = deterministicUUID('employee-kr', e.no)
    const deptId = krDeptMap[e.dept]
    const gradeId = gradeMap[e.grade]
    // cat이 없는 경우 fallback
    const catId = jobCatMap[e.cat] || jobCatMap['OFFICE']

    if (!deptId) {
      console.warn(`    ⚠️  dept ${e.dept} not found for ${e.no}, skip`)
      continue
    }

    const emp = await prisma.employee.upsert({
      where: { employeeNo: e.no },
      update: { name: e.name, nameEn: e.nameEn, email: e.email },
      create: {
        id: empId,
        employeeNo: e.no,
        name: e.name,
        nameEn: e.nameEn,
        email: e.email,
        hireDate: e.hireDate,
        gender: e.gender,
        phone: e.phone,
        birthDate: e.birthDate,
      },
    })
    empMap[e.no] = emp.id

    // EmployeeAssignment (upsert: 이미 있으면 스킵)
    const existing = await prisma.employeeAssignment.findFirst({
      where: { employeeId: emp.id, isPrimary: true, endDate: null },
    })
    if (!existing) {
      await prisma.employeeAssignment.create({
        data: {
          id: deterministicUUID('assign-kr', e.no),
          employeeId: emp.id,
          companyId: krId,
          departmentId: deptId,
          jobGradeId: gradeId || undefined,
          jobCategoryId: catId || undefined,
          effectiveDate: e.hireDate,
          changeType: 'HIRE',
          employmentType: e.cat === 'PRODUCTION' ? 'FULL_TIME' : 'FULL_TIME',
          status: 'ACTIVE',
          isPrimary: true,
        },
      })
    }

    // EmployeeAuth
    await prisma.employeeAuth.upsert({
      where: { employeeId: emp.id },
      update: { passwordHash: TEST_PASSWORD_HASH },
      create: { id: deterministicUUID('auth-kr', e.no), employeeId: emp.id, passwordHash: TEST_PASSWORD_HASH },
    })

    // EmployeeRole
    const roleId = roleMap[e.role] || roleMap['EMPLOYEE']
    await prisma.employeeRole.upsert({
      where: { employeeId_roleId_companyId: { employeeId: emp.id, roleId, companyId: krId } },
      update: {},
      create: {
        id: deterministicUUID('emprole-kr', `${e.no}:${e.role}`),
        employeeId: emp.id,
        roleId,
        companyId: krId,
        startDate: e.hireDate,
      },
    })
  }

  console.log(`  ✅ CTR-KR 직원 ${Object.keys(empMap).length}명`)
  return empMap
}

// ================================================================
// STEP 5: CTR-CN 직원 20명
// ================================================================

const CN_EMPLOYEES: EmpDef[] = [
  // 생산팀
  { no: 'EMP-CN-001', name: '张生产', nameEn: 'Zhang Shengchan', email: 'zhang.mfg@ctr-cn.com', dept: 'CN_MFG', grade: 'G3', cat: 'PRODUCTION', hireDate: dateOnly(2018, 4, 1), role: 'MANAGER', gender: 'M', phone: '138-0001-0001' },
  { no: 'EMP-CN-002', name: '李工人', nameEn: 'Li Gongren', email: 'li.mfg@ctr-cn.com', dept: 'CN_MFG', grade: 'G5', cat: 'PRODUCTION', hireDate: dateOnly(2020, 3, 2), role: 'EMPLOYEE', gender: 'M', phone: '138-0001-0002' },
  { no: 'EMP-CN-003', name: '王制造', nameEn: 'Wang Zhizao', email: 'wang.mfg@ctr-cn.com', dept: 'CN_MFG', grade: 'G5', cat: 'PRODUCTION', hireDate: dateOnly(2021, 6, 7), role: 'EMPLOYEE', gender: 'M', phone: '138-0001-0003' },
  { no: 'EMP-CN-004', name: '赵工作', nameEn: 'Zhao Gongzuo', email: 'zhao.mfg@ctr-cn.com', dept: 'CN_MFG', grade: 'G6', cat: 'PRODUCTION', hireDate: dateOnly(2022, 9, 5), role: 'EMPLOYEE', gender: 'M', phone: '138-0001-0004' },
  { no: 'EMP-CN-005', name: '刘操作', nameEn: 'Liu Caozuo', email: 'liu.mfg@ctr-cn.com', dept: 'CN_MFG', grade: 'G6', cat: 'PRODUCTION', hireDate: dateOnly(2023, 5, 8), role: 'EMPLOYEE', gender: 'F', phone: '138-0001-0005' },
  // 품질팀
  { no: 'EMP-CN-006', name: '陈品质', nameEn: 'Chen Pinzhi', email: 'chen.qa@ctr-cn.com', dept: 'CN_QA', grade: 'G4', cat: 'PRODUCTION', hireDate: dateOnly(2019, 7, 1), role: 'MANAGER', gender: 'F', phone: '138-0001-0006' },
  { no: 'EMP-CN-007', name: '杨质量', nameEn: 'Yang Zhiliang', email: 'yang.qa@ctr-cn.com', dept: 'CN_QA', grade: 'G5', cat: 'PRODUCTION', hireDate: dateOnly(2021, 4, 12), role: 'EMPLOYEE', gender: 'M', phone: '138-0001-0007' },
  { no: 'EMP-CN-008', name: '孙检查', nameEn: 'Sun Jiancha', email: 'sun.qa@ctr-cn.com', dept: 'CN_QA', grade: 'G6', cat: 'PRODUCTION', hireDate: dateOnly(2022, 11, 14), role: 'EMPLOYEE', gender: 'M', phone: '138-0001-0008' },
  // 인사행정팀
  { no: 'EMP-CN-009', name: '周人事', nameEn: 'Zhou Renshi', email: 'zhou.hr@ctr-cn.com', dept: 'CN_HR', grade: 'G4', cat: 'OFFICE', hireDate: dateOnly(2019, 3, 4), role: 'MANAGER', gender: 'F', phone: '138-0001-0009' },
  { no: 'EMP-CN-010', name: '吴行政', nameEn: 'Wu Xingzheng', email: 'wu.hr@ctr-cn.com', dept: 'CN_HR', grade: 'G5', cat: 'OFFICE', hireDate: dateOnly(2021, 9, 13), role: 'EMPLOYEE', gender: 'F', phone: '138-0001-0010' },
  { no: 'EMP-CN-011', name: '郑专员', nameEn: 'Zheng Zhuanyuan', email: 'zheng.hr@ctr-cn.com', dept: 'CN_HR', grade: 'G6', cat: 'OFFICE', hireDate: dateOnly(2023, 3, 6), role: 'EMPLOYEE', gender: 'M', phone: '138-0001-0011' },
  // 재무팀
  { no: 'EMP-CN-012', name: '冯财务', nameEn: 'Feng Caiwu', email: 'feng.fin@ctr-cn.com', dept: 'CN_FIN', grade: 'G4', cat: 'OFFICE', hireDate: dateOnly(2019, 5, 6), role: 'MANAGER', gender: 'M', phone: '138-0001-0012' },
  { no: 'EMP-CN-013', name: '褚会计', nameEn: 'Chu Kuaiji', email: 'chu.fin@ctr-cn.com', dept: 'CN_FIN', grade: 'G5', cat: 'OFFICE', hireDate: dateOnly(2021, 2, 1), role: 'EMPLOYEE', gender: 'F', phone: '138-0001-0013' },
  { no: 'EMP-CN-014', name: '卫出纳', nameEn: 'Wei Chuna', email: 'wei.fin@ctr-cn.com', dept: 'CN_FIN', grade: 'G6', cat: 'OFFICE', hireDate: dateOnly(2023, 7, 17), role: 'EMPLOYEE', gender: 'M', phone: '138-0001-0014' },
  // 기술팀
  { no: 'EMP-CN-015', name: '蒋技术', nameEn: 'Jiang Jishu', email: 'jiang.tech@ctr-cn.com', dept: 'CN_TECH', grade: 'G4', cat: 'R_AND_D', hireDate: dateOnly(2020, 1, 6), role: 'MANAGER', gender: 'M', phone: '138-0001-0015' },
  { no: 'EMP-CN-016', name: '沈工程', nameEn: 'Shen Gongcheng', email: 'shen.tech@ctr-cn.com', dept: 'CN_TECH', grade: 'G5', cat: 'R_AND_D', hireDate: dateOnly(2021, 8, 9), role: 'EMPLOYEE', gender: 'M', phone: '138-0001-0016' },
  { no: 'EMP-CN-017', name: '韩开发', nameEn: 'Han Kaifa', email: 'han.tech@ctr-cn.com', dept: 'CN_TECH', grade: 'G5', cat: 'R_AND_D', hireDate: dateOnly(2022, 4, 11), role: 'EMPLOYEE', gender: 'F', phone: '138-0001-0017' },
  { no: 'EMP-CN-018', name: '杜设计', nameEn: 'Du Sheji', email: 'du.tech@ctr-cn.com', dept: 'CN_TECH', grade: 'G6', cat: 'R_AND_D', hireDate: dateOnly(2023, 10, 16), role: 'EMPLOYEE', gender: 'M', phone: '138-0001-0018' },
  // 경영지원본부 (법인장)
  { no: 'EMP-CN-019', name: '秦总经理', nameEn: 'Qin Zongjingli', email: 'qin.gm@ctr-cn.com', dept: 'CN_MGMT_HQ', grade: 'G1', cat: 'MANAGEMENT', hireDate: dateOnly(2016, 7, 4), role: 'MANAGER', gender: 'M', phone: '138-0001-0019' },
  { no: 'EMP-CN-020', name: '尤助理', nameEn: 'You Zhuli', email: 'you.mgmt@ctr-cn.com', dept: 'CN_MGMT_HQ', grade: 'G4', cat: 'OFFICE', hireDate: dateOnly(2020, 10, 26), role: 'EMPLOYEE', gender: 'F', phone: '138-0001-0020' },
]

async function seedCnEmployees(
  cnId: string,
  cnDeptMap: Record<string, string>,
  cnGradeMap: Record<string, string>,
  cnJobCatMap: Record<string, string>,
  roleMap: Record<string, string>,
  gradeMap: Record<string, string>,
  jobCatMap: Record<string, string>
): Promise<Record<string, string>> {
  console.log('  👥 CTR-CN 직원 20명 생성...')
  const empMap: Record<string, string> = {}

  for (const e of CN_EMPLOYEES) {
    const empId = deterministicUUID('employee-cn', e.no)
    const deptId = cnDeptMap[e.dept]

    // CN 직급/직종이 없으면 KR 것 fallback
    const gradeId = cnGradeMap[e.grade] || gradeMap[e.grade]
    const catId = cnJobCatMap[e.cat] || jobCatMap[e.cat] || jobCatMap['OFFICE']

    if (!deptId) {
      console.warn(`    ⚠️  CN dept ${e.dept} not found for ${e.no}`)
      continue
    }

    const emp = await prisma.employee.upsert({
      where: { employeeNo: e.no },
      update: { name: e.name, nameEn: e.nameEn, email: e.email },
      create: {
        id: empId,
        employeeNo: e.no,
        name: e.name,
        nameEn: e.nameEn,
        email: e.email,
        hireDate: e.hireDate,
        gender: e.gender,
        phone: e.phone,
      },
    })
    empMap[e.no] = emp.id

    const existing = await prisma.employeeAssignment.findFirst({
      where: { employeeId: emp.id, isPrimary: true, endDate: null },
    })
    if (!existing) {
      await prisma.employeeAssignment.create({
        data: {
          id: deterministicUUID('assign-cn', e.no),
          employeeId: emp.id,
          companyId: cnId,
          departmentId: deptId,
          jobGradeId: gradeId || undefined,
          jobCategoryId: catId || undefined,
          effectiveDate: e.hireDate,
          changeType: 'HIRE',
          employmentType: 'FULL_TIME',
          status: 'ACTIVE',
          isPrimary: true,
        },
      })
    }

    await prisma.employeeAuth.upsert({
      where: { employeeId: emp.id },
      update: { passwordHash: TEST_PASSWORD_HASH },
      create: { id: deterministicUUID('auth-cn', e.no), employeeId: emp.id, passwordHash: TEST_PASSWORD_HASH },
    })

    const roleId = roleMap[e.role] || roleMap['EMPLOYEE']
    await prisma.employeeRole.upsert({
      where: { employeeId_roleId_companyId: { employeeId: emp.id, roleId, companyId: cnId } },
      update: {},
      create: {
        id: deterministicUUID('emprole-cn', `${e.no}:${e.role}`),
        employeeId: emp.id,
        roleId,
        companyId: cnId,
        startDate: e.hireDate,
      },
    })
  }

  console.log(`  ✅ CTR-CN 직원 ${Object.keys(empMap).length}명`)
  return empMap
}

// ================================================================
// STEP 6: 중국 공휴일 (2025~2026)
// ================================================================

async function seedCnHolidays(cnId: string) {
  console.log('  🏖  CTR-CN 공휴일 생성...')
  const cnHolidays = [
    // 2025
    { name: '元旦 (신정)', date: dateOnly(2025, 1, 1) },
    { name: '春节 (춘절) 연휴 1일', date: dateOnly(2025, 1, 28) },
    { name: '春节 (춘절)', date: dateOnly(2025, 1, 29) },
    { name: '春节 (춘절) 연휴 2일', date: dateOnly(2025, 1, 30) },
    { name: '春节 (춘절) 연휴 3일', date: dateOnly(2025, 1, 31) },
    { name: '春节 (춘절) 연휴 4일', date: dateOnly(2025, 2, 1) },
    { name: '春节 (춘절) 연휴 5일', date: dateOnly(2025, 2, 2) },
    { name: '春节 (춘절) 연휴 6일', date: dateOnly(2025, 2, 3) },
    { name: '清明节 (청명절)', date: dateOnly(2025, 4, 5) },
    { name: '劳动节 (노동절)', date: dateOnly(2025, 5, 1) },
    { name: '劳动节 (노동절) +1일', date: dateOnly(2025, 5, 2) },
    { name: '劳动节 (노동절) +2일', date: dateOnly(2025, 5, 3) },
    { name: '劳动节 (노동절) +3일', date: dateOnly(2025, 5, 4) },
    { name: '劳动节 (노동절) +4일', date: dateOnly(2025, 5, 5) },
    { name: '端午节 (단오절)', date: dateOnly(2025, 5, 31) },
    { name: '端午节 (단오절) +1일', date: dateOnly(2025, 6, 1) },
    { name: '端午节 (단오절) +2일', date: dateOnly(2025, 6, 2) },
    { name: '中秋节 (중추절)', date: dateOnly(2025, 10, 6) },
    { name: '国庆节 (국경절)', date: dateOnly(2025, 10, 1) },
    { name: '国庆节 +1일', date: dateOnly(2025, 10, 2) },
    { name: '国庆节 +2일', date: dateOnly(2025, 10, 3) },
    { name: '国庆节 +3일', date: dateOnly(2025, 10, 4) },
    { name: '国庆节 +4일', date: dateOnly(2025, 10, 5) },
    { name: '国庆节 +5일', date: dateOnly(2025, 10, 7) },
    // 2026
    { name: '元旦 (신정)', date: dateOnly(2026, 1, 1) },
    { name: '春节 (춘절) 연휴 1일', date: dateOnly(2026, 2, 17) },
    { name: '春节 (춘절)', date: dateOnly(2026, 2, 18) },
    { name: '春节 (춘절) 연휴 2일', date: dateOnly(2026, 2, 19) },
    { name: '春节 (춘절) 연휴 3일', date: dateOnly(2026, 2, 20) },
    { name: '春节 (춘절) 연휴 4일', date: dateOnly(2026, 2, 21) },
    { name: '春节 (춘절) 연휴 5일', date: dateOnly(2026, 2, 22) },
    { name: '春节 (춘절) 연휴 6일', date: dateOnly(2026, 2, 23) },
    { name: '清明节 (청명절)', date: dateOnly(2026, 4, 5) },
    { name: '劳动节 (노동절)', date: dateOnly(2026, 5, 1) },
    { name: '劳动节 +1일', date: dateOnly(2026, 5, 2) },
    { name: '劳动节 +2일', date: dateOnly(2026, 5, 3) },
    { name: '端午节 (단오절)', date: dateOnly(2026, 6, 19) },
    { name: '中秋节 (중추절)', date: dateOnly(2026, 9, 25) },
    { name: '国庆节 (국경절)', date: dateOnly(2026, 10, 1) },
    { name: '国庆节 +1일', date: dateOnly(2026, 10, 2) },
    { name: '国庆节 +2일', date: dateOnly(2026, 10, 3) },
    { name: '国庆节 +3일', date: dateOnly(2026, 10, 4) },
    { name: '国庆节 +4일', date: dateOnly(2026, 10, 5) },
    { name: '国庆节 +5일', date: dateOnly(2026, 10, 6) },
    { name: '国庆节 +6일', date: dateOnly(2026, 10, 7) },
  ]

  let created = 0
  for (const h of cnHolidays) {
    try {
      await prisma.holiday.upsert({
        where: { companyId_date: { companyId: cnId, date: h.date } },
        update: { name: h.name },
        create: {
          id: deterministicUUID('holiday-cn', `${cnId}:${h.date.toISOString()}`),
          companyId: cnId,
          name: h.name,
          date: h.date,
          year: h.date.getFullYear(),
        },
      })
      created++
    } catch (e) {
      // 중복 무시
    }
  }
  console.log(`  ✅ CTR-CN 공휴일 ${created}개`)
}

// ================================================================
// STEP 7: 휴가 정책 + 잔여량 (KR, CN)
// ================================================================

async function seedLeavePolicies(
  krId: string,
  cnId: string,
  krEmpMap: Record<string, string>,
  cnEmpMap: Record<string, string>
) {
  console.log('  🏝  휴가 정책 + 잔여량 생성...')

  // CTR-KR 정책
  const krPolicies = [
    { type: 'ANNUAL', name: '연차휴가', days: 15, isPaid: true, carryOver: true, maxCarry: 5 },
    { type: 'SICK', name: '병가', days: 10, isPaid: false, carryOver: false },
    { type: 'MATERNITY', name: '출산휴가', days: 90, isPaid: true, carryOver: false },
    { type: 'PATERNITY', name: '배우자출산휴가', days: 10, isPaid: true, carryOver: false },
    { type: 'BEREAVEMENT', name: '경조사휴가', days: 5, isPaid: true, carryOver: false },
    { type: 'SPECIAL', name: '특별휴가', days: 3, isPaid: true, carryOver: false },
    { type: 'COMPENSATORY', name: '대체휴가', days: 0, isPaid: true, carryOver: false },
  ]

  const krPolicyMap: Record<string, string> = {}
  for (const p of krPolicies) {
    const id = deterministicUUID('lpolicy-kr', `${krId}:${p.type}`)
    await prisma.leavePolicy.upsert({
      where: { id },
      update: { name: p.name, defaultDays: p.days, isPaid: p.isPaid, carryOverAllowed: p.carryOver },
      create: {
        id,
        companyId: krId,
        name: p.name,
        leaveType: p.type as any,
        defaultDays: p.days,
        isPaid: p.isPaid,
        carryOverAllowed: p.carryOver,
        maxCarryOverDays: (p as any).maxCarry || null,
        isActive: true,
      },
    })
    krPolicyMap[p.type] = id
  }

  // CTR-CN 정책
  const cnPolicies = [
    { type: 'ANNUAL', name: '年假 (연차)', days: 10, isPaid: true, carryOver: true, maxCarry: 5 },
    { type: 'SICK', name: '病假 (병가)', days: 15, isPaid: false, carryOver: false },
    { type: 'MATERNITY', name: '产假 (출산)', days: 98, isPaid: true, carryOver: false },
    { type: 'BEREAVEMENT', name: '丧假 (경조사)', days: 3, isPaid: true, carryOver: false },
    { type: 'SPECIAL', name: '特别假 (특별)', days: 3, isPaid: true, carryOver: false },
  ]

  const cnPolicyMap: Record<string, string> = {}
  for (const p of cnPolicies) {
    const id = deterministicUUID('lpolicy-cn', `${cnId}:${p.type}`)
    await prisma.leavePolicy.upsert({
      where: { id },
      update: { name: p.name, defaultDays: p.days, isPaid: p.isPaid },
      create: {
        id,
        companyId: cnId,
        name: p.name,
        leaveType: p.type as any,
        defaultDays: p.days,
        isPaid: p.isPaid,
        carryOverAllowed: p.carryOver,
        maxCarryOverDays: (p as any).maxCarry || null,
        isActive: true,
      },
    })
    cnPolicyMap[p.type] = id
  }

  // KR 직원 연차 잔여량 (2026년)
  const annualPolicyId = krPolicyMap['ANNUAL']
  const krEmpNos = Object.keys(krEmpMap)
  let balCount = 0
  for (let i = 0; i < krEmpNos.length; i++) {
    const empId = krEmpMap[krEmpNos[i]]
    const usedDays = Math.floor(pseudoRandom(i * 7 + 1) * 8) // 0~7일 사용
    const grantedDays = 15
    const balId = deterministicUUID('lbal-kr', `${empId}:${annualPolicyId}:2026`)
    await prisma.employeeLeaveBalance.upsert({
      where: { employeeId_policyId_year: { employeeId: empId, policyId: annualPolicyId, year: 2026 } },
      update: { usedDays, grantedDays },
      create: {
        id: balId,
        employeeId: empId,
        policyId: annualPolicyId,
        year: 2026,
        grantedDays,
        usedDays,
        pendingDays: 0,
        carryOverDays: Math.floor(pseudoRandom(i * 3) * 5),
      },
    })
    balCount++
  }

  // CN 직원 연차 잔여량
  const cnAnnualId = cnPolicyMap['ANNUAL']
  const cnEmpNos = Object.keys(cnEmpMap)
  for (let i = 0; i < cnEmpNos.length; i++) {
    const empId = cnEmpMap[cnEmpNos[i]]
    const usedDays = Math.floor(pseudoRandom(i * 11 + 3) * 6)
    const balId = deterministicUUID('lbal-cn', `${empId}:${cnAnnualId}:2026`)
    await prisma.employeeLeaveBalance.upsert({
      where: { employeeId_policyId_year: { employeeId: empId, policyId: cnAnnualId, year: 2026 } },
      update: { usedDays, grantedDays: 10 },
      create: {
        id: balId,
        employeeId: empId,
        policyId: cnAnnualId,
        year: 2026,
        grantedDays: 10,
        usedDays,
        pendingDays: 0,
        carryOverDays: 0,
      },
    })
  }

  // KR 휴가 신청 25건
  const hrApprover = Object.values(krEmpMap)[0]
  const krEmpIds = Object.values(krEmpMap)
  const leaveScenarios = [
    // APPROVED - 과거
    { daysFromNow: -60, endOffset: 2, status: 'APPROVED' },
    { daysFromNow: -55, endOffset: 1, status: 'APPROVED' },
    { daysFromNow: -50, endOffset: 3, status: 'APPROVED' },
    { daysFromNow: -45, endOffset: 2, status: 'APPROVED' },
    { daysFromNow: -40, endOffset: 1, status: 'APPROVED' },
    { daysFromNow: -38, endOffset: 2, status: 'APPROVED' },
    { daysFromNow: -30, endOffset: 1, status: 'APPROVED' },
    { daysFromNow: -28, endOffset: 3, status: 'APPROVED' },
    { daysFromNow: -25, endOffset: 2, status: 'APPROVED' },
    { daysFromNow: -20, endOffset: 1, status: 'APPROVED' },
    { daysFromNow: -18, endOffset: 2, status: 'APPROVED' },
    { daysFromNow: -15, endOffset: 1, status: 'APPROVED' },
    { daysFromNow: -12, endOffset: 2, status: 'APPROVED' },
    { daysFromNow: -10, endOffset: 1, status: 'APPROVED' },
    { daysFromNow: -7, endOffset: 3, status: 'APPROVED' },
    // PENDING - 미래
    { daysFromNow: 5, endOffset: 2, status: 'PENDING' },
    { daysFromNow: 10, endOffset: 1, status: 'PENDING' },
    { daysFromNow: 14, endOffset: 3, status: 'PENDING' },
    { daysFromNow: 20, endOffset: 2, status: 'PENDING' },
    { daysFromNow: 25, endOffset: 1, status: 'PENDING' },
    { daysFromNow: 30, endOffset: 5, status: 'PENDING' },
    { daysFromNow: 45, endOffset: 2, status: 'PENDING' },
    // REJECTED
    { daysFromNow: -35, endOffset: 5, status: 'REJECTED' },
    { daysFromNow: -22, endOffset: 3, status: 'REJECTED' },
    { daysFromNow: 15, endOffset: 7, status: 'REJECTED' },
  ]

  for (let i = 0; i < leaveScenarios.length; i++) {
    const s = leaveScenarios[i]
    const empId = krEmpIds[i % krEmpIds.length]
    const startDate = daysFromNow2(s.daysFromNow)
    const endDate = daysFromNow2(s.daysFromNow + s.endOffset)
    const lrId = deterministicUUID('lr-kr', `${i}:${empId}`)
    try {
      await prisma.leaveRequest.upsert({
        where: { id: lrId },
        update: {},
        create: {
          id: lrId,
          employeeId: empId,
          policyId: annualPolicyId,
          companyId: krId,
          startDate,
          endDate,
          days: s.endOffset + 1,
          reason: s.status === 'REJECTED' ? '성수기 인원부족' : '개인 사유',
          status: s.status as any,
          approvedById: s.status === 'APPROVED' ? hrApprover : undefined,
          approvedAt: s.status === 'APPROVED' ? new Date() : undefined,
          rejectionReason: s.status === 'REJECTED' ? '업무 연속성 문제로 불가' : undefined,
        },
      })
    } catch (e) {
      // 중복 무시
    }
  }

  // CN 휴가 신청 15건
  const cnEmpIds = Object.values(cnEmpMap)
  const cnApprover = cnEmpIds[0]
  for (let i = 0; i < 15; i++) {
    const empId = cnEmpIds[i % cnEmpIds.length]
    const daysOffset = i < 10 ? -(i + 1) * 5 : (i - 9) * 7
    const startDate = daysFromNow2(daysOffset)
    const endDate = daysFromNow2(daysOffset + 2)
    const status = i < 8 ? 'APPROVED' : i < 12 ? 'PENDING' : 'REJECTED'
    const lrId = deterministicUUID('lr-cn', `${i}:${empId}`)
    try {
      await prisma.leaveRequest.upsert({
        where: { id: lrId },
        update: {},
        create: {
          id: lrId,
          employeeId: empId,
          policyId: cnAnnualId,
          companyId: cnId,
          startDate,
          endDate,
          days: 3,
          reason: '个人原因',
          status: status as any,
          approvedById: status === 'APPROVED' ? cnApprover : undefined,
          approvedAt: status === 'APPROVED' ? new Date() : undefined,
          rejectionReason: status === 'REJECTED' ? '生产计划冲突' : undefined,
        },
      })
    } catch (e) {
      // 중복 무시
    }
  }

  console.log(`  ✅ 휴가 정책 KR ${krPolicies.length}개 + CN ${cnPolicies.length}개, 잔여량 ${balCount}명, 신청 40건`)
  return { krPolicyMap, cnPolicyMap }
}

function daysFromNow2(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(0, 0, 0, 0)
  return d
}

// ================================================================
// STEP 8: 근태 단말기 + 근무 스케줄
// ================================================================

async function seedAttendanceTerminals(krId: string) {
  console.log('  🖥  근태 단말기 + 근무 스케줄 생성...')
  const terminals = [
    { code: 'T-HQ-MAIN', type: 'FACE_RECOGNITION', location: '본사 정문' },
    { code: 'T-FACTORY', type: 'FINGERPRINT', location: '공장 입구' },
    { code: 'T-HQ-BACK', type: 'CARD_READER', location: '본사 후문' },
  ]
  for (const t of terminals) {
    const id = deterministicUUID('terminal', t.code)
    await prisma.attendanceTerminal.upsert({
      where: { terminalCode: t.code },
      update: { locationName: t.location },
      create: {
        id,
        companyId: krId,
        terminalCode: t.code,
        terminalType: t.type as any,
        locationName: t.location,
        apiSecret: deterministicUUID('apisec', t.code),
        isActive: true,
      },
    })
  }

  // 표준 근무 스케줄
  const stdId = deterministicUUID('schedule', 'KR-STD')
  await prisma.workSchedule.upsert({
    where: { id: stdId },
    update: {},
    create: {
      id: stdId,
      companyId: krId,
      name: '표준근무 (주 40시간)',
      scheduleType: 'STANDARD',
      weeklyHours: 40,
      dailyConfig: {
        mon: { start: '09:00', end: '18:00', breakMin: 60 },
        tue: { start: '09:00', end: '18:00', breakMin: 60 },
        wed: { start: '09:00', end: '18:00', breakMin: 60 },
        thu: { start: '09:00', end: '18:00', breakMin: 60 },
        fri: { start: '09:00', end: '18:00', breakMin: 60 },
        sat: null,
        sun: null,
      },
    },
  })

  console.log(`  ✅ 단말기 3대, 근무스케줄 1개`)
  return { stdScheduleId: stdId }
}

// ================================================================
// STEP 9: 교대근무 패턴 + 조 + 스케줄
// ================================================================

async function seedShiftSchedules(
  krId: string,
  krEmpMap: Record<string, string>
) {
  console.log('  🔄 교대근무 패턴 + 조 + 스케줄 생성...')

  // ShiftPattern
  const patternId = deterministicUUID('shiftpattern', 'KR-2S2')
  await prisma.shiftPattern.upsert({
    where: { companyId_code: { companyId: krId, code: 'KR-2S2' } },
    update: {},
    create: {
      id: patternId,
      companyId: krId,
      code: 'KR-2S2',
      name: '2조2교대',
      patternType: 'TWO_SHIFT',
      cycleDays: 2,
      weeklyHoursLimit: 40,
      slots: [
        { name: '주간', start: '07:00', end: '19:00', breakMin: 60, nightPremium: false },
        { name: '야간', start: '19:00', end: '07:00', breakMin: 60, nightPremium: true },
      ],
      isActive: true,
    },
  })

  // ShiftGroup A조, B조
  const groupAId = deterministicUUID('shiftgroup', 'KR-A')
  const groupBId = deterministicUUID('shiftgroup', 'KR-B')

  await prisma.shiftGroup.upsert({
    where: { companyId_shiftPatternId_name: { companyId: krId, shiftPatternId: patternId, name: 'A조' } },
    update: {},
    create: { id: groupAId, companyId: krId, shiftPatternId: patternId, name: 'A조', color: '#4CAF50' },
  })
  await prisma.shiftGroup.upsert({
    where: { companyId_shiftPatternId_name: { companyId: krId, shiftPatternId: patternId, name: 'B조' } },
    update: {},
    create: { id: groupBId, companyId: krId, shiftPatternId: patternId, name: 'B조', color: '#2196F3' },
  })

  // MFG팀 생산직 배정 (EMP-KR-013 ~ EMP-KR-020: 8명, 4명씩)
  const productionNos = ['EMP-KR-013', 'EMP-KR-014', 'EMP-KR-015', 'EMP-KR-016', 'EMP-KR-017', 'EMP-KR-018', 'EMP-KR-019', 'EMP-KR-020']
  for (let i = 0; i < productionNos.length; i++) {
    const empId = krEmpMap[productionNos[i]]
    if (!empId) continue
    const groupId = i < 4 ? groupAId : groupBId
    try {
      await prisma.shiftGroupMember.upsert({
        where: { shiftGroupId_employeeId: { shiftGroupId: groupId, employeeId: empId } },
        update: {},
        create: {
          id: deterministicUUID('shiftmember', `${groupId}:${empId}`),
          shiftGroupId: groupId,
          employeeId: empId,
        },
      })
    } catch (e) { /* 무시 */ }
  }

  // 이번달(3월) + 다음달(4월) 스케줄 생성
  const today = new Date()
  const scheduleMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  let scheduleCount = 0

  for (let m = 0; m < 2; m++) {
    const monthStart = new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth() + m, 1)
    const monthEnd = new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth() + m + 1, 0)

    for (let day = monthStart.getDate(); day <= monthEnd.getDate(); day++) {
      const workDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), day)
      if (isWeekend(workDate)) continue

      for (let i = 0; i < productionNos.length; i++) {
        const empId = krEmpMap[productionNos[i]]
        if (!empId) continue
        const isAGroup = i < 4
        // A조: 짝수일 주간, 홀수일 야간 / B조: 반대
        const dayNum = day
        const slotIndex = isAGroup ? (dayNum % 2 === 0 ? 0 : 1) : (dayNum % 2 === 0 ? 1 : 0)
        const isNight = slotIndex === 1

        try {
          await prisma.shiftSchedule.upsert({
            where: { employeeId_workDate: { employeeId: empId, workDate } },
            update: {},
            create: {
              id: deterministicUUID('shiftsch', `${empId}:${workDate.toISOString().slice(0, 10)}`),
              companyId: krId,
              employeeId: empId,
              shiftPatternId: patternId,
              shiftGroupId: isAGroup ? groupAId : groupBId,
              workDate,
              slotIndex,
              slotName: isNight ? '야간' : '주간',
              startTime: isNight ? '19:00' : '07:00',
              endTime: isNight ? '07:00' : '19:00',
              breakMinutes: 60,
              isNightShift: isNight,
              status: 'SCHEDULED',
            },
          })
          scheduleCount++
        } catch (e) { /* 중복 무시 */ }
      }
    }
  }

  console.log(`  ✅ 교대 패턴 1개, 조 2개, 멤버 8명, 스케줄 ${scheduleCount}개`)
}

// ================================================================
// STEP 10: 근태 기록 (Attendance)
// ================================================================

async function seedAttendance(
  krId: string,
  cnId: string,
  krEmpMap: Record<string, string>,
  cnEmpMap: Record<string, string>
) {
  console.log('  ⏰ 근태 기록 생성...')

  async function createAttendance(
    companyId: string,
    empIds: string[],
    startDate: Date,
    endDate: Date,
    seedOffset: number
  ) {
    let count = 0
    const cur = new Date(startDate)
    while (cur <= endDate) {
      if (!isWeekend(cur)) {
        for (let e = 0; e < empIds.length; e++) {
          const empId = empIds[e]
          const seed = seedOffset + e * 100 + cur.getDate() * 10 + cur.getMonth() * 300
          const rnd = pseudoRandom(seed)

          let status: string
          let clockIn: Date | undefined
          let clockOut: Date | undefined
          let totalMin: number | undefined

          if (rnd < 0.01) {
            // 결근
            status = 'ABSENT'
          } else if (rnd < 0.06) {
            // 지각
            status = 'LATE'
            const lateMin = 15 + Math.floor(pseudoRandom(seed + 1) * 45)
            clockIn = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 9, lateMin)
            clockOut = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 18, 0)
            totalMin = (18 * 60) - (9 * 60 + lateMin)
          } else if (rnd < 0.08) {
            // 조퇴
            status = 'EARLY_OUT'
            clockIn = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 9, 0)
            const earlyHour = 15 + Math.floor(pseudoRandom(seed + 2) * 2)
            clockOut = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), earlyHour, 0)
            totalMin = (earlyHour - 9) * 60
          } else {
            // 정상
            status = 'NORMAL'
            const minOffset = Math.floor(pseudoRandom(seed + 3) * 15) - 5
            clockIn = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 8, 55 + minOffset)
            const outMin = Math.floor(pseudoRandom(seed + 4) * 90)
            clockOut = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 18, outMin)
            totalMin = (18 * 60 + outMin) - (8 * 60 + 55 + minOffset) - 60 // 점심 1시간 차감
          }

          const attId = deterministicUUID('att', `${companyId}:${empId}:${cur.toISOString().slice(0, 10)}`)
          try {
            await prisma.attendance.upsert({
              where: { id: attId },
              update: {},
              create: {
                id: attId,
                employeeId: empId,
                companyId,
                workDate: new Date(cur),
                clockIn: clockIn || undefined,
                clockOut: clockOut || undefined,
                clockInMethod: clockIn ? 'CARD_READER' : undefined,
                clockOutMethod: clockOut ? 'CARD_READER' : undefined,
                workType: 'NORMAL',
                status: status as any,
                totalMinutes: totalMin,
                overtimeMinutes: totalMin && totalMin > 480 ? totalMin - 480 : 0,
              },
            })
            count++
          } catch (e) { /* 중복 무시 */ }
        }
      }
      cur.setDate(cur.getDate() + 1)
    }
    return count
  }

  // CTR-KR: 최근 3개월 (사무직만, 생산직 제외 - 교대스케줄과 분리)
  const krOfficeNos = KR_EMPLOYEES.filter(e => e.cat !== 'PRODUCTION').map(e => e.no)
  const krOfficeIds = krOfficeNos.map(no => krEmpMap[no]).filter(Boolean)
  const kr3MonthStart = daysAgo(90)
  const kr3MonthEnd = daysAgo(1)
  const krCount = await createAttendance(krId, krOfficeIds, kr3MonthStart, kr3MonthEnd, 1000)

  // CTR-CN: 최근 1개월
  const cnIds = Object.values(cnEmpMap).filter(Boolean)
  const cn1MonthStart = daysAgo(30)
  const cn1MonthEnd = daysAgo(1)
  const cnCount = await createAttendance(cnId, cnIds, cn1MonthStart, cn1MonthEnd, 5000)

  console.log(`  ✅ 근태: KR ${krCount}건, CN ${cnCount}건`)
}

// ================================================================
// STEP 11: 온보딩 / 오프보딩
// ================================================================

async function seedOnOffboarding(
  krId: string,
  krEmpMap: Record<string, string>
) {
  console.log('  🚀 온보딩/오프보딩 생성...')

  // 온보딩 템플릿 조회
  const template = await prisma.onboardingTemplate.findFirst({
    where: { companyId: krId, targetType: 'NEW_HIRE' },
    include: { onboardingTasks: { take: 5 } },
  })
  if (!template) {
    console.warn('    ⚠️  온보딩 템플릿 없음 (seed.ts 실행 필요)')
    return
  }

  // 2026년 2월 입사자 중 진행 중 3건
  const inProgressNos = ['EMP-KR-028', 'EMP-KR-008', 'EMP-KR-040']
  for (const no of inProgressNos) {
    const empId = krEmpMap[no]
    if (!empId) continue
    const obId = deterministicUUID('onboarding', `${empId}:2026`)
    const existing = await prisma.employeeOnboarding.findUnique({ where: { id: obId } })
    if (!existing) {
      const ob = await prisma.employeeOnboarding.create({
        data: {
          id: obId,
          employeeId: empId,
          templateId: template.id,
          companyId: krId,
          planType: 'ONBOARDING',
          status: 'IN_PROGRESS',
          startedAt: daysAgo(15),
        },
      })
      // 태스크 일부 완료
      for (let i = 0; i < template.onboardingTasks.length; i++) {
        const t = template.onboardingTasks[i]
        const taskStatus = i < 3 ? 'DONE' : 'PENDING'
        await prisma.employeeOnboardingTask.create({
          data: {
            id: deterministicUUID('obtask', `${ob.id}:${t.id}`),
            employeeOnboardingId: ob.id,
            taskId: t.id,
            status: taskStatus as any,
            completedAt: taskStatus === 'DONE' ? daysAgo(10 - i * 2) : undefined,
          },
        })
      }
    }
  }

  // 2025년 11월 입사자 완료 2건
  const completedNos = ['EMP-KR-040', 'EMP-KR-035']
  for (const no of completedNos) {
    const empId = krEmpMap[no]
    if (!empId) continue
    const obId = deterministicUUID('onboarding', `${empId}:2025`)
    const existing = await prisma.employeeOnboarding.findUnique({ where: { id: obId } })
    if (!existing) {
      const ob = await prisma.employeeOnboarding.create({
        data: {
          id: obId,
          employeeId: empId,
          templateId: template.id,
          companyId: krId,
          planType: 'ONBOARDING',
          status: 'COMPLETED',
          startedAt: daysAgo(120),
          completedAt: daysAgo(60),
        },
      })
      for (const t of template.onboardingTasks) {
        try {
          await prisma.employeeOnboardingTask.create({
            data: {
              id: deterministicUUID('obtask-c', `${ob.id}:${t.id}`),
              employeeOnboardingId: ob.id,
              taskId: t.id,
              status: 'DONE',
              completedAt: daysAgo(65),
            },
          })
        } catch (e) { /* 무시 */ }
      }
    }
  }

  // 오프보딩 (퇴사 처리 진행 중 2건)
  const offboardingChecklist = await prisma.offboardingChecklist.findFirst({
    where: { companyId: krId },
    include: { offboardingTasks: { take: 5 } },
  })

  if (offboardingChecklist) {
    const offboardingNos = ['EMP-KR-039', 'EMP-KR-037']
    const resignTypes = ['VOLUNTARY', 'INVOLUNTARY']
    for (let i = 0; i < offboardingNos.length; i++) {
      const no = offboardingNos[i]
      const empId = krEmpMap[no]
      if (!empId) continue
      const offId = deterministicUUID('offboarding', `${empId}:2026`)
      const existing = await prisma.employeeOffboarding.findUnique({ where: { id: offId } })
      if (!existing) {
        const off = await prisma.employeeOffboarding.create({
          data: {
            id: offId,
            employeeId: empId,
            checklistId: offboardingChecklist.id,
            resignType: resignTypes[i] as any,
            lastWorkingDate: daysLater(30 - i * 15),
            status: 'IN_PROGRESS',
            startedAt: daysAgo(7),
          },
        })
        for (let j = 0; j < Math.min(3, offboardingChecklist.offboardingTasks.length); j++) {
          const t = offboardingChecklist.offboardingTasks[j]
          try {
            await prisma.employeeOffboardingTask.create({
              data: {
                id: deterministicUUID('offtask', `${off.id}:${t.id}`),
                employeeOffboardingId: off.id,
                taskId: t.id,
                status: j < 2 ? 'DONE' : 'PENDING',
                completedAt: j < 2 ? daysAgo(5) : undefined,
              },
            })
          } catch (e) { /* 무시 */ }
        }
      }
    }
  }

  console.log('  ✅ 온보딩 5건, 오프보딩 2건')
}

// ================================================================
// STEP 12: 성과 사이클 + MBO 목표
// ================================================================

async function seedPerformance(
  krId: string,
  krEmpMap: Record<string, string>
) {
  console.log('  🎯 성과 사이클 + MBO + 평가 생성...')

  const adminId = Object.values(krEmpMap)[0]

  // 성과 사이클 2개
  const cycle2025H2Id = deterministicUUID('cycle', 'CTR-KR:2025-H2')
  const cycle2026H1Id = deterministicUUID('cycle', 'CTR-KR:2026-H1')

  await prisma.performanceCycle.upsert({
    where: { id: cycle2025H2Id },
    update: { status: 'CLOSED' },
    create: {
      id: cycle2025H2Id,
      companyId: krId,
      name: '2025년 하반기 성과평가',
      year: 2025,
      half: 'H2',
      goalStart: dateOnly(2025, 7, 1),
      goalEnd: dateOnly(2025, 7, 31),
      evalStart: dateOnly(2025, 12, 1),
      evalEnd: dateOnly(2025, 12, 31),
      status: 'CLOSED',
    },
  })

  await prisma.performanceCycle.upsert({
    where: { id: cycle2026H1Id },
    update: { status: 'EVAL_OPEN' },
    create: {
      id: cycle2026H1Id,
      companyId: krId,
      name: '2026년 상반기 성과평가',
      year: 2026,
      half: 'H1',
      goalStart: dateOnly(2026, 1, 2),
      goalEnd: dateOnly(2026, 1, 31),
      evalStart: dateOnly(2026, 6, 1),
      evalEnd: dateOnly(2026, 6, 30),
      status: 'EVAL_OPEN',
    },
  })

  const krEmpNos = Object.keys(krEmpMap)
  const emsBlocks = ['A1', 'A2', 'A3', 'B1', 'B2', 'B2', 'B2', 'B3', 'C1', 'C2', 'C3']
  const goalTitles = [
    '품질 지표 개선 (불량률 5% 감소)',
    '신규 고객사 개발 (3개사 이상)',
    '프로세스 자동화 도입',
    '팀 역량 강화 (교육 이수 100%)',
    '비용 절감 목표 달성 (5% 이상)',
    '납기 준수율 98% 달성',
  ]

  let mboCount = 0
  let evalCount = 0

  for (let i = 0; i < krEmpNos.length; i++) {
    const empNo = krEmpNos[i]
    const empId = krEmpMap[empNo]
    const seed = i * 17 + 3

    // 2025-H2 MBO 목표 3개 (closed)
    for (let g = 0; g < 3; g++) {
      const goalId = deterministicUUID('mbo', `2025H2:${empId}:${g}`)
      const score = 2 + pseudoRandom(seed + g * 7) * 3 // 2.0~5.0
      try {
        await prisma.mboGoal.upsert({
          where: { id: goalId },
          update: { achievementScore: Math.round(score * 10) / 10 },
          create: {
            id: goalId,
            cycleId: cycle2025H2Id,
            employeeId: empId,
            companyId: krId,
            title: goalTitles[(i + g) % goalTitles.length],
            weight: g === 0 ? 40 : g === 1 ? 35 : 25,
            status: 'APPROVED',
            achievementScore: Math.round(score * 10) / 10,
            approvedById: adminId,
            approvedAt: dateOnly(2025, 7, 20),
          },
        })
        mboCount++
      } catch (e) { /* 무시 */ }
    }

    // 2026-H1 MBO 목표 3개 (진행 중, 달성점수 없음)
    for (let g = 0; g < 3; g++) {
      const goalId = deterministicUUID('mbo', `2026H1:${empId}:${g}`)
      try {
        await prisma.mboGoal.upsert({
          where: { id: goalId },
          update: {},
          create: {
            id: goalId,
            cycleId: cycle2026H1Id,
            employeeId: empId,
            companyId: krId,
            title: goalTitles[(i + g + 2) % goalTitles.length],
            weight: g === 0 ? 40 : g === 1 ? 35 : 25,
            status: 'APPROVED',
            approvedById: adminId,
            approvedAt: dateOnly(2026, 1, 25),
          },
        })
        mboCount++
      } catch (e) { /* 무시 */ }
    }

    // 2025-H2 평가 (SELF + MANAGER, CONFIRMED)
    const perfScore = 2.0 + pseudoRandom(seed + 5) * 3
    const compScore = 2.0 + pseudoRandom(seed + 9) * 3
    const block = emsBlocks[Math.floor(pseudoRandom(seed + 13) * emsBlocks.length)]

    // SELF 평가
    const selfEvalId = deterministicUUID('eval', `2025H2:SELF:${empId}`)
    try {
      await prisma.performanceEvaluation.upsert({
        where: { id: selfEvalId },
        update: {},
        create: {
          id: selfEvalId,
          cycleId: cycle2025H2Id,
          employeeId: empId,
          evaluatorId: empId,
          companyId: krId,
          evalType: 'SELF',
          performanceScore: Math.round(perfScore * 10) / 10,
          competencyScore: Math.round(compScore * 10) / 10,
          emsBlock: block,
          status: 'CONFIRMED',
          submittedAt: dateOnly(2025, 12, 15),
        },
      })
      evalCount++
    } catch (e) { /* 무시 */ }

    // MANAGER 평가
    const mgrEvalId = deterministicUUID('eval', `2025H2:MANAGER:${empId}`)
    const mgrPerfScore = perfScore + (pseudoRandom(seed + 20) * 0.6 - 0.3) // ±0.3 조정
    const mgrCompScore = compScore + (pseudoRandom(seed + 25) * 0.6 - 0.3)
    try {
      await prisma.performanceEvaluation.upsert({
        where: { id: mgrEvalId },
        update: {},
        create: {
          id: mgrEvalId,
          cycleId: cycle2025H2Id,
          employeeId: empId,
          evaluatorId: adminId,
          companyId: krId,
          evalType: 'MANAGER',
          performanceScore: Math.round(Math.max(1, Math.min(5, mgrPerfScore)) * 10) / 10,
          competencyScore: Math.round(Math.max(1, Math.min(5, mgrCompScore)) * 10) / 10,
          emsBlock: block,
          status: 'CONFIRMED',
          submittedAt: dateOnly(2025, 12, 25),
        },
      })
      evalCount++
    } catch (e) { /* 무시 */ }

    // 2026-H1 SELF 평가 (DRAFT or SUBMITTED)
    const self2026Id = deterministicUUID('eval', `2026H1:SELF:${empId}`)
    const evalStatus = i % 3 === 0 ? 'DRAFT' : 'SUBMITTED'
    try {
      await prisma.performanceEvaluation.upsert({
        where: { id: self2026Id },
        update: {},
        create: {
          id: self2026Id,
          cycleId: cycle2026H1Id,
          employeeId: empId,
          evaluatorId: empId,
          companyId: krId,
          evalType: 'SELF',
          status: evalStatus as any,
          submittedAt: evalStatus === 'SUBMITTED' ? daysAgo(5) : undefined,
        },
      })
      evalCount++
    } catch (e) { /* 무시 */ }
  }

  console.log(`  ✅ 성과 사이클 2개, MBO 목표 ${mboCount}개, 평가 ${evalCount}개`)
  return { cycle2025H2Id, cycle2026H1Id }
}

// ================================================================
// STEP 13: 1:1 미팅 + Recognition
// ================================================================

async function seedOneOnOneAndRecognition(
  krId: string,
  krEmpMap: Record<string, string>
) {
  console.log('  🤝 1:1 미팅 + Recognition 생성...')

  const krEmpNos = Object.keys(krEmpMap)
  const krEmpIds = Object.values(krEmpMap)

  // MANAGER 역할 직원 (no에서 MANAGER 이름 기반으로 추정)
  const managerNos = KR_EMPLOYEES.filter(e => e.role === 'MANAGER').map(e => e.no)
  let oonCount = 0

  for (const mgrNo of managerNos) {
    const mgrId = krEmpMap[mgrNo]
    if (!mgrId) continue
    // 매니저별 부하 5명씩 1:1 (최근 3개월, 월 1회)
    const reports = KR_EMPLOYEES.filter(e =>
      e.role === 'EMPLOYEE' && e.dept === KR_EMPLOYEES.find(m => m.no === mgrNo)?.dept
    ).slice(0, 5)

    for (const report of reports) {
      const empId = krEmpMap[report.no]
      if (!empId) continue
      for (let month = 0; month < 3; month++) {
        const scheduledAt = daysAgo(90 - month * 30)
        const isPast = scheduledAt < new Date()
        const oonId = deterministicUUID('oon', `${mgrId}:${empId}:${month}`)
        try {
          await prisma.oneOnOne.upsert({
            where: { id: oonId },
            update: {},
            create: {
              id: oonId,
              employeeId: empId,
              managerId: mgrId,
              companyId: krId,
              scheduledAt,
              completedAt: isPast ? new Date(scheduledAt.getTime() + 60 * 60 * 1000) : undefined,
              status: isPast ? 'COMPLETED' : 'SCHEDULED',
              meetingType: 'REGULAR',
              agenda: '업무 진행 상황 및 개인 성장 계획 공유',
              notes: isPast ? '목표 진행 현황 확인, 다음 분기 방향성 논의' : undefined,
            },
          })
          oonCount++
        } catch (e) { /* 무시 */ }
      }
    }
  }

  // Recognition 15건
  const coreValues = ['도전', '신뢰', '책임', '존중']
  const messages = [
    '어려운 프로젝트를 끝까지 완수해 주셔서 감사합니다.',
    '팀원들과의 훌륭한 협업 덕분에 목표를 달성할 수 있었습니다.',
    '고객 불만 상황을 빠르게 해결해 주신 점 정말 인상적이었습니다.',
    '야근까지 하며 책임감 있게 마무리해 주셨습니다.',
    '새로운 아이디어로 팀에 활기를 불어넣어 주셔서 감사합니다.',
    '항상 긍정적인 에너지로 팀 분위기를 이끌어 주셔서 고마워요.',
    '어려운 요청에도 흔쾌히 도움을 주셔서 큰 힘이 됐습니다.',
    '품질 기준을 철저하게 지켜주신 덕분에 신뢰를 쌓을 수 있었습니다.',
  ]

  let recCount = 0
  for (let i = 0; i < 15; i++) {
    const senderId = krEmpIds[i % krEmpIds.length]
    const receiverId = krEmpIds[(i + 5) % krEmpIds.length]
    if (senderId === receiverId) continue
    const recId = deterministicUUID('recognition', `${i}:${senderId}:${receiverId}`)
    try {
      await prisma.recognition.upsert({
        where: { id: recId },
        update: {},
        create: {
          id: recId,
          senderId,
          receiverId,
          companyId: krId,
          coreValue: coreValues[i % coreValues.length],
          message: messages[i % messages.length],
          isPublic: true,
        },
      })
      recCount++
    } catch (e) { /* 무시 */ }
  }

  console.log(`  ✅ 1:1 미팅 ${oonCount}건, Recognition ${recCount}건`)
}

// ================================================================
// STEP 14: 캘리브레이션 세션
// ================================================================

async function seedCalibration(
  krId: string,
  krEmpMap: Record<string, string>,
  cycle2025H2Id: string
) {
  console.log('  📊 캘리브레이션 세션 생성...')

  const adminId = Object.values(krEmpMap)[0]

  // 캘리브레이션 규칙 (9 EMS 블록)
  const calibRules = [
    { block: 'A1', pct: 5 }, { block: 'A2', pct: 10 }, { block: 'A3', pct: 5 },
    { block: 'B1', pct: 10 }, { block: 'B2', pct: 35 }, { block: 'B3', pct: 15 },
    { block: 'C1', pct: 5 }, { block: 'C2', pct: 10 }, { block: 'C3', pct: 5 },
  ]
  for (const r of calibRules) {
    const ruleId = deterministicUUID('calibrule', `${krId}:${cycle2025H2Id}:${r.block}`)
    try {
      await prisma.calibrationRule.upsert({
        where: { companyId_cycleId_emsBlock: { companyId: krId, cycleId: cycle2025H2Id, emsBlock: r.block } },
        update: { recommendedPct: r.pct },
        create: {
          id: ruleId,
          companyId: krId,
          cycleId: cycle2025H2Id,
          emsBlock: r.block,
          recommendedPct: r.pct,
          minPct: Math.max(0, r.pct - 5),
          maxPct: r.pct + 5,
          createdById: adminId,
        },
      })
    } catch (e) { /* 무시 */ }
  }

  // 캘리브레이션 세션
  const sessionId = deterministicUUID('calibsession', `${krId}:2025H2`)
  await prisma.calibrationSession.upsert({
    where: { id: sessionId },
    update: {},
    create: {
      id: sessionId,
      cycleId: cycle2025H2Id,
      companyId: krId,
      name: '2025 하반기 성과 캘리브레이션',
      status: 'CALIBRATION_COMPLETED',
      blockDistribution: { A1: 2, A2: 4, A3: 2, B1: 4, B2: 14, B3: 6, C1: 2, C2: 4, C3: 2 },
      notes: '전체 40명 대상, 9블록 분포 확정',
      createdById: adminId,
      completedAt: dateOnly(2026, 1, 10),
    },
  })

  // 캘리브레이션 조정 5건
  const krEmpIds = Object.values(krEmpMap)
  for (let i = 0; i < 5; i++) {
    const empId = krEmpIds[i + 3]
    const adjId = deterministicUUID('calibadj', `${sessionId}:${empId}`)
    const originalBlocks = ['B1', 'B2', 'B3', 'A3', 'C1']
    const adjustedBlocks = ['A3', 'B1', 'B2', 'B2', 'B3']
    try {
      await prisma.calibrationAdjustment.upsert({
        where: { id: adjId },
        update: {},
        create: {
          id: adjId,
          sessionId,
          employeeId: empId,
          evaluatorId: adminId,
          originalPerformanceScore: 3.0 + i * 0.2,
          originalCompetencyScore: 3.0 + i * 0.1,
          originalBlock: originalBlocks[i],
          adjustedPerformanceScore: 3.2 + i * 0.2,
          adjustedCompetencyScore: 3.1 + i * 0.1,
          adjustedBlock: adjustedBlocks[i],
          reason: '팀 기여도 추가 반영',
          adjustedBy: adminId,
          adjustedAt: dateOnly(2026, 1, 8),
        },
      })
    } catch (e) { /* 무시 */ }
  }

  console.log(`  ✅ 캘리브레이션 규칙 9개, 세션 1개, 조정 5건`)
}

// ================================================================
// STEP 15: 표창 + 징계
// ================================================================

async function seedRewardsAndDiscipline(
  krId: string,
  krEmpMap: Record<string, string>
) {
  console.log('  🏆 표창 + 징계 생성...')

  const krEmpNos = Object.keys(krEmpMap)
  const krEmpIds = Object.values(krEmpMap)
  const adminId = krEmpIds[0]

  // 표창 2건
  const rewardDefs = [
    {
      empNo: krEmpNos[5],
      type: 'COMMENDATION',
      title: '2025년 우수사원 표창',
      desc: '연간 KPI 130% 달성 및 팀 성과 기여',
      amount: 500000,
      date: dateOnly(2025, 12, 30),
      ctrValue: '도전',
    },
    {
      empNo: krEmpNos[8],
      type: 'CTR_VALUE_AWARD',
      title: '4분기 최우수팀 수상',
      desc: '생산 목표 초과 달성 (105%) 및 품질 지표 개선',
      amount: undefined,
      date: dateOnly(2025, 12, 30),
      ctrValue: '책임',
    },
  ]

  for (const r of rewardDefs) {
    const empId = krEmpMap[r.empNo]
    if (!empId) continue
    const rId = deterministicUUID('reward', `${empId}:${r.type}`)
    try {
      await prisma.rewardRecord.upsert({
        where: { id: rId },
        update: {},
        create: {
          id: rId,
          employeeId: empId,
          companyId: krId,
          rewardType: r.type as any,
          title: r.title,
          description: r.desc,
          amount: r.amount || undefined,
          awardedDate: r.date,
          awardedById: adminId,
          ctrValue: r.ctrValue,
        },
      })
    } catch (e) { /* 무시 */ }
  }

  // 징계 1건
  const disciplineEmpId = krEmpMap[krEmpNos[15]]
  if (disciplineEmpId) {
    const dId = deterministicUUID('discipline', `${disciplineEmpId}:WARNING`)
    try {
      await prisma.disciplinaryAction.upsert({
        where: { id: dId },
        update: {},
        create: {
          id: dId,
          employeeId: disciplineEmpId,
          companyId: krId,
          actionType: 'WRITTEN_WARNING',
          category: 'ATTENDANCE',
          incidentDate: dateOnly(2025, 11, 1),
          description: '무단결근 3회 반복 (10/15, 10/28, 11/01)',
          status: 'DISCIPLINE_ACTIVE',
          validMonths: 12,
          expiresAt: dateOnly(2026, 11, 1),
          issuedById: adminId,
        },
      })
    } catch (e) { /* 무시 */ }
  }

  console.log(`  ✅ 표창 2건, 징계 1건`)
}

// ================================================================
// MAIN
// ================================================================

async function main() {
  console.log('🌱 CTR HR Hub — Dev Seed 시작 (CTR-KR + CTR-CN)')
  console.log('================================================================')

  // STEP 1: 마스터 데이터 로드
  console.log('\n📌 STEP 1: 마스터 데이터 로드...')
  const { krId, cnId, roleMap, gradeMap, jobCatMap, cnGradeMap, cnJobCatMap, krDeptMap, cnDeptMap } =
    await loadMasterData()
  console.log(`  ✅ KR: ${krId.slice(0, 8)}..., CN: ${cnId.slice(0, 8)}...`)

  // STEP 2: 부서 계층
  console.log('\n📌 STEP 2: 부서 계층 구성...')
  const updatedKrDeptMap = await seedKrDepartments(krId, krDeptMap)
  const updatedCnDeptMap = await seedCnDepartments(cnId, cnDeptMap)

  // STEP 3: 직원 생성
  console.log('\n📌 STEP 3: 직원 생성...')
  const krEmpMap = await seedKrEmployees(krId, updatedKrDeptMap, gradeMap, jobCatMap, roleMap)
  const cnEmpMap = await seedCnEmployees(cnId, updatedCnDeptMap, cnGradeMap, cnJobCatMap, roleMap, gradeMap, jobCatMap)

  // STEP 4: 중국 공휴일
  console.log('\n📌 STEP 4: 중국 공휴일...')
  await seedCnHolidays(cnId)

  // STEP 5: 휴가 정책 + 잔여량
  console.log('\n📌 STEP 5: 휴가 정책 + 잔여량...')
  await seedLeavePolicies(krId, cnId, krEmpMap, cnEmpMap)

  // STEP 6: 근태 단말기 + 스케줄
  console.log('\n📌 STEP 6: 근태 단말기 + 스케줄...')
  await seedAttendanceTerminals(krId)

  // STEP 7: 교대근무
  console.log('\n📌 STEP 7: 교대근무 패턴 + 스케줄...')
  await seedShiftSchedules(krId, krEmpMap)

  // STEP 8: 근태 기록
  console.log('\n📌 STEP 8: 근태 기록...')
  await seedAttendance(krId, cnId, krEmpMap, cnEmpMap)

  // STEP 9: 온보딩/오프보딩
  console.log('\n📌 STEP 9: 온보딩/오프보딩...')
  await seedOnOffboarding(krId, krEmpMap)

  // STEP 10: 성과
  console.log('\n📌 STEP 10: 성과 사이클 + MBO + 평가...')
  const { cycle2025H2Id } = await seedPerformance(krId, krEmpMap)

  // STEP 11: 1:1 + Recognition
  console.log('\n📌 STEP 11: 1:1 미팅 + Recognition...')
  await seedOneOnOneAndRecognition(krId, krEmpMap)

  // STEP 12: 캘리브레이션
  console.log('\n📌 STEP 12: 캘리브레이션...')
  await seedCalibration(krId, krEmpMap, cycle2025H2Id)

  // STEP 13: 표창 + 징계
  console.log('\n📌 STEP 13: 표창 + 징계...')
  await seedRewardsAndDiscipline(krId, krEmpMap)

  console.log('\n================================================================')
  console.log('✅ Dev Seed 완료!')
  console.log('\n📋 테스트 가이드:')
  console.log('  - /employees → CTR-KR 40명 + CTR-CN 20명')
  console.log('  - /org       → 계층 조직도 (본부 > 팀)')
  console.log('  - /attendance → 최근 3개월 근태 기록')
  console.log('  - /leave     → 휴가 신청 40건 (PENDING/APPROVED/REJECTED)')
  console.log('  - /shift     → 2조2교대 패턴 + 월간 스케줄')
  console.log('  - /performance → 2025-H2 (CLOSED) + 2026-H1 (EVAL_OPEN)')
  console.log('  - /onboarding → 진행 중 3건 + 완료 2건')
  console.log('  - /offboarding → 진행 중 2건')
  console.log('  - /recognition → 15건')
  console.log('  - /discipline → 표창 2건 + 징계 1건')
}

main()
  .catch(e => {
    console.error('❌ Seed 실패:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
