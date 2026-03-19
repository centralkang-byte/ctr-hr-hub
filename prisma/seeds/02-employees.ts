// ================================================================
// CTR HR Hub — Seed Data Expansion: Session 1 — New Employees
// prisma/seeds/02-employees.ts
//
// 목표:
//   CTR: 70명 신규 (CTR-KR-3001 ~ CTR-KR-3070)
//   CTR-CN: 18명 신규 (CTR-CN-1001 ~ CTR-CN-1018) + ADMIN/ENG 부서 + 포지션
//
// 페르소나:
//   P1=모범사원, P2=야근전사, P3=52h위반, P4=신입수습, P5=이직위험
//   P6=계약직인턴, P7=육아특수, P8=교대근무, P9=관리자, P10=퇴직예정
//
// 모든 ID는 deterministicUUID 사용 (idempotent)
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

// ────────────────────────────────────────────────────────────
// Deterministic UUID (seed.ts와 동일한 구현)
// ────────────────────────────────────────────────────────────
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

const TEST_PASSWORD_HASH = '$2b$10$dummyHashForSeedOnlyNotRealBcryptHashValue000000000000'

// ────────────────────────────────────────────────────────────
// 이름 생성용 데이터
// ────────────────────────────────────────────────────────────
const KR_SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍']
const KR_GIVEN_NAMES = ['민준', '서준', '예준', '도윤', '시우', '하준', '주원', '지호', '지훈', '준서', '수빈', '지우', '서연', '민서', '하은', '지민', '수진', '예진', '다은', '채원', '현우', '승현', '태영', '재현', '동혁', '성민', '우진', '영호', '병철', '광수']
const KR_GIVEN_EN   = ['Minjun', 'Seojun', 'Yejun', 'Doyun', 'Siwoo', 'Hajun', 'Juwon', 'Jiho', 'Jihun', 'Junseo', 'Subin', 'Jiwoo', 'Seoyeon', 'Minseo', 'Haeun', 'Jimin', 'Sujin', 'Yejin', 'Daeun', 'Chaewon', 'Hyunwoo', 'Seunghyun', 'Taeyoung', 'Jaehyun', 'Donghyuk', 'Sungmin', 'Woojin', 'Youngho', 'Byungchul', 'Kwangsu']
const KR_SURNAMES_EN = ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Jo', 'Yun', 'Jang', 'Im', 'Han', 'Oh', 'Seo', 'Shin', 'Kwon', 'Hwang', 'An', 'Song', 'Ryu', 'Hong']

const CN_SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴']
const CN_GIVEN_NAMES = ['伟', '芳', '娜', '敏', '静', '强', '磊', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '华', '丽', '军', '平']
const CN_PINYIN_GIVEN = ['Wei', 'Fang', 'Na', 'Min', 'Jing', 'Qiang', 'Lei', 'Yang', 'Yong', 'Yan', 'Jie', 'Juan', 'Tao', 'Ming', 'Chao', 'Xiuying', 'Hua', 'Li', 'Jun', 'Ping']
const CN_PINYIN_SUR  = ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Zhao', 'Huang', 'Zhou', 'Wu']

function krName(idx: number) {
  const sn = KR_SURNAMES[idx % KR_SURNAMES.length]
  const gn = KR_GIVEN_NAMES[idx % KR_GIVEN_NAMES.length]
  const snEn = KR_SURNAMES_EN[idx % KR_SURNAMES_EN.length]
  const gnEn = KR_GIVEN_EN[idx % KR_GIVEN_EN.length]
  return { name: `${sn}${gn}`, nameEn: `${snEn} ${gnEn}` }
}

function cnName(idx: number) {
  const sn = CN_SURNAMES[idx % CN_SURNAMES.length]
  const gn = CN_GIVEN_NAMES[(idx + 3) % CN_GIVEN_NAMES.length]
  const snEn = CN_PINYIN_SUR[idx % CN_PINYIN_SUR.length]
  const gnEn = CN_PINYIN_GIVEN[(idx + 3) % CN_PINYIN_GIVEN.length]
  return { name: `${sn}${gn}`, nameEn: `${snEn} ${gnEn}` }
}

// ────────────────────────────────────────────────────────────
// 입사일 생성 (페르소나 기반)
// ────────────────────────────────────────────────────────────
function hireDate(persona: string, seed: number): Date {
  const now = new Date('2026-03-09')
  if (persona === 'P4') {
    // 신입: 최근 3개월 이내
    const daysAgo = 10 + (seed % 80)
    return new Date(now.getTime() - daysAgo * 86_400_000)
  }
  if (persona === 'P5' || persona === 'P6') {
    // 이직위험/계약직: 1~3년
    const years = 1 + (seed % 2)
    return new Date(`${2026 - years}-${String((seed % 12) + 1).padStart(2, '0')}-01`)
  }
  if (persona === 'P10') {
    // 퇴직예정: 3~5년
    return new Date(`${2021 + (seed % 2)}-${String((seed % 12) + 1).padStart(2, '0')}-01`)
  }
  // 일반: 1~5년 랜덤
  const year = 2021 + (seed % 4)
  const month = String((seed % 12) + 1).padStart(2, '0')
  return new Date(`${year}-${month}-01`)
}

