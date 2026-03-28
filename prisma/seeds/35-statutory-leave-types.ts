// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Seed: Statutory Leave Types per Company
// 12개 법인별 휴가유형 시드 (공통규정 취업규칙 rev.17 + 경조사지원 지침 REV12 기반)
//
// 국내 7개: CTR-HOLD, CTR, CTR-MOB, CTR-ECO, CTR-ROB, CTR-ENR, CTR-FML → 공통규정 적용
// 해외 5개: CTR-CN, CTR-US, CTR-VN, CTR-RU, CTR-EU → 각국 규정/법정 기준
// ═══════════════════════════════════════════════════════════

import type { PrismaClient } from '../../src/generated/prisma/client'

interface LeaveTypeSeed {
  code: string
  name: string
  nameEn: string
  isPaid: boolean
  allowHalfDay: boolean
  requiresProof: boolean
  maxConsecutiveDays?: number
  minAdvanceDays?: number
  displayOrder: number
  // 규정 정합성 필드
  category?: string
  subcategory?: string
  countingMethod?: string   // 'business_day' | 'calendar_day'
  includesHolidays?: boolean
  isSplittable?: boolean
  splitDeadlineDays?: number
  maxPerYear?: number
  paidDaysPerYear?: number
  condolenceAmount?: number
}

interface CompanyLeaveTypes {
  companyCode: string
  types: LeaveTypeSeed[]
}

