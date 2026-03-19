// ================================================================
// Track B B-1d: Position Tree with Reporting Lines (~300+ positions)
// prisma/seeds/38-positions.ts
//
// Full position hierarchy following CTR org chart.
// Position.code is @unique — can use upsert directly.
//
// Two-pass approach:
//   Pass 1: Create all positions (no reportsTo/dottedLine yet)
//   Pass 2: Set reportsToPositionId + dottedLinePositionId
//
// ⚠️ APPEND/UPSERT only — never deleteMany (FK protection)
// ⚠️ Cross-company dotted lines: lookup by code ONLY (no companyId filter)
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

// [code, titleKo, titleEn, companyCode, deptCode, reportsToCode, dottedLineCode]
type PosTuple = [string, string, string, string, string | null, string | null, string | null]

// ================================================================
// Position Data
// ================================================================

const POS_DATA: PosTuple[] = [
  // ════════════════════════════════════════════════════════════
  // CTR-HOLD Leadership
  // ════════════════════════════════════════════════════════════
  ['POS-HOLD-VCHAIR', '부회장', 'Vice Chairman', 'CTR-HOLD', 'ROOT-HOLD', null, null],
  ['POS-HOLD-DIR-MGMT', '경영관리본부장', 'Management Division Director', 'CTR-HOLD', 'DIV-MGMT', 'POS-HOLD-VCHAIR', null],
  ['POS-HOLD-DIR-COMPLIANCE', '컴플라이언스본부장', 'Compliance Division Director', 'CTR-HOLD', 'DIV-COMPLIANCE', 'POS-HOLD-VCHAIR', null],
  ['POS-HOLD-DIR-BTS', 'BTS본부장', 'BTS Division Director', 'CTR-HOLD', 'DIV-BTS', 'POS-HOLD-VCHAIR', null],
  ['POS-HOLD-SL-CTO', 'CTO', 'CTO', 'CTR-HOLD', 'SEC-CTO', 'POS-HOLD-VCHAIR', null],

  // HOLD Team Leaders
  ['POS-HOLD-TL-FINPLAN', '재무기획팀장', 'Financial Planning TL', 'CTR-HOLD', 'TM-FINPLAN', 'POS-HOLD-DIR-MGMT', null],
  ['POS-HOLD-TL-MGMT', '경영관리팀장', 'Management TL', 'CTR-HOLD', 'TM-MGMT', 'POS-HOLD-DIR-MGMT', null],
  ['POS-HOLD-TL-MGMTSUP', '경영지원팀장', 'Management Support TL', 'CTR-HOLD', 'TM-MGMTSUP', 'POS-HOLD-DIR-MGMT', null],
  ['POS-HOLD-TL-BIZ', '사업팀장', 'Business TL', 'CTR-HOLD', 'TM-BIZ', 'POS-HOLD-DIR-MGMT', null],
  ['POS-HOLD-TL-AUDIT', '경영진단팀장', 'Management Audit TL', 'CTR-HOLD', 'TM-AUDIT', 'POS-HOLD-DIR-COMPLIANCE', null],
  ['POS-HOLD-TL-LEGAL', '법무팀장', 'Legal TL', 'CTR-HOLD', 'TM-LEGAL', 'POS-HOLD-DIR-COMPLIANCE', null],
  ['POS-HOLD-TL-INFOSEC', '정보보안팀장', 'InfoSec TL', 'CTR-HOLD', 'TM-INFOSEC', 'POS-HOLD-DIR-COMPLIANCE', null],
  ['POS-HOLD-TL-FUTUREPLAN', '미래기획팀장', 'Future Planning TL', 'CTR-HOLD', 'TM-FUTUREPLAN', 'POS-HOLD-DIR-BTS', null],
  ['POS-HOLD-TL-PI', 'PI팀장', 'Process Innovation TL', 'CTR-HOLD', 'TM-PI', 'POS-HOLD-DIR-BTS', null],
  ['POS-HOLD-TL-COST', '원가팀장', 'Cost TL', 'CTR-HOLD', 'TM-COST', 'POS-HOLD-DIR-BTS', null],

  // HOLD Member pools
  ['POS-HOLD-MBR-FINPLAN', '재무기획팀원', 'Financial Planning Member', 'CTR-HOLD', 'TM-FINPLAN', 'POS-HOLD-TL-FINPLAN', null],
  ['POS-HOLD-MBR-MGMT', '경영관리팀원', 'Management Member', 'CTR-HOLD', 'TM-MGMT', 'POS-HOLD-TL-MGMT', null],
  ['POS-HOLD-MBR-MGMTSUP', '경영지원팀원', 'Management Support Member', 'CTR-HOLD', 'TM-MGMTSUP', 'POS-HOLD-TL-MGMTSUP', null],
  ['POS-HOLD-MBR-BIZ', '사업팀원', 'Business Member', 'CTR-HOLD', 'TM-BIZ', 'POS-HOLD-TL-BIZ', null],
  ['POS-HOLD-MBR-AUDIT', '경영진단팀원', 'Audit Member', 'CTR-HOLD', 'TM-AUDIT', 'POS-HOLD-TL-AUDIT', null],
  ['POS-HOLD-MBR-LEGAL', '법무팀원', 'Legal Member', 'CTR-HOLD', 'TM-LEGAL', 'POS-HOLD-TL-LEGAL', null],
  ['POS-HOLD-MBR-INFOSEC', '정보보안팀원', 'InfoSec Member', 'CTR-HOLD', 'TM-INFOSEC', 'POS-HOLD-TL-INFOSEC', null],
  ['POS-HOLD-MBR-FUTUREPLAN', '미래기획팀원', 'Future Planning Member', 'CTR-HOLD', 'TM-FUTUREPLAN', 'POS-HOLD-TL-FUTUREPLAN', null],
  ['POS-HOLD-MBR-PI', 'PI팀원', 'PI Member', 'CTR-HOLD', 'TM-PI', 'POS-HOLD-TL-PI', null],
  ['POS-HOLD-MBR-COST', '원가팀원', 'Cost Member', 'CTR-HOLD', 'TM-COST', 'POS-HOLD-TL-COST', null],

  // ════════════════════════════════════════════════════════════
  // CTR — CEO & CFO
  // ════════════════════════════════════════════════════════════
  ['POS-CTR-CEO', 'CTR 대표이사', 'CTR CEO', 'CTR', 'ROOT-CTR', 'POS-HOLD-VCHAIR', null],
  ['POS-CTR-SL-CFO', 'CFO', 'CFO', 'CTR', 'SEC-CFO', 'POS-CTR-CEO', null],

  // CFO실 Team Leaders
  ['POS-CTR-TL-PNC', '피플앤컬처팀장', 'People & Culture TL', 'CTR', 'TM-PNC', 'POS-CTR-SL-CFO', null],
  ['POS-CTR-TL-FPA', 'FP&A팀장', 'FP&A TL', 'CTR', 'TM-FPA', 'POS-CTR-SL-CFO', null],
  ['POS-CTR-TL-BIZPLAN', '경영기획팀장', 'Business Planning TL', 'CTR', 'TM-BIZPLAN', 'POS-CTR-SL-CFO', null],
  ['POS-CTR-TL-BIZSUP', '경영지원팀장', 'Business Support TL', 'CTR', 'TM-BIZSUP', 'POS-CTR-SL-CFO', null],
  ['POS-CTR-TL-FINANCE', '재무회계팀장', 'Finance TL', 'CTR', 'TM-FINANCE', 'POS-CTR-SL-CFO', null],
  ['POS-CTR-TL-EHS', 'EHS팀장', 'EHS TL', 'CTR', 'TM-EHS', 'POS-CTR-SL-CFO', null],
  ['POS-CTR-TL-ESG', 'ESG팀장', 'ESG TL', 'CTR', 'TM-ESG', 'POS-CTR-SL-CFO', null],
  ['POS-CTR-TL-IPO', 'IPO TFT장', 'IPO TFT Lead', 'CTR', 'TM-IPO', 'POS-CTR-SL-CFO', null],
  ['POS-CTR-TL-PARTNER', '상생협력팀장', 'Win-Win TL', 'CTR', 'TM-PARTNER', 'POS-CTR-SL-CFO', null],

  // ════════════════════════════════════════════════════════════
  // CTR — OE Business Unit
  // ════════════════════════════════════════════════════════════
  ['POS-CTR-HEAD-OE', 'OE 사업부문장', 'OE BU Head', 'CTR', 'BU-OE', 'POS-CTR-CEO', null],

  // Division Directors
  ['POS-CTR-DIR-SALES', '영업본부장', 'Sales Division Director', 'CTR', 'DIV-SALES', 'POS-CTR-HEAD-OE', null],
  ['POS-CTR-DIR-PM', 'PM본부장', 'PM Division Director', 'CTR', 'DIV-PM', 'POS-CTR-HEAD-OE', null],
  ['POS-CTR-DIR-RND', '연구개발본부장', 'R&D Division Director', 'CTR', 'DIV-RND', 'POS-CTR-HEAD-OE', null],
  ['POS-CTR-DIR-PURCHASE', '구매본부장', 'Purchasing Division Director', 'CTR', 'DIV-PURCHASE', 'POS-CTR-HEAD-OE', null],
  ['POS-CTR-DIR-QUALITY', '품질본부장', 'Quality Division Director', 'CTR', 'DIV-QUALITY', 'POS-CTR-HEAD-OE', null],
  ['POS-CTR-DIR-SCM', 'SCM본부장', 'SCM Division Director', 'CTR', 'DIV-SCM', 'POS-CTR-HEAD-OE', null],
  ['POS-CTR-DIR-PRODTECH', '생산기술본부장', 'Production Tech Director', 'CTR', 'DIV-PRODTECH', 'POS-CTR-HEAD-OE', null],

  // Plant Managers
  ['POS-CTR-PM-CHANGWON', '창원공장장', 'Changwon Plant Manager', 'CTR', 'PLT-CHANGWON', 'POS-CTR-HEAD-OE', null],
  ['POS-CTR-PM-MASAN', '마산공장장', 'Masan Plant Manager', 'CTR', 'PLT-MASAN', 'POS-CTR-HEAD-OE', null],
  ['POS-CTR-PM-YOUNGSAN', '영산공장장', 'Youngsan Plant Manager', 'CTR', 'PLT-YOUNGSAN', 'POS-CTR-HEAD-OE', null],
  ['POS-CTR-PM-DAEHAP', '대합공장장', 'Daehap Plant Manager', 'CTR', 'PLT-DAEHAP', 'POS-CTR-HEAD-OE', 'POS-CTR-HEAD-OE'],

  // OE Team Leaders — Sales
  ['POS-CTR-TL-SALES1', '영업1팀장', 'Sales 1 TL', 'CTR', 'TM-SALES1', 'POS-CTR-DIR-SALES', null],
  ['POS-CTR-TL-SALES2', '영업2팀장', 'Sales 2 TL', 'CTR', 'TM-SALES2', 'POS-CTR-DIR-SALES', null],
  ['POS-CTR-TL-SALES3', '영업3팀장', 'Sales 3 TL', 'CTR', 'TM-SALES3', 'POS-CTR-DIR-SALES', null],
  ['POS-CTR-TL-SALES4', '영업4팀장', 'Sales 4 TL', 'CTR', 'TM-SALES4', 'POS-CTR-DIR-SALES', null],
  // PM
  ['POS-CTR-TL-APQC', 'APQC팀장', 'APQC TL', 'CTR', 'TM-APQC', 'POS-CTR-DIR-PM', null],
  ['POS-CTR-TL-PM', 'PM팀장', 'PM TL', 'CTR', 'TM-PM', 'POS-CTR-DIR-PM', null],
  // R&D
  ['POS-CTR-TL-RNDPLAN', '연구기획팀장', 'R&D Planning TL', 'CTR', 'TM-RNDPLAN', 'POS-CTR-DIR-RND', null],
  ['POS-CTR-TL-DESIGN', '제품설계팀장', 'Product Design TL', 'CTR', 'TM-DESIGN', 'POS-CTR-DIR-RND', null],
  ['POS-CTR-TL-ANALYSIS', '제품해석팀장', 'Product Analysis TL', 'CTR', 'TM-ANALYSIS', 'POS-CTR-DIR-RND', null],
  ['POS-CTR-TL-ADVTECH', '선행기술팀장', 'Advanced Tech TL', 'CTR', 'TM-ADVTECH', 'POS-CTR-DIR-RND', null],
  ['POS-CTR-TL-MATERIAL', '소재기술팀장', 'Materials Tech TL', 'CTR', 'TM-MATERIAL', 'POS-CTR-DIR-RND', null],
  ['POS-CTR-TL-PROTOTYPE', '시작시험팀장', 'Prototype Testing TL', 'CTR', 'TM-PROTOTYPE', 'POS-CTR-DIR-RND', null],
  // Purchase
  ['POS-CTR-TL-PURPLAN', '구매기획팀장', 'Purchase Planning TL', 'CTR', 'TM-PURPLAN', 'POS-CTR-DIR-PURCHASE', null],
  ['POS-CTR-TL-PURCHASE', '구매팀장', 'Purchasing TL', 'CTR', 'TM-PURCHASE', 'POS-CTR-DIR-PURCHASE', null],
  ['POS-CTR-TL-PURCOST', '구매원가팀장', 'Purchase Cost TL', 'CTR', 'TM-PURCOST', 'POS-CTR-DIR-PURCHASE', null],
  ['POS-CTR-TL-SQ', 'SQ팀장', 'Supplier Quality TL', 'CTR', 'TM-SQ', 'POS-CTR-DIR-PURCHASE', null],
  ['POS-CTR-TL-GSOURCING', '글로벌소싱팀장', 'Global Sourcing TL', 'CTR', 'TM-GSOURCING', 'POS-CTR-DIR-PURCHASE', null],
  // Quality
  ['POS-CTR-TL-QM', '품질경영팀장', 'Quality Management TL', 'CTR', 'TM-QM', 'POS-CTR-DIR-QUALITY', null],
  ['POS-CTR-TL-ADVQUAL', '선행개발품질팀장', 'Advanced Quality TL', 'CTR', 'TM-ADVQUAL', 'POS-CTR-DIR-QUALITY', null],
  ['POS-CTR-TL-QC', '품질관리팀장', 'Quality Control TL', 'CTR', 'TM-QC', 'POS-CTR-DIR-QUALITY', null],
  // SCM
  ['POS-CTR-TL-SCMPLAN', 'SCM기획팀장', 'SCM Planning TL', 'CTR', 'TM-SCMPLAN', 'POS-CTR-DIR-SCM', null],
  ['POS-CTR-TL-TM', 'TM팀장', 'TM TL', 'CTR', 'TM-TM', 'POS-CTR-DIR-SCM', null],
  ['POS-CTR-TL-OM', 'OM팀장', 'OM TL', 'CTR', 'TM-OM', 'POS-CTR-DIR-SCM', null],
  ['POS-CTR-TL-IE', 'IE팀장', 'IE TL', 'CTR', 'TM-IE', 'POS-CTR-DIR-SCM', null],
  // Production Tech
  ['POS-CTR-TL-PRODTECH1', '생산기술1팀장', 'Production Tech 1 TL', 'CTR', 'TM-PRODTECH1', 'POS-CTR-DIR-PRODTECH', null],
  ['POS-CTR-TL-PRODTECH2', '생산기술2팀장', 'Production Tech 2 TL', 'CTR', 'TM-PRODTECH2', 'POS-CTR-DIR-PRODTECH', null],
  ['POS-CTR-TL-PRODTECH3', '생산기술3팀장', 'Production Tech 3 TL', 'CTR', 'TM-PRODTECH3', 'POS-CTR-DIR-PRODTECH', null],
  // Plants — Team Leaders
  ['POS-CTR-TL-CW-OE', 'OE팀장(창원)', 'OE TL (Changwon)', 'CTR', 'TM-CW-OE', 'POS-CTR-PM-CHANGWON', null],
  ['POS-CTR-TL-CW-PQC', '공정품질관리팀장(창원)', 'Process QC TL (Changwon)', 'CTR', 'TM-CW-PQC', 'POS-CTR-PM-CHANGWON', null],
  ['POS-CTR-TL-CW-MAINT', '설비개선팀장(창원)', 'Maintenance TL (Changwon)', 'CTR', 'TM-CW-MAINT', 'POS-CTR-PM-CHANGWON', null],
  ['POS-CTR-TL-MS-OE', 'OE팀장(마산)', 'OE TL (Masan)', 'CTR', 'TM-MS-OE', 'POS-CTR-PM-MASAN', null],
  ['POS-CTR-TL-MS-PQC', '공정품질관리팀장(마산)', 'Process QC TL (Masan)', 'CTR', 'TM-MS-PQC', 'POS-CTR-PM-MASAN', null],
  ['POS-CTR-TL-MS-MAINT', '설비개선팀장(마산)', 'Maintenance TL (Masan)', 'CTR', 'TM-MS-MAINT', 'POS-CTR-PM-MASAN', null],
  ['POS-CTR-TL-YS-OE', 'OE팀장(영산)', 'OE TL (Youngsan)', 'CTR', 'TM-YS-OE', 'POS-CTR-PM-YOUNGSAN', null],
  ['POS-CTR-TL-YS-PQC', '공정품질관리팀장(영산)', 'Process QC TL (Youngsan)', 'CTR', 'TM-YS-PQC', 'POS-CTR-PM-YOUNGSAN', null],
  ['POS-CTR-TL-YS-CQC', '고객품질관리팀장(영산)', 'Customer QC TL (Youngsan)', 'CTR', 'TM-YS-CQC', 'POS-CTR-PM-YOUNGSAN', null],
  ['POS-CTR-TL-YS-MAINT', '설비개선팀장(영산)', 'Maintenance TL (Youngsan)', 'CTR', 'TM-YS-MAINT', 'POS-CTR-PM-YOUNGSAN', null],
  ['POS-CTR-TL-DH-OE', 'OE팀장(대합)', 'OE TL (Daehap)', 'CTR', 'TM-DH-OE', 'POS-CTR-PM-DAEHAP', null],
  ['POS-CTR-TL-DH-MAINT', '설비개선팀장(대합)', 'Maintenance TL (Daehap)', 'CTR', 'TM-DH-MAINT', 'POS-CTR-PM-DAEHAP', null],

  // ════════════════════════════════════════════════════════════
  // CTR — AM Business Unit
  // ════════════════════════════════════════════════════════════
  ['POS-CTR-HEAD-AM', 'AM 사업부문장', 'AM BU Head', 'CTR', 'BU-AM', 'POS-CTR-CEO', null],
  ['POS-CTR-SL-CSO', 'CSO', 'CSO', 'CTR', 'SEC-CSO', 'POS-CTR-HEAD-AM', null],
  ['POS-CTR-SL-COOK', 'COO K', 'COO K', 'CTR', 'SEC-COOK', 'POS-CTR-HEAD-AM', null],
  ['POS-CTR-SL-CDO', 'CDO', 'CDO', 'CTR', 'SEC-CDO', 'POS-CTR-HEAD-AM', null],
  ['POS-CTR-SL-CMO', 'CMO', 'CMO', 'CTR', 'SEC-CMO', 'POS-CTR-HEAD-AM', null],
  ['POS-CTR-SL-CCO', 'CCO', 'CCO', 'CTR', 'SEC-CCO', 'POS-CTR-HEAD-AM', null],
  ['POS-CTR-DIR-AM-RND', 'AM R&D센터장', 'AM R&D Center Director', 'CTR', 'DIV-AM-RND', 'POS-CTR-HEAD-AM', null],

  // AM Team Leaders
  ['POS-CTR-TL-AM-BIZPLAN', '경영기획팀장(AM)', 'Biz Planning TL (AM)', 'CTR', 'TM-AM-BIZPLAN', 'POS-CTR-SL-CSO', null],
  ['POS-CTR-TL-AM-PROCTECH', '공정기술팀장(AM)', 'Process Tech TL (AM)', 'CTR', 'TM-AM-PROCTECH', 'POS-CTR-SL-COOK', null],
  ['POS-CTR-TL-AM-PRODMGMT', '생산관리팀장(AM)', 'Prod Mgmt TL (AM)', 'CTR', 'TM-AM-PRODMGMT', 'POS-CTR-SL-COOK', null],
  ['POS-CTR-TL-AM-QC', '품질관리팀장(AM)', 'QC TL (AM)', 'CTR', 'TM-AM-QC', 'POS-CTR-SL-COOK', null],
  ['POS-CTR-TL-AM-PRODMGMT2', '생산관리팀장2(AM)', 'Prod Mgmt 2 TL (AM)', 'CTR', 'TM-AM-PRODMGMT2', 'POS-CTR-SL-COOK', null],
  ['POS-CTR-TL-AM-SOURCING', '상품소싱개발팀장(AM)', 'Sourcing TL (AM)', 'CTR', 'TM-AM-SOURCING', 'POS-CTR-SL-CDO', null],
  ['POS-CTR-TL-AM-PM', 'PM팀장(AM)', 'PM TL (AM)', 'CTR', 'TM-AM-PM', 'POS-CTR-SL-CDO', null],
  ['POS-CTR-TL-AM-NSDEV', 'NS개발팀장(AM)', 'NS Dev TL (AM)', 'CTR', 'TM-AM-NSDEV', 'POS-CTR-SL-CDO', null],
  ['POS-CTR-TL-AM-PURCHASE', '구매팀장(AM)', 'Purchasing TL (AM)', 'CTR', 'TM-AM-PURCHASE', 'POS-CTR-SL-CDO', null],
  ['POS-CTR-TL-AM-MARCOM', '마케팅커뮤니케이션팀장(AM)', 'MarCom TL (AM)', 'CTR', 'TM-AM-MARCOM', 'POS-CTR-SL-CMO', null],
  ['POS-CTR-TL-AM-DATA', '데이터팀장(AM)', 'Data TL (AM)', 'CTR', 'TM-AM-DATA', 'POS-CTR-SL-CMO', null],
  ['POS-CTR-TL-AM-ECOM', '이커머스팀장(AM)', 'E-Commerce TL (AM)', 'CTR', 'TM-AM-ECOM', 'POS-CTR-SL-CMO', null],
  ['POS-CTR-TL-AM-EUROPE', 'CTR EUROPE팀장(AM)', 'CTR Europe TL (AM)', 'CTR', 'TM-AM-EUROPE', 'POS-CTR-SL-CCO', null],
  ['POS-CTR-TL-AM-CIS', 'CIS팀장(AM)', 'CIS TL (AM)', 'CTR', 'TM-AM-CIS', 'POS-CTR-SL-CCO', null],
  ['POS-CTR-TL-AM-INDOPAC', 'INDO-PACIFIC팀장(AM)', 'Indo-Pacific TL (AM)', 'CTR', 'TM-AM-INDOPAC', 'POS-CTR-SL-CCO', null],
  ['POS-CTR-TL-AM-AMERICA', 'AMERICA팀장(AM)', 'America TL (AM)', 'CTR', 'TM-AM-AMERICA', 'POS-CTR-SL-CCO', null],
  ['POS-CTR-TL-AM-LATAM', 'LATAM팀장(AM)', 'LATAM TL (AM)', 'CTR', 'TM-AM-LATAM', 'POS-CTR-SL-CCO', null],
  ['POS-CTR-TL-AM-ASIAMKT', 'ASIA영업마케팅팀장(AM)', 'Asia Sales Mkt TL (AM)', 'CTR', 'TM-AM-ASIAMKT', 'POS-CTR-SL-CCO', null],
  ['POS-CTR-TL-AM-DESIGNV', '설계팀V장(AM)', 'Design V TL (AM)', 'CTR', 'TM-AM-DESIGNV', 'POS-CTR-DIR-AM-RND', null],
  ['POS-CTR-TL-AM-DESIGNK', '설계팀K장(AM)', 'Design K TL (AM)', 'CTR', 'TM-AM-DESIGNK', 'POS-CTR-DIR-AM-RND', null],
  ['POS-CTR-TL-AM-TESTK', '시험팀K장(AM)', 'Test K TL (AM)', 'CTR', 'TM-AM-TESTK', 'POS-CTR-DIR-AM-RND', null],
  ['POS-CTR-TL-AM-GSCM', '글로벌SCM팀장(AM)', 'Global SCM TL (AM)', 'CTR', 'TM-AM-GSCM', 'POS-CTR-HEAD-AM', null],
  ['POS-CTR-TL-AM-MGMT', '경영관리팀장(AM)', 'Management TL (AM)', 'CTR', 'TM-AM-MGMT', 'POS-CTR-HEAD-AM', null],

  // CTR — EJ BU (placeholder)
  ['POS-CTR-HEAD-EJ', '전장 사업부문장', 'EJ BU Head', 'CTR', 'BU-EJ', 'POS-CTR-CEO', null],

  // ════════════════════════════════════════════════════════════
  // CTR-MOB — CEO + Divisions
  // ════════════════════════════════════════════════════════════
  ['POS-MOB-CEO', 'CTR모빌리티 대표', 'CTR Mobility CEO', 'CTR-MOB', 'ROOT-MOB', 'POS-CTR-CEO', null],
  ['POS-MOB-DIR-RND', '연구개발본부장(MOB)', 'R&D Director (MOB)', 'CTR-MOB', 'DIV-MOB-RND', 'POS-MOB-CEO', null],
  ['POS-MOB-DIR-SALES', '영업본부장(MOB)', 'Sales Director (MOB)', 'CTR-MOB', 'DIV-MOB-SALES', 'POS-MOB-CEO', null],
  ['POS-MOB-DIR-MGMT', '경영관리본부장(MOB)', 'Mgmt Director (MOB)', 'CTR-MOB', 'DIV-MOB-MGMT', 'POS-MOB-CEO', null],
  ['POS-MOB-DIR-PURCHASE', '구매본부장(MOB)', 'Purchasing Director (MOB)', 'CTR-MOB', 'DIV-MOB-PURCHASE', 'POS-MOB-CEO', 'POS-CTR-DIR-PURCHASE'],
  ['POS-MOB-DIR-FIN', '재무관리본부장(MOB)', 'Finance Director (MOB)', 'CTR-MOB', 'DIV-MOB-FIN', 'POS-MOB-CEO', null],
  ['POS-MOB-DIR-QUALITY', '품질본부장(MOB)', 'Quality Director (MOB)', 'CTR-MOB', 'DIV-MOB-QUALITY', 'POS-MOB-CEO', 'POS-CTR-DIR-QUALITY'],
  ['POS-MOB-DIR-PRODTECH', '생산기술센터장(MOB)', 'Production Tech Center Dir (MOB)', 'CTR-MOB', 'DIV-MOB-PRODTECH', 'POS-MOB-CEO', null],

  // Plant Managers
  ['POS-MOB-PM-ULSAN', '울산공장장', 'Ulsan Plant Manager', 'CTR-MOB', 'PLT-MOB-ULSAN', 'POS-MOB-CEO', null],
  ['POS-MOB-PM-SEOSAN', '서산공장장', 'Seosan Plant Manager', 'CTR-MOB', 'PLT-MOB-SEOSAN', 'POS-MOB-CEO', null],
  ['POS-MOB-PM-DAEGU', '대구공장장', 'Daegu Plant Manager', 'CTR-MOB', 'PLT-MOB-DAEGU', 'POS-MOB-CEO', null],

  // MOB Team Leaders
  ['POS-MOB-TL-ADVRES', '선행연구팀장(MOB)', 'Advanced Research TL (MOB)', 'CTR-MOB', 'TM-MOB-ADVRES', 'POS-MOB-DIR-RND', null],
  ['POS-MOB-TL-DESIGN1', '설계1팀장(MOB)', 'Design 1 TL (MOB)', 'CTR-MOB', 'TM-MOB-DESIGN1', 'POS-MOB-DIR-RND', null],
  ['POS-MOB-TL-DESIGN2', '설계2팀장(MOB)', 'Design 2 TL (MOB)', 'CTR-MOB', 'TM-MOB-DESIGN2', 'POS-MOB-DIR-RND', null],
  ['POS-MOB-TL-PM', 'PM팀장(MOB)', 'PM TL (MOB)', 'CTR-MOB', 'TM-MOB-PM', 'POS-MOB-DIR-RND', null],
  ['POS-MOB-TL-PROTO', '시작팀장(MOB)', 'Prototype TL (MOB)', 'CTR-MOB', 'TM-MOB-PROTO', 'POS-MOB-DIR-RND', null],
  ['POS-MOB-TL-TEST', '시험팀장(MOB)', 'Testing TL (MOB)', 'CTR-MOB', 'TM-MOB-TEST', 'POS-MOB-DIR-RND', null],
  ['POS-MOB-TL-SALES', '영업팀장(MOB)', 'Sales TL (MOB)', 'CTR-MOB', 'TM-MOB-SALES', 'POS-MOB-DIR-SALES', null],
  ['POS-MOB-TL-MGMT', '경영관리팀장(MOB)', 'Mgmt TL (MOB)', 'CTR-MOB', 'TM-MOB-MGMT', 'POS-MOB-DIR-MGMT', null],
  ['POS-MOB-TL-EHS', 'EHS팀장(MOB)', 'EHS TL (MOB)', 'CTR-MOB', 'TM-MOB-EHS', 'POS-MOB-DIR-MGMT', null],
  ['POS-MOB-TL-INFOSEC', '정보보안팀장(MOB)', 'InfoSec TL (MOB)', 'CTR-MOB', 'TM-MOB-INFOSEC', 'POS-MOB-DIR-MGMT', null],
  ['POS-MOB-TL-PURCHASE', '구매팀장(MOB)', 'Purchasing TL (MOB)', 'CTR-MOB', 'TM-MOB-PURCHASE', 'POS-MOB-DIR-PURCHASE', null],
  ['POS-MOB-TL-SQ', 'SQ팀장(MOB)', 'SQ TL (MOB)', 'CTR-MOB', 'TM-MOB-SQ', 'POS-MOB-DIR-PURCHASE', null],
  ['POS-MOB-TL-ACCT', '재경팀장(MOB)', 'Accounting TL (MOB)', 'CTR-MOB', 'TM-MOB-ACCT', 'POS-MOB-DIR-FIN', null],
  ['POS-MOB-TL-COSTACCT', '원가회계팀장(MOB)', 'Cost Accounting TL (MOB)', 'CTR-MOB', 'TM-MOB-COSTACCT', 'POS-MOB-DIR-FIN', null],
  ['POS-MOB-TL-QM', '품질경영팀장(MOB)', 'Quality Mgmt TL (MOB)', 'CTR-MOB', 'TM-MOB-QM', 'POS-MOB-DIR-QUALITY', null],

  // MOB Plant TLs
  ['POS-MOB-TL-UL-PRODTECH', '생산기술팀장(울산)', 'Production Tech TL (Ulsan)', 'CTR-MOB', 'TM-MOB-UL-PRODTECH', 'POS-MOB-PM-ULSAN', null],
  ['POS-MOB-TL-UL-MAINT', '설비개선팀장(울산)', 'Maintenance TL (Ulsan)', 'CTR-MOB', 'TM-MOB-UL-MAINT', 'POS-MOB-PM-ULSAN', null],
  ['POS-MOB-TL-UL-QC', '품질관리팀장(울산)', 'QC TL (Ulsan)', 'CTR-MOB', 'TM-MOB-UL-QC', 'POS-MOB-PM-ULSAN', null],
  ['POS-MOB-TL-UL-PRODOPS', '생산운영팀장(울산)', 'Prod Ops TL (Ulsan)', 'CTR-MOB', 'TM-MOB-UL-PRODOPS', 'POS-MOB-PM-ULSAN', null],
  ['POS-MOB-TL-SS-PRODTECH', '생산기술팀장(서산)', 'Production Tech TL (Seosan)', 'CTR-MOB', 'TM-MOB-SS-PRODTECH', 'POS-MOB-PM-SEOSAN', null],
  ['POS-MOB-TL-SS-MAINT', '설비개선팀장(서산)', 'Maintenance TL (Seosan)', 'CTR-MOB', 'TM-MOB-SS-MAINT', 'POS-MOB-PM-SEOSAN', null],
  ['POS-MOB-TL-SS-QC', '품질관리팀장(서산)', 'QC TL (Seosan)', 'CTR-MOB', 'TM-MOB-SS-QC', 'POS-MOB-PM-SEOSAN', null],
  ['POS-MOB-TL-SS-PRODOPS', '생산운영팀장(서산)', 'Prod Ops TL (Seosan)', 'CTR-MOB', 'TM-MOB-SS-PRODOPS', 'POS-MOB-PM-SEOSAN', null],
  ['POS-MOB-TL-DG-PRODTECH', '생산기술팀장(대구)', 'Production Tech TL (Daegu)', 'CTR-MOB', 'TM-MOB-DG-PRODTECH', 'POS-MOB-PM-DAEGU', null],
  ['POS-MOB-TL-DG-MAINT', '설비개선팀장(대구)', 'Maintenance TL (Daegu)', 'CTR-MOB', 'TM-MOB-DG-MAINT', 'POS-MOB-PM-DAEGU', null],
  ['POS-MOB-TL-DG-QC', '품질관리팀장(대구)', 'QC TL (Daegu)', 'CTR-MOB', 'TM-MOB-DG-QC', 'POS-MOB-PM-DAEGU', null],
  ['POS-MOB-TL-DG-PRODOPS', '생산운영팀장(대구)', 'Prod Ops TL (Daegu)', 'CTR-MOB', 'TM-MOB-DG-PRODOPS', 'POS-MOB-PM-DAEGU', null],

  // ════════════════════════════════════════════════════════════
  // CTR-ECO — Directors + TLs
  // ════════════════════════════════════════════════════════════
  ['POS-ECO-HEAD', 'CTR에코포징 대표', 'CTR Ecoforging Head', 'CTR-ECO', 'ROOT-ECO', 'POS-CTR-HEAD-OE', null],
  ['POS-ECO-DIR-SALES', '영업본부장(ECO)', 'Sales Director (ECO)', 'CTR-ECO', 'DIV-ECO-SALES', 'POS-ECO-HEAD', 'POS-CTR-DIR-SALES'],
  ['POS-ECO-DIR-RND', '연구개발본부장(ECO)', 'R&D Director (ECO)', 'CTR-ECO', 'DIV-ECO-RND', 'POS-ECO-HEAD', null],
  ['POS-ECO-DIR-PURCHASE', '구매본부장(ECO)', 'Purchase Director (ECO)', 'CTR-ECO', 'DIV-ECO-PURCHASE', 'POS-ECO-HEAD', 'POS-CTR-DIR-PURCHASE'],
  ['POS-ECO-PM-MIRYANG', '밀양공장장', 'Miryang Plant Manager', 'CTR-ECO', 'PLT-ECO-MIRYANG', 'POS-ECO-HEAD', null],
  ['POS-ECO-DIR-QUALITY', '품질본부장(ECO)', 'Quality Director (ECO)', 'CTR-ECO', 'DIV-ECO-QUALITY', 'POS-ECO-HEAD', 'POS-CTR-DIR-QUALITY'],
  ['POS-ECO-SL-CFO', 'CFO(ECO)', 'CFO (ECO)', 'CTR-ECO', 'SEC-ECO-CFO', 'POS-ECO-HEAD', null],

  // ECO Team Leaders
  ['POS-ECO-TL-SALES1', '영업1팀장(ECO)', 'Sales 1 TL (ECO)', 'CTR-ECO', 'TM-ECO-SALES1', 'POS-ECO-DIR-SALES', null],
  ['POS-ECO-TL-ADVTECH', '선행기술팀장(ECO)', 'Advanced Tech TL (ECO)', 'CTR-ECO', 'TM-ECO-ADVTECH', 'POS-ECO-DIR-RND', null],
  ['POS-ECO-TL-MOLD', '금형개선팀장(ECO)', 'Mold TL (ECO)', 'CTR-ECO', 'TM-ECO-MOLD', 'POS-ECO-DIR-RND', null],
  ['POS-ECO-TL-FORGING', '단조개발팀장(ECO)', 'Forging TL (ECO)', 'CTR-ECO', 'TM-ECO-FORGING', 'POS-ECO-DIR-RND', null],
  ['POS-ECO-TL-PURCHASE', '구매팀장(ECO)', 'Purchasing TL (ECO)', 'CTR-ECO', 'TM-ECO-PURCHASE', 'POS-ECO-DIR-PURCHASE', null],
  ['POS-ECO-TL-SQ', 'SQ팀장(ECO)', 'SQ TL (ECO)', 'CTR-ECO', 'TM-ECO-SQ', 'POS-ECO-DIR-PURCHASE', null],
  ['POS-ECO-TL-MY-OE', 'OE팀장(밀양)', 'OE TL (Miryang)', 'CTR-ECO', 'TM-ECO-MY-OE', 'POS-ECO-PM-MIRYANG', null],
  ['POS-ECO-TL-MY-QC', '품질관리팀장(밀양)', 'QC TL (Miryang)', 'CTR-ECO', 'TM-ECO-MY-QC', 'POS-ECO-PM-MIRYANG', null],
  ['POS-ECO-TL-MY-PRODTECH', '생산기술팀장(밀양)', 'Prod Tech TL (Miryang)', 'CTR-ECO', 'TM-ECO-MY-PRODTECH', 'POS-ECO-PM-MIRYANG', null],
  ['POS-ECO-TL-MY-MGMT', '경영관리팀장(밀양)', 'Mgmt TL (Miryang)', 'CTR-ECO', 'TM-ECO-MY-MGMT', 'POS-ECO-PM-MIRYANG', null],
  ['POS-ECO-TL-QM', '품질경영팀장(ECO)', 'Quality Mgmt TL (ECO)', 'CTR-ECO', 'TM-ECO-QM', 'POS-ECO-DIR-QUALITY', null],
  ['POS-ECO-TL-EHS', 'EHS팀장(ECO)', 'EHS TL (ECO)', 'CTR-ECO', 'TM-ECO-EHS', 'POS-ECO-HEAD', null],
  ['POS-ECO-TL-FPA', 'FP&A팀장(ECO)', 'FP&A TL (ECO)', 'CTR-ECO', 'TM-ECO-FPA', 'POS-ECO-SL-CFO', null],
  ['POS-ECO-TL-FINANCE', '재무회계팀장(ECO)', 'Finance TL (ECO)', 'CTR-ECO', 'TM-ECO-FINANCE', 'POS-ECO-SL-CFO', null],

  // ════════════════════════════════════════════════════════════
  // CTR-ROB
  // ════════════════════════════════════════════════════════════
  ['POS-ROB-CEO', 'CTR Robotics 대표', 'CTR Robotics CEO', 'CTR-ROB', 'ROOT-ROB', 'POS-HOLD-VCHAIR', null],
  ['POS-ROB-DIR-MGMT', '경영지원본부장(ROB)', 'Mgmt Support Director (ROB)', 'CTR-ROB', 'DIV-ROB-MGMT', 'POS-ROB-CEO', null],
  ['POS-ROB-DIR-SYSTEM', '시스템사업본부장(ROB)', 'System Biz Director (ROB)', 'CTR-ROB', 'DIV-ROB-SYSTEM', 'POS-ROB-CEO', null],
  ['POS-ROB-DIR-TECH', '기술본부장(ROB)', 'Technology Director (ROB)', 'CTR-ROB', 'DIV-ROB-TECH', 'POS-ROB-CEO', null],
  ['POS-ROB-DIR-RESEARCH', '연구소장(ROB)', 'Research Lab Director (ROB)', 'CTR-ROB', 'DIV-ROB-RESEARCH', 'POS-ROB-CEO', null],

  // ROB Team Leaders
  ['POS-ROB-TL-QC', '품질관리팀장(ROB)', 'QC TL (ROB)', 'CTR-ROB', 'TM-ROB-QC', 'POS-ROB-DIR-MGMT', null],
  ['POS-ROB-TL-MGMTSUP', '경영지원팀장(ROB)', 'Mgmt Support TL (ROB)', 'CTR-ROB', 'TM-ROB-MGMTSUP', 'POS-ROB-DIR-MGMT', null],
  ['POS-ROB-TL-PURCHASE', '구매팀장(ROB)', 'Purchasing TL (ROB)', 'CTR-ROB', 'TM-ROB-PURCHASE', 'POS-ROB-DIR-MGMT', null],
  ['POS-ROB-TL-DESIGN', '설계팀장(ROB)', 'Design TL (ROB)', 'CTR-ROB', 'TM-ROB-DESIGN', 'POS-ROB-DIR-SYSTEM', null],
  ['POS-ROB-TL-PM', 'PM팀장(ROB)', 'PM TL (ROB)', 'CTR-ROB', 'TM-ROB-PM', 'POS-ROB-DIR-SYSTEM', null],
  ['POS-ROB-TL-SALES1', '영업1팀장(ROB)', 'Sales 1 TL (ROB)', 'CTR-ROB', 'TM-ROB-SALES1', 'POS-ROB-DIR-SYSTEM', null],
  ['POS-ROB-TL-SALES2', '영업2팀장(ROB)', 'Sales 2 TL (ROB)', 'CTR-ROB', 'TM-ROB-SALES2', 'POS-ROB-DIR-SYSTEM', null],
  ['POS-ROB-TL-SALESPLAN', '영업기획팀장(ROB)', 'Sales Planning TL (ROB)', 'CTR-ROB', 'TM-ROB-SALESPLAN', 'POS-ROB-DIR-SYSTEM', null],
  ['POS-ROB-TL-TS', 'TS팀장(ROB)', 'Technical Support TL (ROB)', 'CTR-ROB', 'TM-ROB-TS', 'POS-ROB-DIR-TECH', null],
  ['POS-ROB-TL-SW', 'S/W팀장(ROB)', 'Software TL (ROB)', 'CTR-ROB', 'TM-ROB-SW', 'POS-ROB-DIR-TECH', null],
  ['POS-ROB-TL-ADVTECH', '선행기술팀장(ROB)', 'Advanced Tech TL (ROB)', 'CTR-ROB', 'TM-ROB-ADVTECH', 'POS-ROB-DIR-TECH', null],
  ['POS-ROB-TL-PROFIT', '수익성강화TFT장(ROB)', 'Profitability TFT Lead (ROB)', 'CTR-ROB', 'TM-ROB-PROFIT', 'POS-ROB-CEO', null],

  // ════════════════════════════════════════════════════════════
  // CTR-ENR
  // ════════════════════════════════════════════════════════════
  ['POS-ENR-CEO', 'CTR에너지 대표', 'CTR Energy CEO', 'CTR-ENR', 'ROOT-ENR', 'POS-HOLD-VCHAIR', null],
  ['POS-ENR-DIR-RENEW', '신재생에너지사업본부장', 'Renewable Energy Director', 'CTR-ENR', 'DIV-ENR-RENEW', 'POS-ENR-CEO', null],
  ['POS-ENR-PL-ICT', 'ICT파트장', 'ICT Part Leader', 'CTR-ENR', 'PT-ENR-ICT', 'POS-ENR-DIR-RENEW', null],
  ['POS-ENR-PL-RB1', 'RB1파트장', 'RB1 Part Leader', 'CTR-ENR', 'PT-ENR-RB1', 'POS-ENR-DIR-RENEW', null],
  ['POS-ENR-PL-RB2', 'RB2파트장', 'RB2 Part Leader', 'CTR-ENR', 'PT-ENR-RB2', 'POS-ENR-DIR-RENEW', null],
  ['POS-ENR-PL-RB3', 'RB3파트장', 'RB3 Part Leader', 'CTR-ENR', 'PT-ENR-RB3', 'POS-ENR-DIR-RENEW', null],
  ['POS-ENR-PL-ENG', '엔지니어링파트장', 'Engineering Part Leader', 'CTR-ENR', 'PT-ENR-ENG', 'POS-ENR-DIR-RENEW', null],
  ['POS-ENR-PL-EQUIP', '기자재솔루션파트장', 'Equipment Solutions Part Leader', 'CTR-ENR', 'PT-ENR-EQUIP', 'POS-ENR-DIR-RENEW', null],

  // ════════════════════════════════════════════════════════════
  // CTR-FML
  // ════════════════════════════════════════════════════════════
  ['POS-FML-CEO', '포메이션랩스 CEO', 'Formationlabs CEO', 'CTR-FML', 'ROOT-FML', 'POS-HOLD-VCHAIR', null],
  ['POS-FML-TL-INFRA', '인프라운영팀장', 'Infrastructure Ops TL', 'CTR-FML', 'TM-FML-INFRA', 'POS-FML-CEO', null],
  ['POS-FML-TL-SYSOPS', '시스템운영팀장', 'System Ops TL', 'CTR-FML', 'TM-FML-SYSOPS', 'POS-FML-CEO', null],
  ['POS-FML-TL-DEV1', '솔루션개발1팀장', 'Solution Dev 1 TL', 'CTR-FML', 'TM-FML-DEV1', 'POS-FML-CEO', null],
  ['POS-FML-TL-DEV2', '솔루션개발2팀장', 'Solution Dev 2 TL', 'CTR-FML', 'TM-FML-DEV2', 'POS-FML-CEO', null],
  ['POS-FML-TL-SALES', '영업팀장(FML)', 'Sales TL (FML)', 'CTR-FML', 'TM-FML-SALES', 'POS-FML-CEO', null],

  // ════════════════════════════════════════════════════════════
  // CTR-CN — 총경리 + Team Leaders
  // ════════════════════════════════════════════════════════════
  ['POS-CN-CEO', 'CTR China 총경리', 'CTR China General Manager', 'CTR-CN', 'ROOT-CN', 'POS-CTR-CEO', null],
  ['POS-CN-DIR-RND', '연구개발본부장(CN)', 'R&D Director (CN)', 'CTR-CN', 'DIV-CN-RND', 'POS-CN-CEO', 'POS-CTR-DIR-RND'],
  ['POS-CN-DIR-CRM', '고객관리본부장(CN)', 'CRM Director (CN)', 'CTR-CN', 'DIV-CN-CRM', 'POS-CN-CEO', null],
  ['POS-CN-DIR-QUALITY', '품질본부장(CN)', 'Quality Director (CN)', 'CTR-CN', 'DIV-CN-QUALITY', 'POS-CN-CEO', 'POS-CTR-DIR-QUALITY'],
  ['POS-CN-PM-ZJG', '장가항공장장', 'Zhangjiagang Plant Mgr', 'CTR-CN', 'PLT-CN-ZJG', 'POS-CN-CEO', null],

  ['POS-CN-TL-MGMTSUP', '경영지원팀장(CN)', 'Mgmt Support TL (CN)', 'CTR-CN', 'TM-CN-MGMTSUP', 'POS-CN-CEO', null],
  ['POS-CN-TL-MGMT', '경영관리팀장(CN)', 'Management TL (CN)', 'CTR-CN', 'TM-CN-MGMT', 'POS-CN-CEO', null],
  ['POS-CN-TL-TEST', '시험팀장(CN)', 'Testing TL (CN)', 'CTR-CN', 'TM-CN-TEST', 'POS-CN-DIR-RND', null],
  ['POS-CN-TL-DESIGN', '설계팀장(CN)', 'Design TL (CN)', 'CTR-CN', 'TM-CN-DESIGN', 'POS-CN-DIR-RND', null],
  ['POS-CN-TL-PM', 'PM팀장(CN)', 'PM TL (CN)', 'CTR-CN', 'TM-CN-PM', 'POS-CN-DIR-CRM', null],
  ['POS-CN-TL-SALES', '영업팀장(CN)', 'Sales TL (CN)', 'CTR-CN', 'TM-CN-SALES', 'POS-CN-DIR-CRM', null],
  ['POS-CN-TL-PURCHASE', '구매팀장(CN)', 'Purchasing TL (CN)', 'CTR-CN', 'TM-CN-PURCHASE', 'POS-CN-CEO', 'POS-CTR-DIR-PURCHASE'],
  ['POS-CN-TL-SQ', 'SQ팀장(CN)', 'SQ TL (CN)', 'CTR-CN', 'TM-CN-SQ', 'POS-CN-CEO', null],
  ['POS-CN-TL-QM', '품질경영팀장(CN)', 'Quality Mgmt TL (CN)', 'CTR-CN', 'TM-CN-QM', 'POS-CN-DIR-QUALITY', null],
  ['POS-CN-TL-QC', '품질관리팀장(CN)', 'QC TL (CN)', 'CTR-CN', 'TM-CN-QC', 'POS-CN-DIR-QUALITY', null],
  ['POS-CN-TL-ZJG-PROD', '생산팀장(ZJG)', 'Production TL (ZJG)', 'CTR-CN', 'TM-CN-ZJG-PROD', 'POS-CN-PM-ZJG', null],
  ['POS-CN-TL-ZJG-MAINT', '설비개선팀장(ZJG)', 'Maintenance TL (ZJG)', 'CTR-CN', 'TM-CN-ZJG-MAINT', 'POS-CN-PM-ZJG', null],
  ['POS-CN-TL-ZJG-OE', 'OE팀장(ZJG)', 'OE TL (ZJG)', 'CTR-CN', 'TM-CN-ZJG-OE', 'POS-CN-PM-ZJG', null],
  ['POS-CN-TL-ZJG-PRODTECH', '생산기술팀장(ZJG)', 'Prod Tech TL (ZJG)', 'CTR-CN', 'TM-CN-ZJG-PRODTECH', 'POS-CN-PM-ZJG', null],

  // ════════════════════════════════════════════════════════════
  // CTR-US
  // ════════════════════════════════════════════════════════════
  ['POS-US-CEO', 'CTR America 법인장', 'CTR America President', 'CTR-US', 'ROOT-US', 'POS-CTR-CEO', null],
  ['POS-US-SL-CFO', 'CFO(US)', 'CFO (US)', 'CTR-US', 'SEC-US-CFO', 'POS-US-CEO', null],
  ['POS-US-TL-MGMT', '경영관리팀장(US)', 'Management TL (US)', 'CTR-US', 'TM-US-MGMT', 'POS-US-SL-CFO', null],
  ['POS-US-TL-PM', 'PM팀장(US)', 'PM TL (US)', 'CTR-US', 'TM-US-PM', 'POS-US-CEO', null],
  ['POS-US-TL-CRM', '고객관리팀장(US)', 'CRM TL (US)', 'CTR-US', 'TM-US-CRM', 'POS-US-CEO', null],
  ['POS-US-TL-SALES', 'Sales팀장(US)', 'Sales TL (US)', 'CTR-US', 'TM-US-SALES', 'POS-US-CEO', null],
  ['POS-US-TL-SCM', 'SCM팀장(US)', 'SCM TL (US)', 'CTR-US', 'TM-US-SCM', 'POS-US-CEO', 'POS-CTR-DIR-SCM'],
  ['POS-US-PM-MTY', '몬테레이공장장', 'Monterrey Plant Manager', 'CTR-US', 'PLT-US-MTY', 'POS-US-CEO', null],
  ['POS-US-TL-MTY-PROD', '생산팀장(MTY)', 'Production TL (MTY)', 'CTR-US', 'TM-US-MTY-PROD', 'POS-US-PM-MTY', null],
  ['POS-US-TL-MTY-MAINT', '설비개선팀장(MTY)', 'Maintenance TL (MTY)', 'CTR-US', 'TM-US-MTY-MAINT', 'POS-US-PM-MTY', null],
  ['POS-US-TL-MTY-OE', 'OE팀장(MTY)', 'OE TL (MTY)', 'CTR-US', 'TM-US-MTY-OE', 'POS-US-PM-MTY', null],
  ['POS-US-TL-MTY-QC', '품질관리팀장(MTY)', 'QC TL (MTY)', 'CTR-US', 'TM-US-MTY-QC', 'POS-US-PM-MTY', null],

  // ════════════════════════════════════════════════════════════
  // CTR-VN
  // ════════════════════════════════════════════════════════════
  ['POS-VN-COO', 'CTR Vietnam COO', 'CTR Vietnam COO', 'CTR-VN', 'ROOT-VN', 'POS-CTR-HEAD-AM', null],
  ['POS-VN-DIR-AMRND', 'AM R&D센터장(VN)', 'AM R&D Center Director (VN)', 'CTR-VN', 'DIV-VN-AMRND', 'POS-VN-COO', null],
  ['POS-VN-TL-MGMT', '경영관리팀장(VN)', 'Management TL (VN)', 'CTR-VN', 'TM-VN-MGMT', 'POS-VN-COO', 'POS-CTR-HEAD-AM'],
  ['POS-VN-TL-PROCTECH', '공정기술팀장(VN)', 'Process Tech TL (VN)', 'CTR-VN', 'TM-VN-PROCTECH', 'POS-VN-COO', 'POS-CTR-HEAD-AM'],
  ['POS-VN-TL-PRODMGMT', '생산관리팀장(VN)', 'Prod Mgmt TL (VN)', 'CTR-VN', 'TM-VN-PRODMGMT', 'POS-VN-COO', 'POS-CTR-HEAD-AM'],
  ['POS-VN-TL-QC', '품질관리팀장(VN)', 'QC TL (VN)', 'CTR-VN', 'TM-VN-QC', 'POS-VN-COO', 'POS-CTR-HEAD-AM'],
  ['POS-VN-TL-PURSCM', '구매SCM팀장(VN)', 'Purchasing SCM TL (VN)', 'CTR-VN', 'TM-VN-PURSCM', 'POS-VN-COO', 'POS-CTR-HEAD-AM'],
  ['POS-VN-TL-DESIGNV', '설계팀V장(VN)', 'Design V TL (VN)', 'CTR-VN', 'TM-VN-DESIGNV', 'POS-VN-DIR-AMRND', null],
  ['POS-VN-TL-SALES', '영업팀장(VN)', 'Sales TL (VN)', 'CTR-VN', 'TM-VN-SALES', 'POS-VN-DIR-AMRND', null],
  ['POS-VN-TL-MKT', '마케팅팀장(VN)', 'Marketing TL (VN)', 'CTR-VN', 'TM-VN-MKT', 'POS-VN-COO', null],

  // ════════════════════════════════════════════════════════════
  // CTR-RU
  // ════════════════════════════════════════════════════════════
  ['POS-RU-HEAD', 'CTR Russia 대표', 'CTR Russia Head', 'CTR-RU', 'ROOT-RU', 'POS-CTR-SL-CCO', null],
  ['POS-RU-TL-MKT', '마케팅팀장(RU)', 'Marketing TL (RU)', 'CTR-RU', 'TM-RU-MKT', 'POS-RU-HEAD', null],
  ['POS-RU-TL-SALES', '영업팀장(RU)', 'Sales TL (RU)', 'CTR-RU', 'TM-RU-SALES', 'POS-RU-HEAD', null],

  // ════════════════════════════════════════════════════════════
  // CTR-EU
  // ════════════════════════════════════════════════════════════
  ['POS-EU-HEAD', 'CTR Europe 대표', 'CTR Europe Head', 'CTR-EU', 'ROOT-EU', 'POS-CTR-SL-CCO', null],
]