// 계약 종료일 (계약직/인턴)
function contractEndDate(seed: number): Date {
  // 1~4개월 후
  const now = new Date('2026-03-09')
  const monthsAhead = 1 + (seed % 4)
  const d = new Date(now)
  d.setMonth(d.getMonth() + monthsAhead)
  return d
}

// ────────────────────────────────────────────────────────────
// KR 직원 블루프린트
// ────────────────────────────────────────────────────────────
interface EmpBlueprint {
  no:      string
  persona: string
  dept:    string      // 'MFG'|'RANDD'|'QA'|'SALES'|'DEV'|'PUR'|'FIN'|'HR'|'MGMT'
  pos:     string      // 포지션 코드
  grade:   string      // 'G3'~'G6'
  empType: 'FULL_TIME' | 'CONTRACT' | 'INTERN' | 'DISPATCH'
  status:  'ACTIVE' | 'ON_LEAVE' | 'PROBATION'
}

// MFG 22명 (기존 6명 있음 → 신규 16명)
// RANDD 12명 (기존 8명 있음 → 신규 4개 포지션 공유)
// QA 10명 (기존 7개 포지션 → 신규 3개 추가)
// etc. 기존 포지션 최대 재활용

const KR_BLUEPRINTS: EmpBlueprint[] = [
  // ── MFG +16명 ────────────────────────────────────────────
  { no: 'CTR-KR-3001', persona: 'P8', dept: 'MFG', pos: 'CTR-KR-MFG-004', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3002', persona: 'P8', dept: 'MFG', pos: 'CTR-KR-MFG-005', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3003', persona: 'P8', dept: 'MFG', pos: 'CTR-KR-MFG-006', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3004', persona: 'P3', dept: 'MFG', pos: 'CTR-KR-MFG-007', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3005', persona: 'P3', dept: 'MFG', pos: 'CTR-KR-MFG-008', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3006', persona: 'P2', dept: 'MFG', pos: 'CTR-KR-MFG-009', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3007', persona: 'P2', dept: 'MFG', pos: 'CTR-KR-MFG-010', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3008', persona: 'P8', dept: 'MFG', pos: 'CTR-KR-MFG-007', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3009', persona: 'P8', dept: 'MFG', pos: 'CTR-KR-MFG-008', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3010', persona: 'P1', dept: 'MFG', pos: 'CTR-KR-MFG-007', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3011', persona: 'P6', dept: 'MFG', pos: 'CTR-KR-MFG-008', grade: 'G6', empType: 'CONTRACT',  status: 'ACTIVE' },
  { no: 'CTR-KR-3012', persona: 'P6', dept: 'MFG', pos: 'CTR-KR-MFG-009', grade: 'G6', empType: 'DISPATCH',  status: 'ACTIVE' },
  { no: 'CTR-KR-3013', persona: 'P4', dept: 'MFG', pos: 'CTR-KR-MFG-010', grade: 'G6', empType: 'INTERN',    status: 'PROBATION' },
  { no: 'CTR-KR-3014', persona: 'P1', dept: 'MFG', pos: 'CTR-KR-MFG-009', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3015', persona: 'P7', dept: 'MFG', pos: 'CTR-KR-MFG-010', grade: 'G6', empType: 'FULL_TIME', status: 'ON_LEAVE' },
  { no: 'CTR-KR-3016', persona: 'P5', dept: 'MFG', pos: 'CTR-KR-MFG-007', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },

  // ── RANDD +12명 ───────────────────────────────────────────
  { no: 'CTR-KR-3017', persona: 'P9', dept: 'RANDD', pos: 'CTR-KR-RANDD-003', grade: 'G4', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3018', persona: 'P9', dept: 'RANDD', pos: 'CTR-KR-RANDD-004', grade: 'G4', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3019', persona: 'P1', dept: 'RANDD', pos: 'CTR-KR-RANDD-005', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3020', persona: 'P1', dept: 'RANDD', pos: 'CTR-KR-RANDD-006', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3021', persona: 'P2', dept: 'RANDD', pos: 'CTR-KR-RANDD-005', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3022', persona: 'P2', dept: 'RANDD', pos: 'CTR-KR-RANDD-006', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3023', persona: 'P5', dept: 'RANDD', pos: 'CTR-KR-RANDD-007', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3024', persona: 'P4', dept: 'RANDD', pos: 'CTR-KR-RANDD-008', grade: 'G6', empType: 'FULL_TIME', status: 'PROBATION' },
  { no: 'CTR-KR-3025', persona: 'P4', dept: 'RANDD', pos: 'CTR-KR-RANDD-007', grade: 'G6', empType: 'INTERN',    status: 'PROBATION' },
  { no: 'CTR-KR-3026', persona: 'P1', dept: 'RANDD', pos: 'CTR-KR-RANDD-008', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3027', persona: 'P6', dept: 'RANDD', pos: 'CTR-KR-RANDD-007', grade: 'G6', empType: 'CONTRACT',  status: 'ACTIVE' },
  { no: 'CTR-KR-3028', persona: 'P3', dept: 'RANDD', pos: 'CTR-KR-RANDD-008', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },

  // ── QA +10명 ──────────────────────────────────────────────
  { no: 'CTR-KR-3029', persona: 'P9', dept: 'QA', pos: 'CTR-KR-QA-002', grade: 'G4', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3030', persona: 'P9', dept: 'QA', pos: 'CTR-KR-QA-003', grade: 'G4', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3031', persona: 'P1', dept: 'QA', pos: 'CTR-KR-QA-004', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3032', persona: 'P1', dept: 'QA', pos: 'CTR-KR-QA-005', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3033', persona: 'P2', dept: 'QA', pos: 'CTR-KR-QA-004', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3034', persona: 'P5', dept: 'QA', pos: 'CTR-KR-QA-006', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3035', persona: 'P8', dept: 'QA', pos: 'CTR-KR-QA-007', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3036', persona: 'P8', dept: 'QA', pos: 'CTR-KR-QA-006', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3037', persona: 'P4', dept: 'QA', pos: 'CTR-KR-QA-007', grade: 'G6', empType: 'INTERN',    status: 'PROBATION' },
  { no: 'CTR-KR-3038', persona: 'P6', dept: 'QA', pos: 'CTR-KR-QA-006', grade: 'G6', empType: 'CONTRACT',  status: 'ACTIVE' },

  // ── SALES +9명 ────────────────────────────────────────────
  { no: 'CTR-KR-3039', persona: 'P9', dept: 'SALES', pos: 'CTR-KR-SALES-002', grade: 'G4', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3040', persona: 'P9', dept: 'SALES', pos: 'CTR-KR-SALES-003', grade: 'G4', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3041', persona: 'P1', dept: 'SALES', pos: 'CTR-KR-SALES-004', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3042', persona: 'P2', dept: 'SALES', pos: 'CTR-KR-SALES-005', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3043', persona: 'P5', dept: 'SALES', pos: 'CTR-KR-SALES-006', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3044', persona: 'P5', dept: 'SALES', pos: 'CTR-KR-SALES-007', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3045', persona: 'P4', dept: 'SALES', pos: 'CTR-KR-SALES-006', grade: 'G6', empType: 'FULL_TIME', status: 'PROBATION' },
  { no: 'CTR-KR-3046', persona: 'P6', dept: 'SALES', pos: 'CTR-KR-SALES-007', grade: 'G6', empType: 'CONTRACT',  status: 'ACTIVE' },
  { no: 'CTR-KR-3047', persona: 'P1', dept: 'SALES', pos: 'CTR-KR-SALES-004', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },

  // ── DEV +7명 ──────────────────────────────────────────────
  { no: 'CTR-KR-3048', persona: 'P9', dept: 'DEV', pos: 'CTR-KR-DEV-002', grade: 'G4', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3049', persona: 'P2', dept: 'DEV', pos: 'CTR-KR-DEV-003', grade: 'G4', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3050', persona: 'P1', dept: 'DEV', pos: 'CTR-KR-DEV-004', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3051', persona: 'P1', dept: 'DEV', pos: 'CTR-KR-DEV-005', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3052', persona: 'P4', dept: 'DEV', pos: 'CTR-KR-DEV-006', grade: 'G6', empType: 'INTERN',    status: 'PROBATION' },
  { no: 'CTR-KR-3053', persona: 'P5', dept: 'DEV', pos: 'CTR-KR-DEV-007', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3054', persona: 'P6', dept: 'DEV', pos: 'CTR-KR-DEV-006', grade: 'G6', empType: 'CONTRACT',  status: 'ACTIVE' },

  // ── PUR +6명 ──────────────────────────────────────────────
  { no: 'CTR-KR-3055', persona: 'P9', dept: 'PUR', pos: 'CTR-KR-PUR-002', grade: 'G4', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3056', persona: 'P1', dept: 'PUR', pos: 'CTR-KR-PUR-003', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3057', persona: 'P1', dept: 'PUR', pos: 'CTR-KR-PUR-004', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3058', persona: 'P2', dept: 'PUR', pos: 'CTR-KR-PUR-003', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3059', persona: 'P4', dept: 'PUR', pos: 'CTR-KR-PUR-005', grade: 'G6', empType: 'FULL_TIME', status: 'PROBATION' },
  { no: 'CTR-KR-3060', persona: 'P6', dept: 'PUR', pos: 'CTR-KR-PUR-005', grade: 'G6', empType: 'DISPATCH',  status: 'ACTIVE' },

  // ── FIN +5명 ──────────────────────────────────────────────
  { no: 'CTR-KR-3061', persona: 'P9', dept: 'FIN', pos: 'CTR-KR-FIN-002', grade: 'G4', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3062', persona: 'P1', dept: 'FIN', pos: 'CTR-KR-FIN-003', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3063', persona: 'P1', dept: 'FIN', pos: 'CTR-KR-FIN-004', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3064', persona: 'P7', dept: 'FIN', pos: 'CTR-KR-FIN-003', grade: 'G5', empType: 'FULL_TIME', status: 'ON_LEAVE' },
  { no: 'CTR-KR-3065', persona: 'P5', dept: 'FIN', pos: 'CTR-KR-FIN-005', grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },

  // ── HR +3명 ────────────────────────────────────────────────
  { no: 'CTR-KR-3066', persona: 'P9', dept: 'HR',   pos: 'CTR-KR-HR-003',   grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3067', persona: 'P1', dept: 'HR',   pos: 'CTR-KR-HR-004',   grade: 'G6', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3068', persona: 'P4', dept: 'HR',   pos: 'CTR-KR-HR-004',   grade: 'G6', empType: 'FULL_TIME', status: 'PROBATION' },

  // ── MGMT +2명 ─────────────────────────────────────────────
  { no: 'CTR-KR-3069', persona: 'P9', dept: 'MGMT', pos: 'CTR-KR-MGMT-004', grade: 'G4', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-KR-3070', persona: 'P10', dept:'MGMT', pos: 'CTR-KR-MGMT-005', grade: 'G5', empType: 'FULL_TIME', status: 'ACTIVE' },
]

// ────────────────────────────────────────────────────────────
// CN 직원 블루프린트
// ────────────────────────────────────────────────────────────
interface CnBlueprint {
  no:      string
  persona: string
  dept:    string        // 'MFG'|'QA'|'ADMIN'|'ENG'
  posCode: string        // 포지션 코드
  empType: 'FULL_TIME' | 'CONTRACT'
  status:  'ACTIVE' | 'PROBATION'
}

const CN_BLUEPRINTS: CnBlueprint[] = [
  // ── MFG +7명 ──────────────────────────────────────────────
  { no: 'CTR-CN-1001', persona: 'P9', dept: 'MFG',   posCode: 'CTR-CN-MFG-HEAD',  empType: 'FULL_TIME', status: 'ACTIVE'    },
  { no: 'CTR-CN-1002', persona: 'P8', dept: 'MFG',   posCode: 'CTR-CN-MFG-SR',    empType: 'FULL_TIME', status: 'ACTIVE'    },
  { no: 'CTR-CN-1003', persona: 'P1', dept: 'MFG',   posCode: 'CTR-CN-MFG-STAFF', empType: 'FULL_TIME', status: 'ACTIVE'    },
  { no: 'CTR-CN-1004', persona: 'P8', dept: 'MFG',   posCode: 'CTR-CN-MFG-STAFF', empType: 'FULL_TIME', status: 'ACTIVE'    },
  { no: 'CTR-CN-1005', persona: 'P2', dept: 'MFG',   posCode: 'CTR-CN-MFG-STAFF', empType: 'FULL_TIME', status: 'ACTIVE'    },
  { no: 'CTR-CN-1006', persona: 'P4', dept: 'MFG',   posCode: 'CTR-CN-MFG-STAFF', empType: 'CONTRACT',  status: 'PROBATION' },
  { no: 'CTR-CN-1007', persona: 'P8', dept: 'MFG',   posCode: 'CTR-CN-MFG-STAFF', empType: 'FULL_TIME', status: 'ACTIVE'    },

  // ── QA +3명 ───────────────────────────────────────────────
  { no: 'CTR-CN-1008', persona: 'P9', dept: 'QA',    posCode: 'CTR-CN-QA-HEAD',   empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-CN-1009', persona: 'P1', dept: 'QA',    posCode: 'CTR-CN-QA-SR',     empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-CN-1010', persona: 'P2', dept: 'QA',    posCode: 'CTR-CN-QA-STAFF',  empType: 'FULL_TIME', status: 'ACTIVE' },

  // ── ADMIN +4명 (신규 부서) ────────────────────────────────
  { no: 'CTR-CN-1011', persona: 'P9', dept: 'ADMIN', posCode: 'CTR-CN-ADMIN-HEAD', empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-CN-1012', persona: 'P1', dept: 'ADMIN', posCode: 'CTR-CN-ADMIN-SR',   empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-CN-1013', persona: 'P5', dept: 'ADMIN', posCode: 'CTR-CN-ADMIN-S1',   empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-CN-1014', persona: 'P4', dept: 'ADMIN', posCode: 'CTR-CN-ADMIN-S2',   empType: 'CONTRACT',  status: 'PROBATION' },

  // ── ENG +4명 (신규 부서) ──────────────────────────────────
  { no: 'CTR-CN-1015', persona: 'P9', dept: 'ENG',   posCode: 'CTR-CN-ENG-HEAD',  empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-CN-1016', persona: 'P1', dept: 'ENG',   posCode: 'CTR-CN-ENG-SR',    empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-CN-1017', persona: 'P2', dept: 'ENG',   posCode: 'CTR-CN-ENG-S1',    empType: 'FULL_TIME', status: 'ACTIVE' },
  { no: 'CTR-CN-1018', persona: 'P10', dept:'ENG',   posCode: 'CTR-CN-ENG-S2',    empType: 'FULL_TIME', status: 'ACTIVE' },
]

// ────────────────────────────────────────────────────────────
// 메인 Seed 함수
// ────────────────────────────────────────────────────────────
export async function seedNewEmployees(prisma: PrismaClient): Promise<void> {
  console.log('\n🧑‍💼 Session 1: Seeding new employees (KR +70, CN +18)...\n')

  // ── 컨텍스트 조회 ──────────────────────────────────────────
  const ctrKrId   = deterministicUUID('company', 'CTR')
  const ctrCnId   = deterministicUUID('company', 'CTR-CN')
  const employeeRole = await prisma.role.findFirst({ where: { code: 'EMPLOYEE' } })
  const managerRole  = await prisma.role.findFirst({ where: { code: 'MANAGER' } })
  if (!employeeRole || !managerRole) {
    throw new Error('EMPLOYEE or MANAGER role not found in DB. Run base seed first.')
  }
  const employeeRoleId = employeeRole.id
  const managerRoleId  = managerRole.id

  // 그레이드 맵 (CTR)
  const krGrade = (code: string) => deterministicUUID('grade', `CTR-KR:${code}`)

  // CTR 직무 카테고리
  const krProductionCatId = deterministicUUID('jobcat', 'CTR-KR:PRODUCTION')
  const krOfficeCatId     = deterministicUUID('jobcat', 'CTR-KR:OFFICE')
  const krRndCatId        = deterministicUUID('jobcat', 'CTR-KR:R_AND_D')

  // 부서 카테고리 매핑
  const deptToCat: Record<string, string> = {
    MFG: krProductionCatId, QA: krProductionCatId,
    RANDD: krRndCatId,
    SALES: krOfficeCatId, DEV: krOfficeCatId, PUR: krOfficeCatId,
    FIN: krOfficeCatId, HR: krOfficeCatId, MGMT: krOfficeCatId,
  }

  // ── STEP 1: CTR-CN 신규 부서 생성 (ADMIN, ENG) ─────────────
  console.log('📌 Creating CTR-CN new departments (ADMIN, ENG)...')

  const cnDepts = [
    { code: 'ADMIN', name: '行政部', nameEn: 'Administration',  level: 1, sortOrder: 3 },
    { code: 'ENG',   name: '工程部', nameEn: 'Engineering Dept', level: 1, sortOrder: 4 },
  ]

  const cnDeptMap: Record<string, string> = {}

  for (const d of cnDepts) {
    const id = deterministicUUID('dept', `CTR-CN:${d.code}`)
    await prisma.department.upsert({
      where:  { companyId_code: { companyId: ctrCnId, code: d.code } },
      update: { name: d.name, nameEn: d.nameEn },
      create: { id, companyId: ctrCnId, code: d.code, name: d.name, nameEn: d.nameEn, level: d.level, sortOrder: d.sortOrder },
    })
    cnDeptMap[d.code] = id
  }

  // 기존 CTR-CN 부서도 맵에 추가
  cnDeptMap['MFG'] = deterministicUUID('dept', 'CTR-CN:MFG')
  cnDeptMap['QA']  = deterministicUUID('dept', 'CTR-CN:QA')

  console.log('  ✅ 2 new CTR-CN departments (ADMIN, ENG)')

  // ── STEP 2: CTR-CN 신규 포지션 (ADMIN/ENG + 확장) ────────
  console.log('📌 Creating CTR-CN new positions...')

  // GM ID 참조 (이미 존재)
  const cnGmId = deterministicUUID('pos', 'CTR-CN-GM-001')

  const cnNewDeptPositions = [
    // ADMIN 부서
    { code: 'CTR-CN-ADMIN-HEAD', titleKo: 'Admin Head', titleEn: 'Admin Head', deptCode: 'ADMIN', reportsTo: 'CTR-CN-GM-001' },
    { code: 'CTR-CN-ADMIN-SR',   titleKo: 'Admin Senior', titleEn: 'Senior Admin Specialist', deptCode: 'ADMIN', reportsTo: 'CTR-CN-ADMIN-HEAD' },
    { code: 'CTR-CN-ADMIN-S1',   titleKo: 'Admin Staff 1', titleEn: 'Admin Staff A', deptCode: 'ADMIN', reportsTo: 'CTR-CN-ADMIN-SR' },
    { code: 'CTR-CN-ADMIN-S2',   titleKo: 'Admin Staff 2', titleEn: 'Admin Staff B', deptCode: 'ADMIN', reportsTo: 'CTR-CN-ADMIN-SR' },
    // ENG 부서
    { code: 'CTR-CN-ENG-HEAD', titleKo: 'ENG Head', titleEn: 'Engineering Head', deptCode: 'ENG', reportsTo: 'CTR-CN-GM-001' },
    { code: 'CTR-CN-ENG-SR',   titleKo: 'ENG Senior', titleEn: 'Senior Engineer', deptCode: 'ENG', reportsTo: 'CTR-CN-ENG-HEAD' },
    { code: 'CTR-CN-ENG-S1',   titleKo: 'ENG Staff 1', titleEn: 'Engineer A', deptCode: 'ENG', reportsTo: 'CTR-CN-ENG-SR' },
    { code: 'CTR-CN-ENG-S2',   titleKo: 'ENG Staff 2', titleEn: 'Engineer B', deptCode: 'ENG', reportsTo: 'CTR-CN-ENG-SR' },
  ]

  const cnPosMap: Record<string, string> = {}

  // First pass: create positions
  for (const p of cnNewDeptPositions) {
    const id = deterministicUUID('pos', p.code)
    const deptId = cnDeptMap[p.deptCode]
    await prisma.position.upsert({
      where:  { id },
      update: { titleKo: p.titleKo, titleEn: p.titleEn },
      create: { id, code: p.code, titleKo: p.titleKo, titleEn: p.titleEn, companyId: ctrCnId, departmentId: deptId },
    })
    cnPosMap[p.code] = id
  }

  // Second pass: set reportsTo
  for (const p of cnNewDeptPositions) {
    const id = cnPosMap[p.code]
    const reportsToId = p.reportsTo === 'CTR-CN-GM-001'
      ? cnGmId
      : cnPosMap[p.reportsTo]
    if (reportsToId) {
      await prisma.position.update({
        where: { id },
        data:  { reportsToPositionId: reportsToId },
      })
    }
  }

  console.log(`  ✅ ${cnNewDeptPositions.length} new CTR-CN positions`)

  // ── STEP 3: CTR 신규 직원 70명 ────────────────────────
  console.log('📌 Seeding CTR-KR new employees (70)...')
  let krCount = 0
  let krRoleCount = 0

  for (let i = 0; i < KR_BLUEPRINTS.length; i++) {
    const bp  = KR_BLUEPRINTS[i]
    const nm  = krName(i)
    const empId     = deterministicUUID('employee',   `new-kr:${bp.no}`)
    const assignId  = deterministicUUID('assignment', `new-kr:${bp.no}`)
    const authId    = deterministicUUID('auth',       `new-kr:${bp.no}`)
    const ssoId     = deterministicUUID('sso',        `new-kr:${bp.no}`)
    const ssoAcctId = deterministicUUID('sso-acct',   `new-kr:${bp.no}`)

    const deptId  = deterministicUUID('dept', `CTR-KR:${bp.dept}`)
    const gradeId = krGrade(bp.grade)
    const catId   = deptToCat[bp.dept] ?? krOfficeCatId
    const posId   = deterministicUUID('pos', bp.pos)
    const email   = `${bp.no.toLowerCase().replace('ctr-kr-', 'kr')}@ctr.co.kr`
    const hd      = hireDate(bp.persona, i + 100)

    // Employee
    const emp = await prisma.employee.upsert({
      where:  { employeeNo: bp.no },
      update: { name: nm.name, nameEn: nm.nameEn },
      create:  {
        id: empId, employeeNo: bp.no, name: nm.name, nameEn: nm.nameEn,
        email, hireDate: hd,
      },
    })
    const actualEmpId = emp.id

    // EmployeeAssignment
    const existingA = await prisma.employeeAssignment.findFirst({
      where: { employeeId: actualEmpId, isPrimary: true, endDate: null },
    })
    if (!existingA) {
      const assignData: Parameters<typeof prisma.employeeAssignment.create>[0]['data'] = {
        id:             assignId,
        employeeId:     actualEmpId,
        companyId:      ctrKrId,
        departmentId:   deptId,
        positionId:     posId,
        jobGradeId:     gradeId,
        jobCategoryId:  catId,
        effectiveDate:  hd,
        changeType:     'HIRE',
        employmentType: bp.empType,
        status:         bp.status,
        isPrimary:      true,
      }
      // 계약직/인턴: 계약 종료일
      if (bp.empType === 'CONTRACT' || bp.empType === 'INTERN') {
        assignData.endDate = contractEndDate(i)
        assignData.contractType = bp.empType === 'INTERN' ? 'FIXED_TERM' : 'OUTSOURCED'
      }
      // duplicate id 방지: 이미 assignId 존재하면 skip
      const existingById = await prisma.employeeAssignment.findFirst({ where: { id: assignId } })
      if (!existingById) {
        await prisma.employeeAssignment.create({ data: assignData })
      }
    }

    // EmployeeAuth
    await prisma.employeeAuth.upsert({
      where:  { employeeId: actualEmpId },
      update: { passwordHash: TEST_PASSWORD_HASH },
      create: { id: authId, employeeId: actualEmpId, passwordHash: TEST_PASSWORD_HASH },
    })

    // SsoIdentity
    await prisma.ssoIdentity.upsert({
      where:  { provider_providerAccountId: { provider: 'azure-ad', providerAccountId: ssoAcctId } },
      update: { email },
      create: { id: ssoId, employeeId: actualEmpId, provider: 'azure-ad', providerAccountId: ssoAcctId, email },
    })

    // EmployeeRole: EMPLOYEE (모두)
    const empRoleKey = deterministicUUID('emprole', `new-kr:${bp.no}:EMPLOYEE`)
    await prisma.employeeRole.upsert({
      where:  { employeeId_roleId_companyId: { employeeId: actualEmpId, roleId: employeeRoleId, companyId: ctrKrId } },
      update: {},
      create: { id: empRoleKey, employeeId: actualEmpId, roleId: employeeRoleId, companyId: ctrKrId, startDate: hd },
    })

    // EmployeeRole: MANAGER (P9 페르소나)
    if (bp.persona === 'P9') {
      const mgrRoleKey = deterministicUUID('emprole', `new-kr:${bp.no}:MANAGER`)
      await prisma.employeeRole.upsert({
        where:  { employeeId_roleId_companyId: { employeeId: actualEmpId, roleId: managerRoleId, companyId: ctrKrId } },
        update: {},
        create: { id: mgrRoleKey, employeeId: actualEmpId, roleId: managerRoleId, companyId: ctrKrId, startDate: hd },
      })
      krRoleCount++
    }

    krCount++

    if (krCount % 10 === 0) {
      console.log(`    … ${krCount} / ${KR_BLUEPRINTS.length} KR employees done`)
    }
  }

  console.log(`  ✅ ${krCount} CTR-KR new employees (${krRoleCount} with MANAGER role)`)

  // ── STEP 4: CTR-CN 신규 직원 18명 ────────────────────────
  console.log('📌 Seeding CTR-CN new employees (18)...')
  let cnCount = 0
  let cnRoleCount = 0

  // CTR-CN 그레이드 (S3 = 기존 합성 급여 직원 사용 레벨)
  // CTR-CN에는 KR 등급 없음 → 글로벌 기본 조회
  const cnJobGrade = await prisma.jobGrade.findFirst({ where: { code: 'S3' } })
  const cnGradeId  = cnJobGrade?.id ?? null

  const cnOfficeCatId = deterministicUUID('jobcat', 'CTR-CN:OFFICE')
  const cnProdCatId   = deterministicUUID('jobcat', 'CTR-CN:PRODUCTION')

  const cnDeptToCat: Record<string, string> = {
    MFG: cnProdCatId, QA: cnProdCatId,
    ADMIN: cnOfficeCatId, ENG: cnOfficeCatId,
  }

  for (let i = 0; i < CN_BLUEPRINTS.length; i++) {
    const bp  = CN_BLUEPRINTS[i]
    const nm  = cnName(i)
    const empId     = deterministicUUID('employee',   `new-cn:${bp.no}`)
    const assignId  = deterministicUUID('assignment', `new-cn:${bp.no}`)
    const authId    = deterministicUUID('auth',       `new-cn:${bp.no}`)
    const ssoId     = deterministicUUID('sso',        `new-cn:${bp.no}`)
    const ssoAcctId = deterministicUUID('sso-acct',   `new-cn:${bp.no}`)

    const deptId  = cnDeptMap[bp.dept] ?? deterministicUUID('dept', `CTR-CN:${bp.dept}`)
    const posId   = cnPosMap[bp.posCode] ?? deterministicUUID('pos', bp.posCode)
    const catId   = cnDeptToCat[bp.dept] ?? cnOfficeCatId
    const email   = `${bp.no.toLowerCase().replace('ctr-cn-', 'cn')}@ctr-cn.com`
    const hd      = hireDate(bp.persona, i + 200)

    // Employee (CN)
    const cnEmp = await prisma.employee.upsert({
      where:  { employeeNo: bp.no },
      update: { name: nm.name, nameEn: nm.nameEn },
      create: {
        id: empId, employeeNo: bp.no, name: nm.name, nameEn: nm.nameEn,
        email, hireDate: hd,
      },
    })
    const actualCnEmpId = cnEmp.id

    // EmployeeAssignment
    const existingA = await prisma.employeeAssignment.findFirst({
      where: { employeeId: actualCnEmpId, isPrimary: true, endDate: null },
    })
    if (!existingA) {
      const assignData: Parameters<typeof prisma.employeeAssignment.create>[0]['data'] = {
        id:             assignId,
        employeeId:     actualCnEmpId,
        companyId:      ctrCnId,
        departmentId:   deptId,
        positionId:     posId,
        jobGradeId:     cnGradeId,
        jobCategoryId:  catId,
        effectiveDate:  hd,
        changeType:     'HIRE',
        employmentType: bp.empType,
        status:         bp.status,
        isPrimary:      true,
      }
      if (bp.empType === 'CONTRACT') {
        assignData.endDate = contractEndDate(i)
        assignData.contractType = 'OUTSOURCED'
      }
      const existingById = await prisma.employeeAssignment.findFirst({ where: { id: assignId } })
      if (!existingById) {
        await prisma.employeeAssignment.create({ data: assignData })
      }
    }

    // EmployeeAuth (CN)
    await prisma.employeeAuth.upsert({
      where:  { employeeId: actualCnEmpId },
      update: { passwordHash: TEST_PASSWORD_HASH },
      create: { id: authId, employeeId: actualCnEmpId, passwordHash: TEST_PASSWORD_HASH },
    })

    // SsoIdentity (CN)
    await prisma.ssoIdentity.upsert({
      where:  { provider_providerAccountId: { provider: 'azure-ad', providerAccountId: ssoAcctId } },
      update: { email },
      create: { id: ssoId, employeeId: actualCnEmpId, provider: 'azure-ad', providerAccountId: ssoAcctId, email },
    })

    // EmployeeRole: EMPLOYEE
    const empRoleKey = deterministicUUID('emprole', `new-cn:${bp.no}:EMPLOYEE`)
    await prisma.employeeRole.upsert({
      where:  { employeeId_roleId_companyId: { employeeId: actualCnEmpId, roleId: employeeRoleId, companyId: ctrCnId } },
      update: {},
      create: { id: empRoleKey, employeeId: actualCnEmpId, roleId: employeeRoleId, companyId: ctrCnId, startDate: hd },
    })

    // EmployeeRole: MANAGER (P9)
    if (bp.persona === 'P9') {
      const mgrRoleKey = deterministicUUID('emprole', `new-cn:${bp.no}:MANAGER`)
      await prisma.employeeRole.upsert({
        where:  { employeeId_roleId_companyId: { employeeId: actualCnEmpId, roleId: managerRoleId, companyId: ctrCnId } },
        update: {},
        create: { id: mgrRoleKey, employeeId: actualCnEmpId, roleId: managerRoleId, companyId: ctrCnId, startDate: hd },
      })
      cnRoleCount++
    }

    cnCount++
  }

  console.log(`  ✅ ${cnCount} CTR-CN new employees (${cnRoleCount} with MANAGER role)`)

  // ── STEP 5: 최종 카운트 ──────────────────────────────────
  const totalEmp = await prisma.employee.count()
  const totalKrEmp = await prisma.employeeAssignment.count({
    where: { companyId: ctrKrId, isPrimary: true, endDate: null },
  })
  const totalCnEmp = await prisma.employeeAssignment.count({
    where: { companyId: ctrCnId, isPrimary: true, endDate: null },
  })

  console.log('\n======================================')
  console.log('🌱 Session 1 Employee Seed Complete!')
  console.log('======================================')
  console.log(`  Total Employees (all co.): ${totalEmp}`)
  console.log(`  CTR-KR active assignments: ${totalKrEmp}`)
  console.log(`  CTR-CN active assignments: ${totalCnEmp}`)
  console.log(`  New KR employees added:    ${krCount}`)
  console.log(`  New CN employees added:    ${cnCount}`)
  console.log(`  KR Manager roles added:    ${krRoleCount}`)
  console.log(`  CN Manager roles added:    ${cnRoleCount}`)
  console.log('======================================\n')
}