// ═══════════════════════════════════════════════════════════
// 국내 공통규정 (취업규칙 rev.17 + 경조사지원 지침 REV12)
// CTR-HOLD, CTR, CTR-MOB, CTR-ECO, CTR-ROB, CTR-ENR, CTR-FML 동일 적용
// ═══════════════════════════════════════════════════════════
const DOMESTIC_COMMON_TYPES: LeaveTypeSeed[] = [
  // ── 보건/건강 ──
  { code: 'menstrual', name: '생리휴가', nameEn: 'Menstrual Leave',
    isPaid: true, allowHalfDay: false, requiresProof: false, maxConsecutiveDays: 1,
    category: 'health', countingMethod: 'business_day', displayOrder: 30 },
  { code: 'sick', name: '병가', nameEn: 'Sick Leave',
    isPaid: true, allowHalfDay: false, requiresProof: true,
    category: 'health', countingMethod: 'business_day', displayOrder: 31 },

  // ── 경조 — 축하 (제49조) ──
  { code: 'marriage_self', name: '본인결혼', nameEn: 'Marriage (Self)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 7,
    category: 'family_event', subcategory: 'celebration',
    countingMethod: 'calendar_day', includesHolidays: true,
    condolenceAmount: 500000, displayOrder: 10 },
  { code: 'childbirth_spouse', name: '배우자출산휴가', nameEn: 'Spouse Childbirth Leave',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 10,
    category: 'family_event', subcategory: 'celebration',
    countingMethod: 'calendar_day', includesHolidays: true,
    isSplittable: true, splitDeadlineDays: 90,
    condolenceAmount: 500000, displayOrder: 11 },
  { code: 'marriage_child', name: '자녀결혼', nameEn: 'Marriage (Child)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 2,
    category: 'family_event', subcategory: 'celebration',
    countingMethod: 'calendar_day', includesHolidays: true,
    condolenceAmount: 300000, displayOrder: 12 },
  { code: 'marriage_sibling', name: '형제자매결혼', nameEn: 'Marriage (Sibling)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 1,
    category: 'family_event', subcategory: 'celebration',
    countingMethod: 'calendar_day', includesHolidays: true,
    displayOrder: 13 },
  { code: 'parent_hwangap', name: '부모회갑', nameEn: 'Parent 60th Birthday',
    isPaid: true, allowHalfDay: false, requiresProof: false, maxConsecutiveDays: 1,
    category: 'family_event', subcategory: 'celebration',
    countingMethod: 'calendar_day', includesHolidays: true,
    condolenceAmount: 200000, displayOrder: 14 },

  // ── 경조 — 조의 (제49조 + 경조사지원 지침 REV12) ──
  { code: 'bereavement_parent', name: '부모사망', nameEn: 'Bereavement (Parent)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 7,
    category: 'family_event', subcategory: 'condolence',
    countingMethod: 'calendar_day', includesHolidays: true,
    condolenceAmount: 500000, displayOrder: 20 },
  { code: 'bereavement_spouse', name: '배우자사망', nameEn: 'Bereavement (Spouse)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 7,
    category: 'family_event', subcategory: 'condolence',
    countingMethod: 'calendar_day', includesHolidays: true,
    condolenceAmount: 500000, displayOrder: 21 },
  { code: 'bereavement_spouse_parent', name: '배우자부모사망', nameEn: 'Bereavement (In-law Parent)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 6,
    category: 'family_event', subcategory: 'condolence',
    countingMethod: 'calendar_day', includesHolidays: true,
    condolenceAmount: 500000, displayOrder: 22 },
  { code: 'bereavement_child', name: '자녀사망', nameEn: 'Bereavement (Child)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 6,
    category: 'family_event', subcategory: 'condolence',
    countingMethod: 'calendar_day', includesHolidays: true,
    condolenceAmount: 500000, displayOrder: 23 },
  { code: 'bereavement_heir', name: '승중상', nameEn: 'Bereavement (Heir)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 6,
    category: 'family_event', subcategory: 'condolence',
    countingMethod: 'calendar_day', includesHolidays: true,
    condolenceAmount: 250000, displayOrder: 24 },
  { code: 'bereavement_grandparent', name: '조부모사망', nameEn: 'Bereavement (Grandparent)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3,
    category: 'family_event', subcategory: 'condolence',
    countingMethod: 'calendar_day', includesHolidays: true,
    condolenceAmount: 250000, displayOrder: 25 },
  { code: 'bereavement_sibling', name: '형제자매사망', nameEn: 'Bereavement (Sibling)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3,
    category: 'family_event', subcategory: 'condolence',
    countingMethod: 'calendar_day', includesHolidays: true,
    displayOrder: 26 },
  { code: 'bereavement_uncle', name: '백숙부모사망', nameEn: 'Bereavement (Uncle/Aunt)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3,
    category: 'family_event', subcategory: 'condolence',
    countingMethod: 'calendar_day', includesHolidays: true,
    displayOrder: 27 },
  { code: 'bereavement_spouse_sibling', name: '배우자형제자매사망', nameEn: 'Bereavement (In-law Sibling)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 2,
    category: 'family_event', subcategory: 'condolence',
    countingMethod: 'calendar_day', includesHolidays: true,
    displayOrder: 28 },
  { code: 'bereavement_spouse_gp', name: '배우자조부모사망', nameEn: 'Bereavement (In-law Grandparent)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 1,
    category: 'family_event', subcategory: 'condolence',
    countingMethod: 'calendar_day', includesHolidays: true,
    condolenceAmount: 250000, displayOrder: 29 },

  // ── 모성보호 (제48조) ──
  { code: 'maternity', name: '출산전후휴가', nameEn: 'Maternity Leave',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 90,
    category: 'maternity', countingMethod: 'calendar_day', includesHolidays: true,
    paidDaysPerYear: 60, displayOrder: 40 },
  { code: 'maternity_multiple', name: '출산전후(다태아)', nameEn: 'Maternity Leave (Multiple)',
    isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 120,
    category: 'maternity', countingMethod: 'calendar_day', includesHolidays: true,
    paidDaysPerYear: 75, displayOrder: 41 },
  { code: 'fertility', name: '난임치료휴가', nameEn: 'Fertility Treatment Leave',
    isPaid: true, allowHalfDay: false, requiresProof: true,
    category: 'health', countingMethod: 'business_day',
    maxPerYear: 3, paidDaysPerYear: 1, displayOrder: 42 },

  // ── 기타 (제50조) ──
  { code: 'refresh', name: '리프레쉬휴가', nameEn: 'Refresh Leave',
    isPaid: true, allowHalfDay: false, requiresProof: false, maxConsecutiveDays: 5,
    category: 'other', countingMethod: 'business_day', displayOrder: 50 },
  { code: 'military_reserve', name: '예비군훈련', nameEn: 'Military Reserve Training',
    isPaid: true, allowHalfDay: false, requiresProof: true,
    category: 'military', countingMethod: 'calendar_day', includesHolidays: true,
    displayOrder: 51 },
  { code: 'civil_defense', name: '민방위훈련', nameEn: 'Civil Defense Training',
    isPaid: true, allowHalfDay: false, requiresProof: true,
    category: 'military', countingMethod: 'calendar_day', includesHolidays: true,
    displayOrder: 52 },
  { code: 'unpaid', name: '무급휴가', nameEn: 'Unpaid Leave',
    isPaid: false, allowHalfDay: true, requiresProof: false,
    category: 'other', countingMethod: 'business_day', displayOrder: 99 },
]

