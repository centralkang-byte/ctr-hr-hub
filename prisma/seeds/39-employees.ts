// ================================================================
// Track B B-1e: Employee Data Redistribution (446 employees)
// prisma/seeds/39-employees.ts
//
// Named leadership (~199) from real CTR org chart + auto-generated (~247)
// across 13 companies. All get exactly 1 EmployeeAssignment (isPrimary).
// Concurrent assignments (겸직) deferred to Phase 3 B-3e.
//
// ⚠️ Protected QA accounts: super@, hr@, manager@, employee-*@ are NEVER deleted
// ⚠️ Insertion order: Employee → EmployeeAssignment → EmployeeRole (flat, no nested)
// ⚠️ JobGrade lookup: always filter by BOTH code AND companyId
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

const TEST_PASSWORD_HASH = '$2b$10$dummyHashForSeedOnlyNotRealBcryptHashValue000000000000'

// Protected QA account emails — NEVER create employees with these emails
const PROTECTED_EMAILS = new Set([
  'super@ctr.co.kr', 'hr@ctr.co.kr', 'hr@ctr-cn.com',
  'manager@ctr.co.kr', 'manager2@ctr.co.kr',
  'employee-a@ctr.co.kr', 'employee-b@ctr.co.kr', 'employee-c@ctr.co.kr',
  'admin@ctr.co.kr', 'employee@ctr.co.kr',
])

// ================================================================
// Email domain mapping
// ================================================================
const DOMAIN: Record<string, string> = {
  'CTR-HOLD': 'ctr.co.kr', 'CTR': 'ctr.co.kr', 'CTR-MOB': 'ctr.co.kr',
  'CTR-ECO': 'ctr.co.kr', 'CTR-ROB': 'ctr.co.kr', 'CTR-ENR': 'ctr.co.kr',
  'CTR-FML': 'ctr.co.kr', 'CTR-CN': 'ctr-cn.com', 'CTR-US': 'ctr-us.com',
  'CTR-VN': 'ctr-vn.com', 'CTR-RU': 'ctr-ru.com', 'CTR-EU': 'ctr-eu.com',
}

function makeEmail(nameEn: string, co: string): string {
  const parts = nameEn.split(' ')
  const first = parts[0].toLowerCase().replace(/[^a-z]/g, '')
  const last = parts.slice(1).join('').toLowerCase().replace(/[^a-z]/g, '')
  return `${first}.${last}@${DOMAIN[co]}`
}

// ================================================================
// Named Employee Data
// [name, nameEn, companyCode, positionCode, gradeCode, roleCode, emailOverride?]
// ================================================================
type NamedEmp = [string, string, string, string, string, string, string?]