// ================================================================
// Generate Member Pool positions for every team-level (4+) department
// that has a TL position but no explicit MBR position
// ================================================================
function generateMemberPools(): PosTuple[] {
  const pools: PosTuple[] = []
  const existingCodes = new Set(POS_DATA.map(p => p[0]))

  // Map dept code → position code for TLs
  const tlByDept = new Map<string, string>() // "co:deptCode" → posCode
  for (const [posCode, , , co, deptCode, ,] of POS_DATA) {
    if (deptCode && (posCode.includes('-TL-') || posCode.includes('-PL-'))) {
      tlByDept.set(`${co}:${deptCode}`, posCode)
    }
  }

  // For each TL, generate MBR if not already exists
  for (const [key, tlCode] of tlByDept) {
    const [co, deptCode] = key.split(':')
    // Generate member code from TL code
    const mbrCode = tlCode.replace(/-TL-/, '-MBR-').replace(/-PL-/, '-MBR-')
    if (existingCodes.has(mbrCode)) continue

    const tlEntry = POS_DATA.find(p => p[0] === tlCode)
    if (!tlEntry) continue

    const titleKo = tlEntry[1].replace('팀장', '팀원').replace('파트장', '파트원')
    const titleEn = tlEntry[2].replace(' TL', ' Member').replace(' Part Leader', ' Part Member')
    pools.push([mbrCode, titleKo, titleEn, co, deptCode, tlCode, null])
  }

  return pools
}