const DOMESTIC_COMPANIES = ['CTR-HQ', 'CTR-KR', 'CTR-MOB', 'CTR-ECO', 'CTR-ROB', 'CTR-ENG', 'FML']

// ═══════════════════════════════════════════════════════════
// 해외법인별 휴가유형
// ═══════════════════════════════════════════════════════════

const OVERSEAS_LEAVE_TYPES: CompanyLeaveTypes[] = [
  // ── CTR-CN: 중국 (장쑤성 장가항) ─────────────────────────
  // 현지채용관리규정 CP-G-04-061 rev.16 + 중국 노동법 + 장쑤성 지방규정
  {
    companyCode: 'CTR-CN',
    types: [
      { code: 'annual', name: '年假', nameEn: 'Annual Leave',
        isPaid: true, allowHalfDay: true, requiresProof: false,
        category: 'annual', countingMethod: 'business_day', displayOrder: 1 },
      { code: 'sick', name: '病假', nameEn: 'Sick Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true,
        category: 'health', countingMethod: 'business_day', displayOrder: 2 },
      { code: 'marriage', name: '婚假', nameEn: 'Marriage Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 13,
        category: 'family_event', subcategory: 'celebration',
        countingMethod: 'calendar_day', includesHolidays: true, displayOrder: 10 },
      { code: 'maternity', name: '产假', nameEn: 'Maternity Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 158,
        category: 'maternity', countingMethod: 'calendar_day', includesHolidays: true,
        displayOrder: 20 },
      { code: 'maternity_difficult', name: '难产假', nameEn: 'Maternity Leave (Difficult)',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 173,
        category: 'maternity', countingMethod: 'calendar_day', includesHolidays: true,
        displayOrder: 21 },
      { code: 'paternity', name: '陪产假', nameEn: 'Paternity Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 15,
        category: 'maternity', countingMethod: 'calendar_day', includesHolidays: true,
        displayOrder: 22 },
      { code: 'childcare', name: '育儿假', nameEn: 'Childcare Leave',
        isPaid: true, allowHalfDay: true, requiresProof: false,
        category: 'maternity', countingMethod: 'business_day',
        maxPerYear: 10, displayOrder: 23 },
      { code: 'elder_care', name: '独生子女护理假', nameEn: 'Elder Care Leave',
        isPaid: true, allowHalfDay: true, requiresProof: true,
        category: 'other', countingMethod: 'business_day',
        maxPerYear: 5, displayOrder: 30 },
      { code: 'bereavement_parent', name: '父母丧假', nameEn: 'Bereavement (Parent)',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3,
        category: 'family_event', subcategory: 'condolence',
        countingMethod: 'calendar_day', includesHolidays: true, displayOrder: 40 },
      { code: 'bereavement_spouse_parent', name: '配偶父母丧假', nameEn: 'Bereavement (In-law Parent)',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3,
        category: 'family_event', subcategory: 'condolence',
        countingMethod: 'calendar_day', includesHolidays: true, displayOrder: 41 },
      { code: 'bereavement_other', name: '其他丧假', nameEn: 'Bereavement (Other)',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 1,
        category: 'family_event', subcategory: 'condolence',
        countingMethod: 'calendar_day', includesHolidays: true, displayOrder: 42 },
      { code: 'refresh', name: '探亲假', nameEn: 'Refresh Leave',
        isPaid: true, allowHalfDay: false, requiresProof: false, maxConsecutiveDays: 5,
        category: 'other', countingMethod: 'business_day', displayOrder: 50 },
      { code: 'unpaid', name: '事假', nameEn: 'Unpaid Leave',
        isPaid: false, allowHalfDay: true, requiresProof: false,
        category: 'other', countingMethod: 'business_day', displayOrder: 99 },
    ],
  },

  // ── CTR-VN: 베트남 ──────────────────────────────────────
  // 취업규정 CP-V-19-05 + 베트남 노동법 (2019 Labor Code)
  {
    companyCode: 'CTR-VN',
    types: [
      { code: 'annual', name: 'Nghỉ phép năm', nameEn: 'Annual Leave',
        isPaid: true, allowHalfDay: true, requiresProof: false,
        category: 'annual', countingMethod: 'business_day', displayOrder: 1 },
      { code: 'sick', name: 'Nghỉ ốm', nameEn: 'Sick Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 30,
        category: 'health', countingMethod: 'business_day', displayOrder: 2 },
      { code: 'maternity', name: 'Nghỉ thai sản', nameEn: 'Maternity Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 180,
        category: 'maternity', countingMethod: 'calendar_day', includesHolidays: true,
        displayOrder: 20 },
      { code: 'paternity', name: 'Nghỉ cha', nameEn: 'Paternity Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 14,
        category: 'maternity', countingMethod: 'calendar_day', includesHolidays: true,
        displayOrder: 21 },
      { code: 'marriage', name: 'Nghỉ kết hôn', nameEn: 'Marriage Leave (Self)',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3,
        category: 'family_event', subcategory: 'celebration',
        countingMethod: 'business_day', displayOrder: 10 },
      { code: 'marriage_child', name: 'Nghỉ kết hôn con', nameEn: 'Marriage Leave (Child)',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 1,
        category: 'family_event', subcategory: 'celebration',
        countingMethod: 'business_day', displayOrder: 11 },
      { code: 'bereavement_parent', name: 'Tang cha mẹ/vợ chồng/con', nameEn: 'Bereavement (Parent/Spouse/Child)',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3,
        category: 'family_event', subcategory: 'condolence',
        countingMethod: 'business_day', displayOrder: 40 },
      { code: 'bereavement_other', name: 'Tang ông bà/anh chị em', nameEn: 'Bereavement (Grandparent/Sibling)',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3,
        category: 'family_event', subcategory: 'condolence',
        countingMethod: 'business_day', displayOrder: 41 },
      { code: 'unpaid', name: 'Nghỉ không lương', nameEn: 'Unpaid Leave',
        isPaid: false, allowHalfDay: true, requiresProof: false,
        category: 'other', countingMethod: 'business_day', displayOrder: 99 },
    ],
  },

  // ── CTR-RU: 러시아 ──────────────────────────────────────
  // 내부규정 제36~44조 + 러시아 노동법
  {
    companyCode: 'CTR-RU',
    types: [
      { code: 'annual', name: 'Ежегодный отпуск', nameEn: 'Annual Leave',
        isPaid: true, allowHalfDay: false, requiresProof: false,
        category: 'annual', countingMethod: 'calendar_day', includesHolidays: false,
        displayOrder: 1 },
      { code: 'sick', name: 'Больничный', nameEn: 'Sick Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true,
        category: 'health', countingMethod: 'calendar_day', displayOrder: 2 },
      { code: 'maternity', name: 'Декретный отпуск', nameEn: 'Maternity Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 140,
        category: 'maternity', countingMethod: 'calendar_day', includesHolidays: true,
        displayOrder: 20 },
      { code: 'paternity', name: 'Отцовский отпуск', nameEn: 'Paternity Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 10,
        category: 'maternity', countingMethod: 'calendar_day', includesHolidays: true,
        displayOrder: 21 },
      { code: 'childcare', name: 'Отпуск по уходу за ребёнком', nameEn: 'Childcare Leave',
        isPaid: false, allowHalfDay: false, requiresProof: true,
        category: 'maternity', countingMethod: 'calendar_day', displayOrder: 22 },
      { code: 'menstrual', name: 'Женский день здоровья', nameEn: 'Health Day (Women)',
        isPaid: true, allowHalfDay: false, requiresProof: false, maxConsecutiveDays: 1,
        category: 'health', countingMethod: 'business_day', displayOrder: 30 },
      { code: 'refresh', name: 'Отпуск отдыха', nameEn: 'Refresh Leave',
        isPaid: true, allowHalfDay: false, requiresProof: false, maxConsecutiveDays: 5,
        category: 'other', countingMethod: 'business_day', displayOrder: 50 },
      { code: 'marriage_self', name: 'Свадебный отпуск (свой)', nameEn: 'Marriage (Self)',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 7,
        category: 'family_event', subcategory: 'celebration',
        countingMethod: 'calendar_day', includesHolidays: true, displayOrder: 10 },
      { code: 'bereavement_parent', name: 'Отпуск при смерти родителей', nameEn: 'Bereavement (Parent)',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 7,
        category: 'family_event', subcategory: 'condolence',
        countingMethod: 'calendar_day', includesHolidays: true, displayOrder: 40 },
      { code: 'bereavement_spouse', name: 'Отпуск при смерти супруга', nameEn: 'Bereavement (Spouse)',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 7,
        category: 'family_event', subcategory: 'condolence',
        countingMethod: 'calendar_day', includesHolidays: true, displayOrder: 41 },
      { code: 'family_care_leave', name: 'Отпуск по уходу за семьёй', nameEn: 'Family Care Leave',
        isPaid: false, allowHalfDay: false, requiresProof: true,
        category: 'other', countingMethod: 'business_day',
        maxPerYear: 90, displayOrder: 60 },
      { code: 'family_care_vacation', name: 'Семейный отпуск', nameEn: 'Family Care Vacation',
        isPaid: true, allowHalfDay: true, requiresProof: false,
        category: 'other', countingMethod: 'business_day',
        maxPerYear: 10, displayOrder: 61 },
      { code: 'unpaid', name: 'Отпуск без содержания', nameEn: 'Unpaid Leave',
        isPaid: false, allowHalfDay: false, requiresProof: false,
        category: 'other', countingMethod: 'business_day', displayOrder: 99 },
    ],
  },

  // ── CTR-EU: 폴란드 ──────────────────────────────────────
  // Work Regulation + 폴란드 Kodeks Pracy (법정 기준)
  {
    companyCode: 'CTR-EU',
    types: [
      { code: 'annual', name: 'Urlop wypoczynkowy', nameEn: 'Annual Leave',
        isPaid: true, allowHalfDay: true, requiresProof: false,
        category: 'annual', countingMethod: 'business_day', displayOrder: 1 },
      { code: 'sick', name: 'Zwolnienie lekarskie', nameEn: 'Sick Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 33,
        category: 'health', countingMethod: 'business_day', displayOrder: 2 },
      { code: 'maternity', name: 'Urlop macierzyński', nameEn: 'Maternity Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 140,
        category: 'maternity', countingMethod: 'calendar_day', includesHolidays: true,
        displayOrder: 20 },
      { code: 'paternity', name: 'Urlop ojcowski', nameEn: 'Paternity Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 14,
        category: 'maternity', countingMethod: 'calendar_day', includesHolidays: true,
        displayOrder: 21 },
      { code: 'childcare', name: 'Urlop wychowawczy', nameEn: 'Childcare Leave',
        isPaid: false, allowHalfDay: false, requiresProof: true,
        category: 'maternity', countingMethod: 'calendar_day', displayOrder: 22 },
      { code: 'bereavement_close', name: 'Urlop okolicznościowy (bliski)', nameEn: 'Bereavement (Close Family)',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 2,
        category: 'family_event', subcategory: 'condolence',
        countingMethod: 'business_day', displayOrder: 40 },
      { code: 'bereavement_other', name: 'Urlop okolicznościowy (inny)', nameEn: 'Bereavement (Other)',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 1,
        category: 'family_event', subcategory: 'condolence',
        countingMethod: 'business_day', displayOrder: 41 },
      { code: 'marriage', name: 'Urlop ślubny', nameEn: 'Marriage Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 2,
        category: 'family_event', subcategory: 'celebration',
        countingMethod: 'business_day', displayOrder: 10 },
      { code: 'on_demand', name: 'Urlop na żądanie', nameEn: 'On-Demand Leave',
        isPaid: true, allowHalfDay: true, requiresProof: false,
        category: 'annual', countingMethod: 'business_day',
        maxPerYear: 4, displayOrder: 3 },
      { code: 'unpaid', name: 'Urlop bezpłatny', nameEn: 'Unpaid Leave',
        isPaid: false, allowHalfDay: false, requiresProof: false,
        category: 'other', countingMethod: 'business_day', displayOrder: 99 },
    ],
  },

  // ── CTR-US: 미국/멕시코 ─────────────────────────────────
  // 멕시코 연방노동법 (Ley Federal del Trabajo, 2023 개정) 기준
  {
    companyCode: 'CTR-US',
    types: [
      { code: 'annual', name: 'Vacaciones', nameEn: 'Annual Vacation',
        isPaid: true, allowHalfDay: true, requiresProof: false,
        category: 'annual', countingMethod: 'business_day', displayOrder: 1 },
      { code: 'sick', name: 'Incapacidad por enfermedad', nameEn: 'Sick Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true,
        category: 'health', countingMethod: 'calendar_day', displayOrder: 2 },
      { code: 'maternity', name: 'Incapacidad por maternidad', nameEn: 'Maternity Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 84,
        category: 'maternity', countingMethod: 'calendar_day', includesHolidays: true,
        displayOrder: 20 },
      { code: 'paternity', name: 'Permiso de paternidad', nameEn: 'Paternity Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 5,
        category: 'maternity', countingMethod: 'business_day', displayOrder: 21 },
      { code: 'bereavement', name: 'Permiso por defunción', nameEn: 'Bereavement Leave',
        isPaid: true, allowHalfDay: false, requiresProof: true, maxConsecutiveDays: 3,
        category: 'family_event', subcategory: 'condolence',
        countingMethod: 'business_day', displayOrder: 40 },
      { code: 'unpaid', name: 'Permiso sin goce de sueldo', nameEn: 'Unpaid Leave',
        isPaid: false, allowHalfDay: false, requiresProof: false,
        category: 'other', countingMethod: 'business_day', displayOrder: 99 },
    ],
  },
]