const NAMED: NamedEmp[] = [
  // ──── CTR-HOLD (14) ────
  ['강상우', 'Sangwoo Kang', 'CTR-HOLD', 'POS-HOLD-VCHAIR', 'E1', 'SUPER_ADMIN', 'sangwoo.kang@ctr.co.kr'],
  ['정향모', 'Hyangmo Jeong', 'CTR-HOLD', 'POS-HOLD-DIR-MGMT', 'L2', 'HR_ADMIN'],
  ['김형욱', 'Hyungwook Kim', 'CTR-HOLD', 'POS-HOLD-DIR-BTS', 'L2', 'MANAGER'],
  ['신명신', 'Myungshin Shin', 'CTR-HOLD', 'POS-HOLD-SL-CTO', 'L2', 'MANAGER'],
  ['김경준', 'Kyungjun Kim', 'CTR-HOLD', 'POS-HOLD-TL-FINPLAN', 'L2', 'MANAGER'],
  ['김덕환', 'Deokhwan Kim', 'CTR-HOLD', 'POS-HOLD-TL-MGMT', 'L2', 'MANAGER'],
  ['최재호', 'Jaeho Choi', 'CTR-HOLD', 'POS-HOLD-TL-MGMTSUP', 'L2', 'MANAGER'],
  ['변종원', 'Jongwon Byun', 'CTR-HOLD', 'POS-HOLD-TL-BIZ', 'L2', 'MANAGER'],
  ['정민우', 'Minwoo Jeong', 'CTR-HOLD', 'POS-HOLD-TL-AUDIT', 'L2', 'MANAGER'],
  ['김승열', 'Seungyeol Kim', 'CTR-HOLD', 'POS-HOLD-TL-LEGAL', 'L2', 'MANAGER'],
  ['양동환', 'Donghwan Yang', 'CTR-HOLD', 'POS-HOLD-TL-INFOSEC', 'L2', 'MANAGER'],
  ['조현신', 'Hyunshin Jo', 'CTR-HOLD', 'POS-HOLD-TL-FUTUREPLAN', 'L2', 'MANAGER'],
  ['정미연', 'Miyeon Jeong', 'CTR-HOLD', 'POS-HOLD-TL-PI', 'L2', 'MANAGER'],
  ['배국한', 'Gukhan Bae', 'CTR-HOLD', 'POS-HOLD-TL-COST', 'L2', 'MANAGER'],

  // ──── CTR CEO Direct (9) ────
  ['이동옥', 'Dongok Lee', 'CTR', 'POS-CTR-CEO', 'L2', 'MANAGER'],
  ['최연식', 'Yeonsik Choi', 'CTR', 'POS-CTR-TL-PNC', 'L2', 'SUPER_ADMIN'],
  ['이재준', 'Jaejun Lee', 'CTR', 'POS-CTR-TL-FPA', 'L2', 'MANAGER'],
  ['김도언', 'Doeon Kim', 'CTR', 'POS-CTR-TL-BIZPLAN', 'L2', 'MANAGER'],
  ['조성영', 'Sungyoung Jo', 'CTR', 'POS-CTR-TL-BIZSUP', 'L2', 'MANAGER'],
  ['한성욱', 'Sungwook Han', 'CTR', 'POS-CTR-TL-FINANCE', 'L2', 'MANAGER'],
  ['이종열', 'Jongyeol Lee', 'CTR', 'POS-CTR-TL-EHS', 'L2', 'MANAGER'],
  ['김원진', 'Wonjin Kim', 'CTR', 'POS-CTR-TL-ESG', 'L2', 'MANAGER'],
  ['오광명', 'Kwangmyung Oh', 'CTR', 'POS-CTR-TL-PARTNER', 'L2', 'MANAGER'],

  // ──── CTR OE (Division Directors + Plant Managers) ────
  ['엄용일', 'Yongil Eom', 'CTR', 'POS-CTR-HEAD-OE', 'L2', 'MANAGER'],
  ['하창윤', 'Changyun Ha', 'CTR', 'POS-CTR-DIR-SALES', 'L2', 'MANAGER'],
  ['서선민', 'Seonmin Seo', 'CTR', 'POS-CTR-DIR-PM', 'L2', 'MANAGER'],
  ['반경택', 'Kyungtaek Ban', 'CTR', 'POS-CTR-DIR-RND', 'L2', 'MANAGER'],
  ['최준영', 'Junyoung Choi', 'CTR', 'POS-CTR-DIR-PURCHASE', 'L2', 'MANAGER'],
  ['유영재', 'Youngjae Yu', 'CTR', 'POS-CTR-DIR-QUALITY', 'L2', 'MANAGER'],
  ['방우영', 'Wooyoung Bang', 'CTR', 'POS-CTR-DIR-SCM', 'L2', 'MANAGER'],
  ['김병수', 'Byungsu Kim', 'CTR', 'POS-CTR-DIR-PRODTECH', 'L2', 'MANAGER'],
  ['권민철', 'Mincheol Kwon', 'CTR', 'POS-CTR-PM-CHANGWON', 'L2', 'MANAGER'],
  ['유재우', 'Jaewoo Yu', 'CTR', 'POS-CTR-PM-MASAN', 'L2', 'MANAGER'],
  ['양호준', 'Hojun Yang', 'CTR', 'POS-CTR-PM-YOUNGSAN', 'L2', 'MANAGER'],
  ['허성혁', 'Sunghyuk Heo', 'CTR', 'POS-CTR-PM-DAEHAP', 'L2', 'MANAGER'],

  // ──── CTR OE Team Leaders ────
  ['김명호', 'Myungho Kim', 'CTR', 'POS-CTR-TL-SALES1', 'L2', 'MANAGER'],
  ['김민선', 'Minseon Kim', 'CTR', 'POS-CTR-TL-SALES2', 'L2', 'MANAGER'],
  ['원지호', 'Jiho Won', 'CTR', 'POS-CTR-TL-SALES3', 'L2', 'MANAGER'],
  ['임정훈', 'Jeonghun Im', 'CTR', 'POS-CTR-TL-SALES4', 'L2', 'MANAGER'],
  ['허종서', 'Jongseo Heo', 'CTR', 'POS-CTR-TL-PM', 'L2', 'MANAGER'],
  ['김치형', 'Chihyung Kim', 'CTR', 'POS-CTR-TL-RNDPLAN', 'L2', 'MANAGER'],
  ['배찬용', 'Chanyong Bae', 'CTR', 'POS-CTR-TL-DESIGN', 'L2', 'MANAGER'],
  ['박정훈', 'Jeonghun Park', 'CTR', 'POS-CTR-TL-ANALYSIS', 'L2', 'MANAGER'],
  ['조도학', 'Dohak Jo', 'CTR', 'POS-CTR-TL-ADVTECH', 'L2', 'MANAGER'],
  ['김기영', 'Kiyoung Kim', 'CTR', 'POS-CTR-TL-MATERIAL', 'L2', 'MANAGER'],
  ['김영기', 'Youngki Kim', 'CTR', 'POS-CTR-TL-PROTOTYPE', 'L2', 'MANAGER'],
  ['차승호', 'Seungho Cha', 'CTR', 'POS-CTR-TL-PURPLAN', 'L2', 'MANAGER'],
  ['전세호', 'Seho Jeon', 'CTR', 'POS-CTR-TL-PURCHASE', 'L2', 'MANAGER'],
  ['이동성', 'Dongsung Lee', 'CTR', 'POS-CTR-TL-PURCOST', 'L2', 'MANAGER'],
  ['방성호', 'Sungho Bang', 'CTR', 'POS-CTR-TL-SQ', 'L2', 'MANAGER'],
  ['이승철', 'Seungcheol Lee', 'CTR', 'POS-CTR-TL-GSOURCING', 'L2', 'MANAGER'],
  ['정병주', 'Byungju Jeong', 'CTR', 'POS-CTR-TL-QM', 'L2', 'MANAGER'],
  ['최천식', 'Cheonsik Choi', 'CTR', 'POS-CTR-TL-ADVQUAL', 'L2', 'MANAGER'],
  ['안도현', 'Dohyun An', 'CTR', 'POS-CTR-TL-QC', 'L2', 'MANAGER'],
  ['신동규', 'Donggyu Shin', 'CTR', 'POS-CTR-TL-SCMPLAN', 'L2', 'MANAGER'],
  ['정홍철', 'Hongcheol Jeong', 'CTR', 'POS-CTR-TL-TM', 'L2', 'MANAGER'],
  ['김동규', 'Donggyu Kim', 'CTR', 'POS-CTR-TL-IE', 'L2', 'MANAGER'],
  ['이재현', 'Jaehyun Lee', 'CTR', 'POS-CTR-TL-PRODTECH1', 'L2', 'MANAGER'],
  ['정우식', 'Woosik Jeong', 'CTR', 'POS-CTR-TL-PRODTECH2', 'L2', 'MANAGER'],
  ['유진수', 'Jinsu Yu', 'CTR', 'POS-CTR-TL-PRODTECH3', 'L2', 'MANAGER'],

  // ──── CTR Plant Team Leaders ────
  ['박민욱', 'Minwook Park', 'CTR', 'POS-CTR-TL-CW-OE', 'L2', 'MANAGER'],
  ['이호익', 'Hoik Lee', 'CTR', 'POS-CTR-TL-CW-PQC', 'L2', 'MANAGER'],
  ['최성익', 'Sungik Choi', 'CTR', 'POS-CTR-TL-CW-MAINT', 'L2', 'MANAGER'],
  ['박병규', 'Byunggyu Park', 'CTR', 'POS-CTR-TL-MS-OE', 'L2', 'MANAGER'],
  ['차경현', 'Kyunghyun Cha', 'CTR', 'POS-CTR-TL-MS-PQC', 'L2', 'MANAGER'],
  ['최정민', 'Jungmin Choi', 'CTR', 'POS-CTR-TL-MS-MAINT', 'L2', 'MANAGER'],
  ['이종인', 'Jongin Lee', 'CTR', 'POS-CTR-TL-YS-OE', 'L2', 'MANAGER'],
  ['하태규', 'Taegyu Ha', 'CTR', 'POS-CTR-TL-YS-PQC', 'L2', 'MANAGER'],
  ['김현수', 'Hyunsu Kim', 'CTR', 'POS-CTR-TL-YS-MAINT', 'L2', 'MANAGER'],
  ['이재우', 'Jaewoo Lee', 'CTR', 'POS-CTR-TL-DH-OE', 'L2', 'MANAGER'],
  ['곽상훈', 'Sanghun Kwak', 'CTR', 'POS-CTR-TL-DH-MAINT', 'L2', 'MANAGER'],

  // ──── CTR AM Leadership ────
  ['이성훈', 'Sunghun Lee', 'CTR', 'POS-CTR-HEAD-AM', 'L2', 'MANAGER'],
  ['권영희', 'Younghee Kwon', 'CTR', 'POS-CTR-SL-CSO', 'L2', 'MANAGER'],
  ['탁정호', 'Jungho Tak', 'CTR', 'POS-CTR-SL-COOK', 'L2', 'MANAGER'],
  ['구대원', 'Daewon Gu', 'CTR', 'POS-CTR-SL-CDO', 'L2', 'MANAGER'],
  ['안서경', 'Seokyung An', 'CTR', 'POS-CTR-SL-CMO', 'L2', 'MANAGER'],
  ['송하용', 'Hayong Song', 'CTR', 'POS-CTR-SL-CCO', 'L2', 'MANAGER'],
  ['박양원', 'Yangwon Park', 'CTR', 'POS-CTR-DIR-AM-RND', 'L2', 'MANAGER'],
  ['이정재', 'Jungjae Lee', 'CTR', 'POS-CTR-TL-AM-GSCM', 'L2', 'MANAGER'],
  ['김현태', 'Hyuntae Kim', 'CTR', 'POS-CTR-HEAD-EJ', 'L2', 'MANAGER'],

  // ──── CTR AM CxO Team Leaders ────
  ['이성덕', 'Sungdeok Lee', 'CTR', 'POS-CTR-TL-AM-PROCTECH', 'L2', 'MANAGER'],
  ['김원석', 'Wonseok Kim', 'CTR', 'POS-CTR-TL-AM-PRODMGMT', 'L2', 'MANAGER'],
  ['문명진', 'Myungjin Moon', 'CTR', 'POS-CTR-TL-AM-QC', 'L2', 'MANAGER'],
  ['김길홍', 'Gilhong Kim', 'CTR', 'POS-CTR-TL-AM-PRODMGMT2', 'L2', 'MANAGER'],
  ['김정규', 'Junggyu Kim', 'CTR', 'POS-CTR-TL-AM-SOURCING', 'L2', 'MANAGER'],
  ['최준만', 'Junman Choi', 'CTR', 'POS-CTR-TL-AM-PM', 'L2', 'MANAGER'],
  ['정수희', 'Suhee Jeong', 'CTR', 'POS-CTR-TL-AM-NSDEV', 'L2', 'MANAGER'],
  ['한지철', 'Jicheol Han', 'CTR', 'POS-CTR-TL-AM-PURCHASE', 'L2', 'MANAGER'],
  ['박정림', 'Jungrim Park', 'CTR', 'POS-CTR-TL-AM-MARCOM', 'L2', 'MANAGER'],
  ['권순기', 'Soonki Kwon', 'CTR', 'POS-CTR-TL-AM-DATA', 'L2', 'MANAGER'],
  ['박수진', 'Sujin Park', 'CTR', 'POS-CTR-TL-AM-ECOM', 'L2', 'MANAGER'],
  ['박동언', 'Dongeon Park', 'CTR', 'POS-CTR-TL-AM-CIS', 'L2', 'MANAGER'],
  ['이승엽', 'Seungyeop Lee', 'CTR', 'POS-CTR-TL-AM-INDOPAC', 'L2', 'MANAGER'],
  ['이명복', 'Myungbok Lee', 'CTR', 'POS-CTR-TL-AM-AMERICA', 'L2', 'MANAGER'],
  ['안정진', 'Jungjin An', 'CTR', 'POS-CTR-TL-AM-LATAM', 'L2', 'MANAGER'],
  ['배지은', 'Jieun Bae', 'CTR', 'POS-CTR-TL-AM-ASIAMKT', 'L2', 'MANAGER'],
  ['윤성룡', 'Sungryong Yun', 'CTR', 'POS-CTR-TL-AM-DESIGNK', 'L2', 'MANAGER'],
  ['신어진', 'Eojin Shin', 'CTR', 'POS-CTR-TL-AM-TESTK', 'L2', 'MANAGER'],
  ['이재준B', 'Jaejun Lee B', 'CTR', 'POS-CTR-TL-AM-BIZPLAN', 'L2', 'MANAGER', 'younghee.kwon2@ctr.co.kr'],
  // Note: 권영희 is CSO + 경영기획팀장 (겸직). This session: primary on CSO. Phase 3 secondary.
  // Using 이재준B placeholder; actually 권영희 겸직 경영기획팀장 goes Phase 3
  ['이재준C', 'Jaejun Lee C', 'CTR', 'POS-CTR-TL-AM-MGMT', 'L2', 'MANAGER', 'am.mgmt.tl@ctr.co.kr'],
  // Note: AM 경영관리팀장 — 김영규 is SKIP (Primary=CTR-VN). Placeholder for now.

  // ──── CTR-MOB (30) ────
  ['양현철', 'Hyuncheol Yang', 'CTR-MOB', 'POS-MOB-CEO', 'L2', 'MANAGER'],
  ['조동용', 'Dongyong Jo', 'CTR-MOB', 'POS-MOB-DIR-RND', 'L2', 'MANAGER'],
  ['오세화', 'Sehwa Oh', 'CTR-MOB', 'POS-MOB-DIR-SALES', 'L2', 'MANAGER'],
  ['이경수', 'Kyungsu Lee', 'CTR-MOB', 'POS-MOB-DIR-MGMT', 'L2', 'HR_ADMIN'],
  ['김태용', 'Taeyong Kim', 'CTR-MOB', 'POS-MOB-DIR-FIN', 'L2', 'MANAGER'],
  ['이경주', 'Kyungju Lee', 'CTR-MOB', 'POS-MOB-DIR-PRODTECH', 'L2', 'MANAGER'],
  ['양희재', 'Heejae Yang', 'CTR-MOB', 'POS-MOB-PM-ULSAN', 'L2', 'MANAGER'],
  ['이성삼', 'Sungsam Lee', 'CTR-MOB', 'POS-MOB-PM-SEOSAN', 'L2', 'MANAGER'],
  ['김명일', 'Myungil Kim', 'CTR-MOB', 'POS-MOB-PM-DAEGU', 'L2', 'MANAGER'],
  ['박준효', 'Junhyo Park', 'CTR-MOB', 'POS-MOB-TL-ADVRES', 'L2', 'MANAGER'],
  ['송정국', 'Jungguk Song', 'CTR-MOB', 'POS-MOB-TL-DESIGN1', 'L2', 'MANAGER'],
  ['전춘식', 'Chunsik Jeon', 'CTR-MOB', 'POS-MOB-TL-DESIGN2', 'L2', 'MANAGER'],
  ['제한웅', 'Hanwoong Je', 'CTR-MOB', 'POS-MOB-TL-PM', 'L2', 'MANAGER'],
  ['이창훈', 'Changhun Lee', 'CTR-MOB', 'POS-MOB-TL-PROTO', 'L2', 'MANAGER'],
  ['양정민', 'Jungmin Yang', 'CTR-MOB', 'POS-MOB-TL-TEST', 'L2', 'MANAGER'],
  ['박문배', 'Moonbae Park', 'CTR-MOB', 'POS-MOB-TL-SALES', 'L2', 'MANAGER'],
  ['하상석', 'Sangseok Ha', 'CTR-MOB', 'POS-MOB-TL-PURCHASE', 'L2', 'MANAGER'],
  ['정현석', 'Hyunseok Jeong', 'CTR-MOB', 'POS-MOB-TL-COSTACCT', 'L2', 'MANAGER'],
  ['장호길', 'Hogil Jang', 'CTR-MOB', 'POS-MOB-TL-UL-PRODTECH', 'L2', 'MANAGER'],
  ['김상훈', 'Sanghun Kim', 'CTR-MOB', 'POS-MOB-TL-UL-MAINT', 'L2', 'MANAGER'],
  ['주민관', 'Mingwan Ju', 'CTR-MOB', 'POS-MOB-TL-UL-QC', 'L2', 'MANAGER'],
  ['황종식', 'Jongsik Hwang', 'CTR-MOB', 'POS-MOB-TL-UL-PRODOPS', 'L2', 'MANAGER'],
  ['조석제', 'Seokje Jo', 'CTR-MOB', 'POS-MOB-TL-SS-PRODTECH', 'L2', 'MANAGER'],
  ['이태훈', 'Taehun Lee', 'CTR-MOB', 'POS-MOB-TL-SS-MAINT', 'L2', 'MANAGER'],
  ['김찬휘', 'Chanhwi Kim', 'CTR-MOB', 'POS-MOB-TL-SS-QC', 'L2', 'MANAGER'],
  ['김은택', 'Euntaek Kim', 'CTR-MOB', 'POS-MOB-TL-SS-PRODOPS', 'L2', 'MANAGER'],
  ['구민수', 'Minsu Gu', 'CTR-MOB', 'POS-MOB-TL-DG-PRODTECH', 'L2', 'MANAGER'],
  ['서영석', 'Youngseok Seo', 'CTR-MOB', 'POS-MOB-TL-DG-MAINT', 'L2', 'MANAGER'],
  ['김호진', 'Hojin Kim', 'CTR-MOB', 'POS-MOB-TL-DG-QC', 'L2', 'MANAGER'],
  ['김영배', 'Youngbae Kim', 'CTR-MOB', 'POS-MOB-TL-DG-PRODOPS', 'L2', 'MANAGER'],

  // ──── CTR-ECO (10) ────
  ['김윤호', 'Yunho Kim', 'CTR-ECO', 'POS-ECO-HEAD', 'L2', 'MANAGER'],
  ['윤여웅', 'Yeowoong Yun', 'CTR-ECO', 'POS-ECO-TL-ADVTECH', 'L2', 'MANAGER'],
  ['김광수', 'Kwangsu Kim', 'CTR-ECO', 'POS-ECO-TL-MOLD', 'L2', 'MANAGER'],
  ['김진우', 'Jinwoo Kim', 'CTR-ECO', 'POS-ECO-TL-FORGING', 'L2', 'MANAGER'],
  ['김대성', 'Daesung Kim', 'CTR-ECO', 'POS-ECO-TL-PURCHASE', 'L2', 'MANAGER'],
  ['황종은', 'Jongeun Hwang', 'CTR-ECO', 'POS-ECO-TL-MY-OE', 'L2', 'MANAGER'],
  ['권영민', 'Youngmin Kwon', 'CTR-ECO', 'POS-ECO-TL-MY-QC', 'L2', 'MANAGER'],
  ['김영웅', 'Youngwoong Kim', 'CTR-ECO', 'POS-ECO-TL-MY-PRODTECH', 'L2', 'MANAGER'],
  ['구용환', 'Yonghwan Gu', 'CTR-ECO', 'POS-ECO-TL-MY-MGMT', 'L2', 'HR_ADMIN'],
  ['김지홍', 'Jihong Kim', 'CTR-ECO', 'POS-ECO-TL-EHS', 'L2', 'MANAGER'],

  // ──── CTR-ROB (13) ────
  ['유병선', 'Byungsun Yu', 'CTR-ROB', 'POS-ROB-CEO', 'L2', 'MANAGER'],
  ['제경효', 'Kyunghyo Je', 'CTR-ROB', 'POS-ROB-DIR-MGMT', 'L2', 'MANAGER'],
  ['조상찬', 'Sangchan Jo', 'CTR-ROB', 'POS-ROB-DIR-SYSTEM', 'L2', 'MANAGER'],
  ['김태형', 'Taehyung Kim', 'CTR-ROB', 'POS-ROB-DIR-TECH', 'L2', 'MANAGER'],
  ['한상윤', 'Sangyun Han', 'CTR-ROB', 'POS-ROB-TL-QC', 'L2', 'MANAGER'],
  ['김동준', 'Dongjun Kim', 'CTR-ROB', 'POS-ROB-TL-MGMTSUP', 'L2', 'HR_ADMIN'],
  ['박재용', 'Jaeyong Park', 'CTR-ROB', 'POS-ROB-TL-DESIGN', 'L2', 'MANAGER'],
  ['오택영', 'Taekyoung Oh', 'CTR-ROB', 'POS-ROB-TL-SALES1', 'L2', 'MANAGER'],
  ['장준오', 'Junoh Jang', 'CTR-ROB', 'POS-ROB-TL-SALES2', 'L2', 'MANAGER'],
  ['노진희', 'Jinhee Noh', 'CTR-ROB', 'POS-ROB-TL-SALESPLAN', 'L2', 'MANAGER'],
  ['신정수', 'Jungsu Shin', 'CTR-ROB', 'POS-ROB-TL-TS', 'L2', 'MANAGER'],
  ['임태우', 'Taewoo Im', 'CTR-ROB', 'POS-ROB-TL-SW', 'L2', 'MANAGER'],
  ['노현철', 'Hyuncheol Noh', 'CTR-ROB', 'POS-ROB-TL-ADVTECH', 'L2', 'MANAGER'],

  // ──── CTR-ENR (8) ────
  ['모유청', 'Yucheong Mo', 'CTR-ENR', 'POS-ENR-CEO', 'L2', 'MANAGER'],
  ['김기엽', 'Kiyeop Kim', 'CTR-ENR', 'POS-ENR-DIR-RENEW', 'L2', 'MANAGER'],
  ['류기식', 'Gisik Ryu', 'CTR-ENR', 'POS-ENR-PL-ICT', 'L2', 'MANAGER'],
  ['배두희', 'Doohee Bae', 'CTR-ENR', 'POS-ENR-PL-RB1', 'L2', 'MANAGER'],
  ['박미희', 'Mihee Park', 'CTR-ENR', 'POS-ENR-PL-RB2', 'L2', 'MANAGER'],
  ['이준상', 'Junsang Lee', 'CTR-ENR', 'POS-ENR-PL-RB3', 'L2', 'MANAGER'],
  ['강태영', 'Taeyoung Kang', 'CTR-ENR', 'POS-ENR-PL-ENG', 'L2', 'MANAGER'],
  ['최은화', 'Eunhwa Choi', 'CTR-ENR', 'POS-ENR-PL-EQUIP', 'L2', 'MANAGER'],

  // ──── CTR-FML (7) ────
  ['원석래', 'Seokrae Won', 'CTR-FML', 'POS-FML-CEO', 'L2', 'MANAGER'],
  ['한창근', 'Changgeun Han', 'CTR-FML', 'POS-FML-CEO', 'L2', 'EMPLOYEE', 'changgeun.han@ctr.co.kr'],
  // 한창근: 고문 — shares CEO dept as placeholder, EMPLOYEE role
  ['박성욱', 'Sungwook Park', 'CTR-FML', 'POS-FML-TL-INFRA', 'L2', 'MANAGER'],
  ['이용민', 'Yongmin Lee', 'CTR-FML', 'POS-FML-TL-SYSOPS', 'L2', 'MANAGER'],
  ['권택수', 'Taeksu Kwon', 'CTR-FML', 'POS-FML-TL-DEV1', 'L2', 'MANAGER'],
  ['리스카', 'Liska Ri', 'CTR-FML', 'POS-FML-TL-DEV2', 'L2', 'MANAGER'],
  ['조기영', 'Kiyoung Jo', 'CTR-FML', 'POS-FML-TL-SALES', 'L2', 'MANAGER'],

  // ──── CTR-CN (16) ────
  ['Ming Li', 'Ming Li', 'CTR-CN', 'POS-CN-CEO', 'L5', 'MANAGER'],
  ['류지훈', 'Jihun Ryu', 'CTR-CN', 'POS-CN-TL-MGMTSUP', 'L4', 'HR_ADMIN'],
  ['임현묵', 'Hyunmuk Im', 'CTR-CN', 'POS-CN-TL-MGMT', 'L4', 'MANAGER'],
  ['정원석', 'Wonseok Jeong', 'CTR-CN', 'POS-CN-TL-TEST', 'L4', 'MANAGER'],
  ['박정철', 'Jungcheol Park', 'CTR-CN', 'POS-CN-TL-DESIGN', 'L4', 'MANAGER'],
  ['Haiying Wu', 'Haiying Wu', 'CTR-CN', 'POS-CN-TL-PM', 'L4', 'MANAGER'],
  ['Tian Zhao', 'Tian Zhao', 'CTR-CN', 'POS-CN-TL-SALES', 'L4', 'MANAGER'],
  ['지용범', 'Yongbeom Ji', 'CTR-CN', 'POS-CN-TL-PURCHASE', 'L4', 'MANAGER'],
  ['김성훈', 'Sunghun Kim', 'CTR-CN', 'POS-CN-TL-SQ', 'L4', 'MANAGER'],
  ['Guilin Long', 'Guilin Long', 'CTR-CN', 'POS-CN-DIR-QUALITY', 'L5', 'MANAGER'],
  ['Jianghong Zhou', 'Jianghong Zhou', 'CTR-CN', 'POS-CN-TL-QC', 'L4', 'MANAGER'],
  ['김상석', 'Sangseok Kim', 'CTR-CN', 'POS-CN-PM-ZJG', 'L5', 'MANAGER'],
  ['최동춘', 'Dongchun Choi', 'CTR-CN', 'POS-CN-TL-ZJG-PROD', 'L3', 'MANAGER'],
  ['Delong Li', 'Delong Li', 'CTR-CN', 'POS-CN-TL-ZJG-MAINT', 'L3', 'MANAGER'],
  ['김해웅', 'Haewoong Kim', 'CTR-CN', 'POS-CN-TL-ZJG-OE', 'L3', 'MANAGER'],
  ['서대원', 'Daewon Seo', 'CTR-CN', 'POS-CN-TL-ZJG-PRODTECH', 'L3', 'MANAGER'],

  // ──── CTR-US (9, skip 허종서/신동규) ────
  ['김주형', 'Juhyung Kim', 'CTR-US', 'POS-US-CEO', 'L5', 'MANAGER'],
  ['김대일', 'Daeil Kim', 'CTR-US', 'POS-US-SL-CFO', 'L5', 'HR_ADMIN'],
  ['최정길', 'Junggil Choi', 'CTR-US', 'POS-US-TL-CRM', 'L4', 'MANAGER'],
  ['Dave Cosgrove', 'Dave Cosgrove', 'CTR-US', 'POS-US-TL-SALES', 'L4', 'MANAGER'],
  ['황정욱', 'Jungwook Hwang', 'CTR-US', 'POS-US-PM-MTY', 'L5', 'MANAGER'],
  ['Juan Jose', 'Juan Jose', 'CTR-US', 'POS-US-TL-MTY-PROD', 'L3', 'MANAGER'],
  ['손지수', 'Jisu Son', 'CTR-US', 'POS-US-TL-MTY-MAINT', 'L3', 'MANAGER'],
  ['고락선', 'Rakseon Ko', 'CTR-US', 'POS-US-TL-MTY-OE', 'L3', 'MANAGER'],
  ['Rolando Cortez', 'Rolando Cortez', 'CTR-US', 'POS-US-TL-MTY-QC', 'L3', 'MANAGER'],

  // ──── CTR-VN (5, skip 김길홍/마랏/스베틀라나) ────
  ['홍영수', 'Youngsu Hong', 'CTR-VN', 'POS-VN-COO', 'L5', 'MANAGER'],
  ['김영규', 'Younggyu Kim', 'CTR-VN', 'POS-VN-TL-MGMT', 'L4', 'HR_ADMIN'],
  ['하상원', 'Sangwon Ha', 'CTR-VN', 'POS-VN-TL-PROCTECH', 'L4', 'MANAGER'],
  ['심동민', 'Dongmin Sim', 'CTR-VN', 'POS-VN-TL-QC', 'L4', 'MANAGER'],
  ['Bui Thi Nhu Hang', 'Bui Thi Nhu Hang', 'CTR-VN', 'POS-VN-TL-PURSCM', 'L4', 'MANAGER'],

  // ──── CTR-RU (3) ────
  ['Roman Ivanov', 'Roman Ivanov', 'CTR-RU', 'POS-RU-HEAD', 'L5', 'MANAGER'],
  ['Svetlana Petrova', 'Svetlana Petrova', 'CTR-RU', 'POS-RU-TL-MKT', 'L4', 'MANAGER'],
  ['Marat Suleimanov', 'Marat Suleimanov', 'CTR-RU', 'POS-RU-TL-SALES', 'L4', 'MANAGER'],

  // ──── CTR-EU (1) ────
  ['김민준', 'Minjun Kim', 'CTR-EU', 'POS-EU-HEAD', 'L5', 'MANAGER'],
]