// ================================================================
// Seed Function
// ================================================================
export async function seedPositions(prisma: PrismaClient): Promise<void> {
  console.log('\n👤 B-1d: Seeding positions with reporting lines...\n')

  // ── Merge data + member pools ──
  const memberPools = generateMemberPools()
  const ALL_POSITIONS = [...POS_DATA, ...memberPools]
  console.log(`  Total positions to seed: ${ALL_POSITIONS.length} (${POS_DATA.length} explicit + ${memberPools.length} member pools)`)

  // ── Lookup companies ──
  const companies = await prisma.company.findMany({ select: { id: true, code: true } })
  const companyMap: Record<string, string> = {}
  for (const c of companies) companyMap[c.code] = c.id

  // ── Lookup departments ──
  const departments = await prisma.department.findMany({ select: { id: true, code: true, companyId: true } })
  const deptMap: Record<string, string> = {} // "companyCode:deptCode" → id
  for (const d of departments) {
    const co = companies.find(c => c.id === d.companyId)?.code
    if (co) deptMap[`${co}:${d.code}`] = d.id
  }

  // ── Pass 1: Create/update all positions (without reporting lines) ──
  console.log('  Pass 1: Creating positions...')
  let created = 0

  for (const [code, titleKo, titleEn, co, deptCode, ,] of ALL_POSITIONS) {
    const companyId = companyMap[co]
    if (!companyId) {
      console.warn(`  ⚠️ Company "${co}" not found for position ${code}`)
      continue
    }

    const departmentId = deptCode ? deptMap[`${co}:${deptCode}`] ?? null : null

    await prisma.position.upsert({
      where: { code },
      update: { titleKo, titleEn, companyId, departmentId },
      create: { code, titleKo, titleEn, companyId, departmentId },
    })
    created++
  }
  console.log(`  ✅ Pass 1: ${created} positions upserted`)

  // ── Build code → id map ──
  const allPositions = await prisma.position.findMany({ select: { id: true, code: true } })
  const posIdMap: Record<string, string> = {}
  for (const p of allPositions) posIdMap[p.code] = p.id

  // ── Pass 2: Set reportsTo + dottedLine ──
  console.log('  Pass 2: Setting reporting lines...')
  let reportsSet = 0
  let dottedSet = 0

  for (const [code, , , , , reportsToCode, dottedLineCode] of ALL_POSITIONS) {
    const posId = posIdMap[code]
    if (!posId) continue

    const reportsToId = reportsToCode ? posIdMap[reportsToCode] ?? null : null
    const dottedLineId = dottedLineCode ? posIdMap[dottedLineCode] ?? null : null

    // Only update if there's something to set
    if (reportsToId || dottedLineId) {
      const data: { reportsToPositionId?: string | null; dottedLinePositionId?: string | null } = {}
      if (reportsToCode) {
        data.reportsToPositionId = reportsToId
        if (reportsToId) reportsSet++
        else console.warn(`  ⚠️ reportsTo "${reportsToCode}" not found for ${code}`)
      }
      if (dottedLineCode) {
        data.dottedLinePositionId = dottedLineId
        if (dottedLineId) dottedSet++
        else console.warn(`  ⚠️ dottedLine "${dottedLineCode}" not found for ${code}`)
      }
      await prisma.position.update({ where: { id: posId }, data })
    }
  }
  console.log(`  ✅ Pass 2: ${reportsSet} reportsTo + ${dottedSet} dottedLine relationships set`)

  // ── Verification ──
  const dbCount = await prisma.position.count()
  const orphans = await prisma.position.count({
    where: { reportsToPositionId: null, code: { not: 'POS-HOLD-VCHAIR' } },
  })
  // Exclude positions from old seeds (QA positions, etc.) that may not have reportsTo
  console.log(`\n  📊 DB total positions: ${dbCount}`)
  console.log(`  📊 Positions without reportsTo (excl. Chairman): ${orphans}`)
  console.log(`  📊 Dotted line relationships: ${dottedSet}`)
}