// ═══════════════════════════════════════════════════════════
// Seed 실행
// ═══════════════════════════════════════════════════════════

export async function seedStatutoryLeaveTypes(p: PrismaClient) {
  console.log('  🏖 Seeding statutory leave types per company (regulatory alignment)...')

  const companies = await p.company.findMany({ select: { id: true, code: true } })
  const codeToId = new Map(companies.map((c) => [c.code, c.id]))

  let created = 0
  let updated = 0
  let skipped = 0

  // 국내 7개 법인에 공통규정 적용
  for (const companyCode of DOMESTIC_COMPANIES) {
    const companyId = codeToId.get(companyCode)
    if (!companyId) {
      console.log(`    ⚠️  Company ${companyCode} not found, skipping`)
      continue
    }

    for (const lt of DOMESTIC_COMMON_TYPES) {
      const result = await upsertLeaveType(p, companyId, lt)
      if (result === 'created') created++
      else if (result === 'updated') updated++
      else skipped++
    }
  }

  // 해외 5개 법인에 개별 규정 적용
  for (const companyDef of OVERSEAS_LEAVE_TYPES) {
    const companyId = codeToId.get(companyDef.companyCode)
    if (!companyId) {
      console.log(`    ⚠️  Company ${companyDef.companyCode} not found, skipping`)
      continue
    }

    for (const lt of companyDef.types) {
      const result = await upsertLeaveType(p, companyId, lt)
      if (result === 'created') created++
      else if (result === 'updated') updated++
      else skipped++
    }
  }

  console.log(`  ✅ Statutory leave types: ${created} created, ${updated} updated, ${skipped} unchanged`)
}