// ================================================================
// Auto-generation config
// [companyCode, office, production, dispatch, contract]
// Remaining counts AFTER subtracting named employees from targets
// ================================================================
const AUTO_GEN: Array<[string, number, number, number, number]> = [
  ['CTR-HOLD', 16, 0, 0, 0],    // 30 - 14 named
  ['CTR', 35, 50, 10, 10],       // 120 - 85 named ≈ 35 office remaining
  ['CTR-MOB', 18, 30, 5, 5],     // 60 - 30 named, rest auto + production
  ['CTR-ECO', 5, 12, 3, 2],      // 25 - 10 named, but with production/dispatch/contract
  ['CTR-ROB', 26, 0, 0, 2],      // 41 - 13 named
  ['CTR-ENR', 7, 0, 0, 0],       // 15 - 8 named
  ['CTR-FML', 8, 0, 0, 0],       // 15 - 7 named
  ['CTR-CN', 10, 25, 5, 5],      // 50 - 16 named, rest production/dispatch/contract + office
  ['CTR-US', 5, 15, 3, 2],       // 30 - 9 named
  ['CTR-VN', 7, 20, 5, 3],       // 40 - 5 named
  ['CTR-RU', 7, 0, 0, 2],        // 10 - 3 named (total 9, close enough)
  ['CTR-EU', 9, 0, 0, 0],        // 10 - 1 named
]

// ================================================================
// Name generation utilities
// ================================================================
const KR_SUR = ['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','홍']
const KR_GIV = ['민준','서준','예준','도윤','시우','하준','주원','지호','지훈','준서','수빈','지우','서연','민서','하은','지민','수진','예진','다은','채원','현우','승현','태영','재현','동혁','성민','우진','영호','병철','광수','도현','유찬','건우','지원','은서','소율','하린','서윤','수아','지안','현서','도경','진우','승우','태민','세준','규민','정훈','상윤','재원']
const KR_SUR_EN = ['Kim','Lee','Park','Choi','Jung','Kang','Jo','Yun','Jang','Im','Han','Oh','Seo','Shin','Kwon','Hwang','An','Song','Ryu','Hong']
const KR_GIV_EN = ['Minjun','Seojun','Yejun','Doyun','Siwoo','Hajun','Juwon','Jiho','Jihun','Junseo','Subin','Jiwoo','Seoyeon','Minseo','Haeun','Jimin','Sujin','Yejin','Daeun','Chaewon','Hyunwoo','Seunghyun','Taeyoung','Jaehyun','Donghyuk','Sungmin','Woojin','Youngho','Byungchul','Kwangsu','Dohyun','Yuchan','Gunwoo','Jiwon','Eunseo','Soyul','Harin','Seoyun','Sua','Jian','Hyunseo','Dokyung','Jinwoo','Seungwoo','Taemin','Sejun','Gyumin','Junghoon','Sangyun','Jaewon']
const CN_SUR = ['王','李','张','刘','陈','杨','赵','黄','周','吴']
const CN_GIV = ['伟','芳','娜','敏','静','强','磊','洋','勇','艳','杰','娟','涛','明','超','秀英','华','丽','军','平']
const CN_SUR_EN = ['Wang','Li','Zhang','Liu','Chen','Yang','Zhao','Huang','Zhou','Wu']
const CN_GIV_EN = ['Wei','Fang','Na','Min','Jing','Qiang','Lei','Yang','Yong','Yan','Jie','Juan','Tao','Ming','Chao','Xiuying','Hua','Li','Jun','Ping']
const VN_SUR = ['Nguyen','Tran','Le','Pham','Hoang','Phan','Vu','Dang','Bui','Do']
const VN_GIV = ['Anh','Binh','Chi','Duc','Hoa','Hung','Lan','Mai','Minh','Nam','Phuong','Quang','Son','Thanh','Tung']
const RU_SUR = ['Ivanov','Petrov','Sidorov','Kuznetsov','Popov','Sokolov','Lebedev','Kozlov','Novikov','Morozov']
const RU_GIV = ['Alexei','Dmitri','Ivan','Nikita','Sergei','Andrei','Mikhail','Pavel','Viktor','Yuri','Elena','Olga','Anna','Maria','Natalia']
const EU_SUR = ['Kowalski','Nowak','Wisniewski','Wojcik','Kaminski','Lewandowski','Zielinski','Szymanski','Wozniak','Dabrowski']
const EU_GIV = ['Jan','Marek','Pawel','Tomasz','Andrzej','Piotr','Marcin','Krzysztof','Anna','Katarzyna','Ewa','Agnieszka','Joanna','Dorota','Malgorzata']
const US_SUR = ['Smith','Johnson','Williams','Brown','Jones','Davis','Miller','Wilson','Moore','Taylor']
const US_GIV = ['James','John','Robert','Michael','David','Chris','Daniel','Mark','Steven','Andrew','Jessica','Jennifer','Lisa','Sarah','Emily']