async function upsertLeaveType(
  p: PrismaClient,
  companyId: string,
  lt: LeaveTypeSeed,
): Promise<'created' | 'updated' | 'skipped'> {
  const existing = await p.leaveTypeDef.findFirst({
    where: { companyId, code: lt.code },
  })

  const data = {
    code: lt.code,
    name: lt.name,
    nameEn: lt.nameEn,
    isPaid: lt.isPaid,
    allowHalfDay: lt.allowHalfDay,
    requiresProof: lt.requiresProof,
    maxConsecutiveDays: lt.maxConsecutiveDays ?? null,
    minAdvanceDays: lt.minAdvanceDays ?? null,
    displayOrder: lt.displayOrder,
    category: lt.category ?? null,
    subcategory: lt.subcategory ?? null,
    countingMethod: lt.countingMethod ?? 'business_day',
    includesHolidays: lt.includesHolidays ?? false,
    isSplittable: lt.isSplittable ?? false,
    splitDeadlineDays: lt.splitDeadlineDays ?? null,
    maxPerYear: lt.maxPerYear ?? null,
    paidDaysPerYear: lt.paidDaysPerYear ?? null,
    condolenceAmount: lt.condolenceAmount ?? null,
    isActive: true,
  }

  if (existing) {
    // 기존 레코드가 있으면 규정 필드만 업데이트 (이름/유급여부/일수 등 교정)
    const needsUpdate =
      existing.isPaid !== data.isPaid ||
      existing.maxConsecutiveDays !== data.maxConsecutiveDays ||
      existing.name !== data.name ||
      existing.category !== data.category ||
      existing.countingMethod !== data.countingMethod ||
      existing.includesHolidays !== data.includesHolidays ||
      existing.isSplittable !== data.isSplittable ||
      existing.condolenceAmount !== data.condolenceAmount ||
      existing.maxPerYear !== data.maxPerYear ||
      existing.paidDaysPerYear !== data.paidDaysPerYear

    if (needsUpdate) {
      await p.leaveTypeDef.update({
        where: { id: existing.id },
        data,
      })
      return 'updated'
    }
    return 'skipped'
  }

  await p.leaveTypeDef.create({
    data: {
      ...data,
      companyId,
    },
  })
  return 'created'
}

// Standalone execution
if (require.main === module) {
  import('dotenv').then(dotenv => {
    import('path').then(path => {
      dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })
      dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

      import('../../src/generated/prisma/client').then(({ PrismaClient }) => {
        import('@prisma/adapter-pg').then(({ PrismaPg }) => {
          const connectionString = process.env.DATABASE_URL
          if (!connectionString) throw new Error('DATABASE_URL is not set')
          const adapter = new PrismaPg({ connectionString })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const prisma = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] }) as InstanceType<typeof PrismaClient>
          seedStatutoryLeaveTypes(prisma)
            .then(() => prisma.$disconnect())
            .catch((e: unknown) => {
              console.error(e)
              prisma.$disconnect()
              process.exit(1)
            })
        })
      })
    })
  })
}