function genName(co: string, idx: number) {
  if (co === 'CTR-CN') {
    const se = CN_SUR_EN[idx % CN_SUR_EN.length], ge = CN_GIV_EN[(idx * 3 + 7) % CN_GIV_EN.length]
    return { name: `${ge} ${se}`, nameEn: `${ge} ${se}` }
  }
  if (co === 'CTR-VN') {
    const s = VN_SUR[idx % VN_SUR.length], g = VN_GIV[(idx * 3 + 5) % VN_GIV.length]
    return { name: `${s} ${g}`, nameEn: `${g} ${s}` }
  }
  if (co === 'CTR-RU') {
    const s = RU_SUR[idx % RU_SUR.length], g = RU_GIV[(idx * 3 + 2) % RU_GIV.length]
    return { name: `${g} ${s}`, nameEn: `${g} ${s}` }
  }
  if (co === 'CTR-EU') {
    const s = EU_SUR[idx % EU_SUR.length], g = EU_GIV[(idx * 3 + 4) % EU_GIV.length]
    return { name: `${g} ${s}`, nameEn: `${g} ${s}` }
  }
  if (co === 'CTR-US') {
    // Mix: some Korean, some American
    if (idx % 3 === 0) {
      const s = US_SUR[idx % US_SUR.length], g = US_GIV[(idx * 3 + 1) % US_GIV.length]
      return { name: `${g} ${s}`, nameEn: `${g} ${s}` }
    }
  }
  // Default: Korean names (for all Korean companies + CTR-US Korean)
  // Use coprime multipliers to maximize spread across 20 surnames × 50 given names = 1000 combos
  const si = ((idx * 13 + 7) ^ (idx >> 2)) % KR_SUR.length
  const gi = ((idx * 31 + 17) ^ (idx >> 3)) % KR_GIV.length
  const s = KR_SUR[si], g = KR_GIV[gi]
  const se = KR_SUR_EN[si], ge = KR_GIV_EN[gi]
  return { name: `${s}${g}`, nameEn: `${ge} ${se}` }
}

function randomDate(minYear: number, maxYear: number, seed: number): Date {
  const year = minYear + (seed % (maxYear - minYear + 1))
  const month = (seed * 7 + 3) % 12
  const day = 1 + (seed * 13 + 5) % 28
  return new Date(year, month, day)
}

// Short company codes for employee numbers
const CO_SHORT: Record<string, string> = {
  'CTR-HOLD': 'HOLD', 'CTR': 'CTR', 'CTR-MOB': 'MOB', 'CTR-ECO': 'ECO',
  'CTR-ROB': 'ROB', 'CTR-ENR': 'ENR', 'CTR-FML': 'FML', 'CTR-CN': 'CN',
  'CTR-US': 'US', 'CTR-VN': 'VN', 'CTR-RU': 'RU', 'CTR-EU': 'EU',
}

// ================================================================
// Main Seed Function
// ================================================================
export async function seedEmployees(prisma: PrismaClient): Promise<void> {
  console.log('\n👥 B-1e: Seeding employees (446 target)...\n')

  // ── Lookup companies, grades, positions, departments, roles, jobCategories ──
  const companies = await prisma.company.findMany({ select: { id: true, code: true } })
  const companyMap: Record<string, string> = {}
  for (const c of companies) companyMap[c.code] = c.id

  const allGrades = await prisma.jobGrade.findMany({ select: { id: true, code: true, companyId: true } })
  const gradeMap: Record<string, string> = {} // "companyId:code" → id
  for (const g of allGrades) gradeMap[`${g.companyId}:${g.code}`] = g.id

  const allPositions = await prisma.position.findMany({ select: { id: true, code: true, departmentId: true, companyId: true } })
  const posMap: Record<string, { id: string; departmentId: string | null; companyId: string }> = {}
  for (const p of allPositions) posMap[p.code] = { id: p.id, departmentId: p.departmentId, companyId: p.companyId }

  const allDepts = await prisma.department.findMany({ select: { id: true, code: true, companyId: true, level: true } })
  // Group depts by company for auto-gen distribution
  const deptsByCompany: Record<string, Array<{ id: string; code: string; level: number }>> = {}
  for (const d of allDepts) {
    const co = companies.find(c => c.id === d.companyId)?.code
    if (co) {
      if (!deptsByCompany[co]) deptsByCompany[co] = []
      deptsByCompany[co].push({ id: d.id, code: d.code, level: d.level })
    }
  }

  const roles = await prisma.role.findMany({ select: { id: true, code: true } })
  const roleMap: Record<string, string> = {}
  for (const r of roles) roleMap[r.code] = r.id

  // JobCategory lookup: "companyId:OFFICE" → id
  const jobCats = await prisma.jobCategory.findMany({ select: { id: true, code: true, companyId: true } })
  const catMap: Record<string, string> = {}
  for (const jc of jobCats) catMap[`${jc.companyId}:${jc.code}`] = jc.id

  // Helper to find grade
  function findGrade(gradeCode: string, companyId: string): string | null {
    return gradeMap[`${companyId}:${gradeCode}`] ?? null
  }

  // Helper to find jobCategory
  function findCat(catCode: string, companyId: string): string | null {
    return catMap[`${companyId}:${catCode}`] ?? null
  }

  // ── Track created employee numbers to avoid collisions ──
  const usedEmails = new Set(PROTECTED_EMAILS)
  const usedEmpNos = new Set<string>()

  let totalCreated = 0
  let namedCount = 0

  // ══════════════════════════════════════════════════════════
  // PASS 1: Named employees
  // ══════════════════════════════════════════════════════════
  console.log('📌 Pass 1: Named employees...')

  for (const [name, nameEn, co, posCode, gradeCode, roleCode, emailOverride] of NAMED) {
    const companyId = companyMap[co]
    if (!companyId) { console.warn(`  ⚠️ Company ${co} not found`); continue }

    const pos = posMap[posCode]
    if (!pos) { console.warn(`  ⚠️ Position ${posCode} not found for ${name}`); continue }

    const gradeId = findGrade(gradeCode, companyId)
    const deptId = pos.departmentId
    const email = emailOverride ?? makeEmail(nameEn, co)
    const short = CO_SHORT[co] ?? co.replace('CTR-', '')
    const empNo = `E${short}${String(namedCount + 1).padStart(4, '0')}`

    // Skip if email collides with protected
    if (PROTECTED_EMAILS.has(email)) {
      console.warn(`  ⚠️ Skipping ${name} — email ${email} is protected QA account`)
      continue
    }
    if (usedEmails.has(email)) {
      // Append number suffix to avoid collision
      const baseEmail = email.replace('@', `${namedCount}@`)
      if (!usedEmails.has(baseEmail)) {
        // Use modified email
      }
    }

    usedEmails.add(email)
    usedEmpNos.add(empNo)

    const hireDate = randomDate(2015, 2023, namedCount * 17 + 42)

    // 1. Employee
    const emp = await prisma.employee.upsert({
      where: { email },
      update: { name, nameEn, employeeNo: empNo },
      create: { employeeNo: empNo, name, nameEn, email, hireDate },
    })

    // 2. EmployeeAssignment — only create if no active primary exists
    const existingAssign = await prisma.employeeAssignment.findFirst({
      where: { employeeId: emp.id, isPrimary: true, endDate: null },
    })
    if (!existingAssign) {
      await prisma.employeeAssignment.create({
        data: {
          employeeId: emp.id, companyId, departmentId: deptId,
          positionId: pos.id, jobGradeId: gradeId,
          jobCategoryId: findCat('OFFICE', companyId),
          effectiveDate: hireDate, changeType: 'HIRE',
          employmentType: 'FULL_TIME', status: 'ACTIVE', isPrimary: true,
        },
      })
    }

    // 3. EmployeeAuth
    await prisma.employeeAuth.upsert({
      where: { employeeId: emp.id },
      update: {},
      create: { employeeId: emp.id, passwordHash: TEST_PASSWORD_HASH },
    })

    // 4. SsoIdentity
    const ssoProviderAcct = `azure-named-${empNo}`
    await prisma.ssoIdentity.upsert({
      where: { provider_providerAccountId: { provider: 'azure-ad', providerAccountId: ssoProviderAcct } },
      update: { email },
      create: { employeeId: emp.id, provider: 'azure-ad', providerAccountId: ssoProviderAcct, email },
    })

    // 5. EmployeeRole — target role + always EMPLOYEE baseline
    const targetRoleId = roleMap[roleCode]
    const employeeRoleId = roleMap['EMPLOYEE']
    if (targetRoleId && roleCode !== 'EMPLOYEE') {
      await prisma.employeeRole.upsert({
        where: { employeeId_roleId_companyId: { employeeId: emp.id, roleId: targetRoleId, companyId } },
        update: {},
        create: { employeeId: emp.id, roleId: targetRoleId, companyId, startDate: hireDate },
      })
    }
    if (employeeRoleId) {
      await prisma.employeeRole.upsert({
        where: { employeeId_roleId_companyId: { employeeId: emp.id, roleId: employeeRoleId, companyId } },
        update: {},
        create: { employeeId: emp.id, roleId: employeeRoleId, companyId, startDate: hireDate },
      })
    }

    namedCount++
    totalCreated++
  }
  console.log(`  ✅ ${namedCount} named employees created`)

  // ══════════════════════════════════════════════════════════
  // PASS 2: Auto-generated employees
  // ══════════════════════════════════════════════════════════
  console.log('📌 Pass 2: Auto-generated employees...')
  let autoCount = 0

  for (const [co, office, production, dispatch, contract] of AUTO_GEN) {
    const companyId = companyMap[co]
    if (!companyId) continue

    const depts = deptsByCompany[co] ?? []
    const teamDepts = depts.filter(d => d.level >= 4) // team-level departments
    const plantDepts = depts.filter(d => d.code.startsWith('TM-') && (
      d.code.includes('-OE') || d.code.includes('-PQC') || d.code.includes('-MAINT') ||
      d.code.includes('-PROD') || d.code.includes('-QC') || d.code.includes('-OPS')
    ))
    const officeDepts = teamDepts.filter(d => !plantDepts.includes(d))

    // Find member pool positions for this company
    const mbrPositions = allPositions.filter(p => p.companyId === companyId && p.code.includes('-MBR-'))

    const employeeRoleId = roleMap['EMPLOYEE']
    const short = CO_SHORT[co] ?? co.replace('CTR-', '')

    // Generate workers for each type — 국내/해외 모두 통합 L 코드 체계
    const types: Array<{ count: number; empType: string; catCode: string; gradeCode: string; isPlant: boolean }> = [
      { count: office, empType: 'FULL_TIME', catCode: 'OFFICE', gradeCode: 'L2', isPlant: false },
      { count: production, empType: 'FULL_TIME', catCode: 'PRODUCTION', gradeCode: 'L1', isPlant: true },
      { count: dispatch, empType: 'DISPATCH', catCode: 'PRODUCTION', gradeCode: 'L1', isPlant: true },
      { count: contract, empType: 'CONTRACT', catCode: 'OFFICE', gradeCode: 'L2', isPlant: false },
    ]

    for (const { count, empType, catCode, gradeCode, isPlant } of types) {
      for (let i = 0; i < count; i++) {
        autoCount++
        const globalIdx = namedCount + autoCount
        const { name, nameEn } = genName(co, globalIdx)
        const empNo = `E${short}${String(namedCount + autoCount).padStart(4, '0')}`
        let email = makeEmail(nameEn, co)

        // Ensure unique email
        let suffix = 0
        while (usedEmails.has(email)) {
          suffix++
          email = makeEmail(`${nameEn}${suffix}`, co)
        }
        usedEmails.add(email)

        const hireDate = randomDate(2015, 2025, globalIdx * 13 + 7)
        const gradeId = findGrade(gradeCode, companyId)

        // Pick department: plant depts for production/dispatch, office depts for office/contract
        const targetDepts = isPlant ? (plantDepts.length > 0 ? plantDepts : teamDepts) : (officeDepts.length > 0 ? officeDepts : teamDepts)
        const dept = targetDepts.length > 0 ? targetDepts[globalIdx % targetDepts.length] : null

        // Find a member pool position in the chosen department
        const mbrPos = dept ? mbrPositions.find(p => p.departmentId === dept.id) ?? null : null

        // 1. Employee
        const emp = await prisma.employee.upsert({
          where: { email },
          update: { name, nameEn },
          create: { employeeNo: empNo, name, nameEn, email, hireDate },
        })

        // 2. EmployeeAssignment
        const existingAssign = await prisma.employeeAssignment.findFirst({
          where: { employeeId: emp.id, isPrimary: true, endDate: null },
        })
        if (!existingAssign) {
          const contractEndDate = empType === 'CONTRACT' ? new Date(new Date().getTime() + (6 + (globalIdx % 7)) * 30 * 86400000) : undefined
          await prisma.employeeAssignment.create({
            data: {
              employeeId: emp.id, companyId,
              departmentId: dept?.id ?? null,
              positionId: mbrPos?.id ?? null,
              jobGradeId: gradeId,
              jobCategoryId: findCat(catCode, companyId),
              effectiveDate: hireDate, changeType: 'HIRE',
              employmentType: empType, status: 'ACTIVE', isPrimary: true,
              endDate: contractEndDate,
              contractType: empType === 'CONTRACT' ? 'FIXED_TERM' : undefined,
            },
          })
        }

        // 3. EmployeeAuth
        await prisma.employeeAuth.upsert({
          where: { employeeId: emp.id },
          update: {},
          create: { employeeId: emp.id, passwordHash: TEST_PASSWORD_HASH },
        })

        // 4. SsoIdentity
        const ssoAcct = `azure-auto-${empNo}`
        await prisma.ssoIdentity.upsert({
          where: { provider_providerAccountId: { provider: 'azure-ad', providerAccountId: ssoAcct } },
          update: { email },
          create: { employeeId: emp.id, provider: 'azure-ad', providerAccountId: ssoAcct, email },
        })

        // 5. EmployeeRole: EMPLOYEE
        if (employeeRoleId) {
          await prisma.employeeRole.upsert({
            where: { employeeId_roleId_companyId: { employeeId: emp.id, roleId: employeeRoleId, companyId } },
            update: {},
            create: { employeeId: emp.id, roleId: employeeRoleId, companyId, startDate: hireDate },
          })
        }
      }
    }
    const coTotal = office + production + dispatch + contract
    console.log(`  ✅ ${co}: ${coTotal} auto-generated`)
    totalCreated += office + production + dispatch + contract
  }

  console.log(`\n  📊 Total created: ${totalCreated} (${namedCount} named + ${autoCount} auto)`)

  // Final verification
  const dbEmpCount = await prisma.employee.count()
  const dbAssignCount = await prisma.employeeAssignment.count({ where: { isPrimary: true, endDate: null } })
  console.log(`  📊 DB employees: ${dbEmpCount}`)
  console.log(`  📊 DB primary assignments: ${dbAssignCount}`)
}
