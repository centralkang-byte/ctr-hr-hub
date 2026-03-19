// ================================================================
// Track B B-1b: Department Seed Overhaul (~200 departments, 13 companies)
// prisma/seeds/36-departments.ts
//
// Real CTR org chart based on CTR-OrgStructure-HRHub-Plan.md Section 7
// Code convention: BU-/DIV-/PLT-/SEC-/TM-/PT- prefixes by level
//
// ⚠️ APPEND/UPSERT only — never deleteMany (FK protection)
// Idempotent: uses upsert on @@unique([companyId, code])
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

// [companyCode, code, name, nameEn, level, parentCode]
type DeptTuple = [string, string, string, string, number, string | null]

// ================================================================
// Department Data — Full CTR Group Org Chart
// ================================================================

const DEPT_DATA: DeptTuple[] = [
  // ────────────────────────────────────────────────────────────
  // CTR-HOLD (~15 departments)
  // ────────────────────────────────────────────────────────────
  ['CTR-HOLD', 'ROOT-HOLD', 'CTR홀딩스', 'CTR Holdings', 0, null],
  ['CTR-HOLD', 'DIV-MGMT', '경영관리본부', 'Management Division', 2, 'ROOT-HOLD'],
  ['CTR-HOLD', 'TM-FINPLAN', '재무기획팀', 'Financial Planning', 4, 'DIV-MGMT'],
  ['CTR-HOLD', 'TM-MGMT', '경영관리팀', 'Management Team', 4, 'DIV-MGMT'],
  ['CTR-HOLD', 'TM-MGMTSUP', '경영지원팀', 'Management Support', 4, 'DIV-MGMT'],
  ['CTR-HOLD', 'TM-BIZ', '사업팀', 'Business Team', 4, 'DIV-MGMT'],
  ['CTR-HOLD', 'DIV-COMPLIANCE', '컴플라이언스본부', 'Compliance Division', 2, 'ROOT-HOLD'],
  ['CTR-HOLD', 'TM-AUDIT', '경영진단팀', 'Management Audit', 4, 'DIV-COMPLIANCE'],
  ['CTR-HOLD', 'TM-LEGAL', '법무팀', 'Legal', 4, 'DIV-COMPLIANCE'],
  ['CTR-HOLD', 'TM-INFOSEC', '정보보안팀', 'Information Security', 4, 'DIV-COMPLIANCE'],
  ['CTR-HOLD', 'DIV-BTS', 'BTS본부', 'BTS Division', 2, 'ROOT-HOLD'],
  ['CTR-HOLD', 'TM-FUTUREPLAN', '미래기획팀', 'Future Planning', 4, 'DIV-BTS'],
  ['CTR-HOLD', 'TM-PI', 'PI팀', 'Process Innovation', 4, 'DIV-BTS'],
  ['CTR-HOLD', 'TM-COST', '원가팀', 'Cost Team', 4, 'DIV-BTS'],
  ['CTR-HOLD', 'SEC-CTO', 'CTO실', 'CTO Office', 3, 'ROOT-HOLD'],

  // ────────────────────────────────────────────────────────────
  // CTR — CEO Direct + OE Business Unit (~55 departments)
  // ────────────────────────────────────────────────────────────
  ['CTR', 'ROOT-CTR', 'CTR (주)', 'CTR Co., Ltd.', 0, null],

  // CEO Direct — CFO실
  ['CTR', 'SEC-CFO', 'CFO실', 'CFO Office', 3, 'ROOT-CTR'],
  ['CTR', 'TM-PNC', '피플앤컬처팀', 'People & Culture', 4, 'SEC-CFO'],
  ['CTR', 'TM-FPA', 'FP&A팀', 'FP&A', 4, 'SEC-CFO'],
  ['CTR', 'TM-BIZPLAN', '경영기획팀', 'Business Planning', 4, 'SEC-CFO'],
  ['CTR', 'TM-BIZSUP', '경영지원팀', 'Business Support', 4, 'SEC-CFO'],
  ['CTR', 'TM-FINANCE', '재무회계팀', 'Finance & Accounting', 4, 'SEC-CFO'],
  ['CTR', 'TM-EHS', 'EHS팀', 'EHS', 4, 'SEC-CFO'],
  ['CTR', 'TM-ESG', 'ESG팀', 'ESG', 4, 'SEC-CFO'],
  ['CTR', 'TM-IPO', 'IPO TFT', 'IPO Task Force', 4, 'SEC-CFO'],
  ['CTR', 'TM-PARTNER', '상생협력팀', 'Win-Win Cooperation', 4, 'SEC-CFO'],

  // OE 사업부문
  ['CTR', 'BU-OE', 'OE 사업부문', 'OE Business Unit', 1, 'ROOT-CTR'],
  ['CTR', 'DIV-SALES', '영업본부', 'Sales Division', 2, 'BU-OE'],
  ['CTR', 'TM-SALES1', '영업1팀', 'Sales Team 1', 4, 'DIV-SALES'],
  ['CTR', 'TM-SALES2', '영업2팀', 'Sales Team 2', 4, 'DIV-SALES'],
  ['CTR', 'TM-SALES3', '영업3팀', 'Sales Team 3', 4, 'DIV-SALES'],
  ['CTR', 'TM-SALES4', '영업4팀', 'Sales Team 4', 4, 'DIV-SALES'],
  ['CTR', 'DIV-PM', 'PM본부', 'PM Division', 2, 'BU-OE'],
  ['CTR', 'TM-APQC', 'APQC팀', 'APQC', 4, 'DIV-PM'],
  ['CTR', 'TM-PM', 'PM팀', 'PM', 4, 'DIV-PM'],
  ['CTR', 'DIV-RND', '연구개발본부', 'R&D Division', 2, 'BU-OE'],
  ['CTR', 'TM-RNDPLAN', '연구기획팀', 'R&D Planning', 4, 'DIV-RND'],
  ['CTR', 'TM-DESIGN', '제품설계팀', 'Product Design', 4, 'DIV-RND'],
  ['CTR', 'TM-ANALYSIS', '제품해석팀', 'Product Analysis', 4, 'DIV-RND'],
  ['CTR', 'TM-ADVTECH', '선행기술팀', 'Advanced Technology', 4, 'DIV-RND'],
  ['CTR', 'TM-MATERIAL', '소재기술팀', 'Materials Technology', 4, 'DIV-RND'],
  ['CTR', 'TM-PROTOTYPE', '시작시험팀', 'Prototype Testing', 4, 'DIV-RND'],
  ['CTR', 'DIV-PURCHASE', '구매본부', 'Purchasing Division', 2, 'BU-OE'],
  ['CTR', 'TM-PURPLAN', '구매기획팀', 'Purchase Planning', 4, 'DIV-PURCHASE'],
  ['CTR', 'TM-PURCHASE', '구매팀', 'Purchasing', 4, 'DIV-PURCHASE'],
  ['CTR', 'TM-PURCOST', '구매원가팀', 'Purchase Cost', 4, 'DIV-PURCHASE'],
  ['CTR', 'TM-SQ', 'SQ팀', 'Supplier Quality', 4, 'DIV-PURCHASE'],
  ['CTR', 'TM-GSOURCING', '글로벌소싱팀', 'Global Sourcing', 4, 'DIV-PURCHASE'],
  ['CTR', 'DIV-QUALITY', '품질본부', 'Quality Division', 2, 'BU-OE'],
  ['CTR', 'TM-QM', '품질경영팀', 'Quality Management', 4, 'DIV-QUALITY'],
  ['CTR', 'TM-ADVQUAL', '선행개발품질팀', 'Advanced Quality', 4, 'DIV-QUALITY'],
  ['CTR', 'TM-QC', '품질관리팀', 'Quality Control', 4, 'DIV-QUALITY'],
  ['CTR', 'DIV-SCM', 'SCM본부', 'SCM Division', 2, 'BU-OE'],
  ['CTR', 'TM-SCMPLAN', 'SCM기획팀', 'SCM Planning', 4, 'DIV-SCM'],
  ['CTR', 'TM-TM', 'TM팀', 'TM', 4, 'DIV-SCM'],
  ['CTR', 'TM-OM', 'OM팀', 'OM', 4, 'DIV-SCM'],
  ['CTR', 'TM-IE', 'IE팀', 'IE', 4, 'DIV-SCM'],
  ['CTR', 'DIV-PRODTECH', '생산기술본부', 'Production Technology Division', 2, 'BU-OE'],
  ['CTR', 'TM-PRODTECH1', '생산기술1팀', 'Production Tech 1', 4, 'DIV-PRODTECH'],
  ['CTR', 'TM-PRODTECH2', '생산기술2팀', 'Production Tech 2', 4, 'DIV-PRODTECH'],
  ['CTR', 'TM-PRODTECH3', '생산기술3팀', 'Production Tech 3', 4, 'DIV-PRODTECH'],
  ['CTR', 'PLT-CHANGWON', '창원공장', 'Changwon Plant', 2, 'BU-OE'],
  ['CTR', 'TM-CW-OE', 'OE팀', 'OE Team (Changwon)', 4, 'PLT-CHANGWON'],
  ['CTR', 'TM-CW-PQC', '공정품질관리팀', 'Process QC (Changwon)', 4, 'PLT-CHANGWON'],
  ['CTR', 'TM-CW-MAINT', '설비개선팀', 'Maintenance (Changwon)', 4, 'PLT-CHANGWON'],
  ['CTR', 'PLT-MASAN', '마산공장', 'Masan Plant', 2, 'BU-OE'],
  ['CTR', 'TM-MS-OE', 'OE팀', 'OE Team (Masan)', 4, 'PLT-MASAN'],
  ['CTR', 'TM-MS-PQC', '공정품질관리팀', 'Process QC (Masan)', 4, 'PLT-MASAN'],
  ['CTR', 'TM-MS-MAINT', '설비개선팀', 'Maintenance (Masan)', 4, 'PLT-MASAN'],
  ['CTR', 'PLT-YOUNGSAN', '영산공장', 'Youngsan Plant', 2, 'BU-OE'],
  ['CTR', 'TM-YS-OE', 'OE팀', 'OE Team (Youngsan)', 4, 'PLT-YOUNGSAN'],
  ['CTR', 'TM-YS-PQC', '공정품질관리팀', 'Process QC (Youngsan)', 4, 'PLT-YOUNGSAN'],
  ['CTR', 'TM-YS-CQC', '고객품질관리팀', 'Customer QC (Youngsan)', 4, 'PLT-YOUNGSAN'],
  ['CTR', 'TM-YS-MAINT', '설비개선팀', 'Maintenance (Youngsan)', 4, 'PLT-YOUNGSAN'],
  ['CTR', 'PLT-DAEHAP', '대합공장', 'Daehap Plant', 2, 'BU-OE'],
  ['CTR', 'TM-DH-OE', 'OE팀', 'OE Team (Daehap)', 4, 'PLT-DAEHAP'],
  ['CTR', 'TM-DH-MAINT', '설비개선팀', 'Maintenance (Daehap)', 4, 'PLT-DAEHAP'],

  // ────────────────────────────────────────────────────────────
  // CTR — AM Business Unit (~30 departments)
  // ────────────────────────────────────────────────────────────
  ['CTR', 'BU-AM', 'AM 사업부문', 'AM Business Unit', 1, 'ROOT-CTR'],
  ['CTR', 'SEC-CSO', 'CSO실', 'CSO Office', 3, 'BU-AM'],
  ['CTR', 'TM-AM-BIZPLAN', '경영기획팀', 'Business Planning (AM)', 4, 'SEC-CSO'],
  ['CTR', 'SEC-COOK', 'COO K실', 'COO K Office', 3, 'BU-AM'],
  ['CTR', 'TM-AM-PROCTECH', '공정기술팀', 'Process Technology (AM)', 4, 'SEC-COOK'],
  ['CTR', 'TM-AM-PRODMGMT', '생산관리팀', 'Production Management (AM)', 4, 'SEC-COOK'],
  ['CTR', 'TM-AM-QC', '품질관리팀', 'Quality Control (AM)', 4, 'SEC-COOK'],
  ['CTR', 'TM-AM-PRODMGMT2', '생산관리팀2', 'Production Management 2 (AM)', 4, 'SEC-COOK'],
  ['CTR', 'SEC-CDO', 'CDO실', 'CDO Office', 3, 'BU-AM'],
  ['CTR', 'TM-AM-SOURCING', '상품소싱개발팀', 'Product Sourcing (AM)', 4, 'SEC-CDO'],
  ['CTR', 'TM-AM-PM', 'PM팀', 'PM (AM)', 4, 'SEC-CDO'],
  ['CTR', 'TM-AM-NSDEV', 'NS개발팀', 'NS Development (AM)', 4, 'SEC-CDO'],
  ['CTR', 'TM-AM-PURCHASE', '구매팀', 'Purchasing (AM)', 4, 'SEC-CDO'],
  ['CTR', 'SEC-CMO', 'CMO실', 'CMO Office', 3, 'BU-AM'],
  ['CTR', 'TM-AM-MARCOM', '마케팅커뮤니케이션팀', 'Marketing Communication (AM)', 4, 'SEC-CMO'],
  ['CTR', 'TM-AM-DATA', '데이터팀', 'Data Team (AM)', 4, 'SEC-CMO'],
  ['CTR', 'TM-AM-ECOM', '이커머스팀', 'E-Commerce (AM)', 4, 'SEC-CMO'],
  ['CTR', 'SEC-CCO', 'CCO실', 'CCO Office', 3, 'BU-AM'],
  ['CTR', 'TM-AM-EUROPE', 'CTR EUROPE팀', 'CTR Europe (AM)', 4, 'SEC-CCO'],
  ['CTR', 'TM-AM-CIS', 'CIS팀', 'CIS (AM)', 4, 'SEC-CCO'],
  ['CTR', 'TM-AM-INDOPAC', 'INDO-PACIFIC팀', 'Indo-Pacific (AM)', 4, 'SEC-CCO'],
  ['CTR', 'TM-AM-AMERICA', 'AMERICA팀', 'America (AM)', 4, 'SEC-CCO'],
  ['CTR', 'TM-AM-LATAM', 'LATAM팀', 'LATAM (AM)', 4, 'SEC-CCO'],
  ['CTR', 'TM-AM-ASIAMKT', 'ASIA영업마케팅팀', 'Asia Sales Marketing (AM)', 4, 'SEC-CCO'],
  ['CTR', 'DIV-AM-RND', 'AM R&D센터', 'AM R&D Center', 2, 'BU-AM'],
  ['CTR', 'TM-AM-DESIGNV', '설계팀 V', 'Design V (AM)', 4, 'DIV-AM-RND'],
  ['CTR', 'TM-AM-DESIGNK', '설계팀 K', 'Design K (AM)', 4, 'DIV-AM-RND'],
  ['CTR', 'TM-AM-TESTK', '시험팀 K', 'Test K (AM)', 4, 'DIV-AM-RND'],
  ['CTR', 'TM-AM-GSCM', '글로벌SCM팀', 'Global SCM (AM)', 4, 'BU-AM'],
  ['CTR', 'TM-AM-MGMT', '경영관리팀', 'Management (AM)', 4, 'BU-AM'],

  // CTR — 전장 사업부문 (placeholder)
  ['CTR', 'BU-EJ', '전장 사업부문', 'EJ Business Unit', 1, 'ROOT-CTR'],

  // ────────────────────────────────────────────────────────────
  // CTR-MOB (~38 departments)
  // ────────────────────────────────────────────────────────────
  ['CTR-MOB', 'ROOT-MOB', 'CTR모빌리티', 'CTR Mobility', 0, null],
  ['CTR-MOB', 'DIV-MOB-RND', '연구개발본부', 'R&D Division (MOB)', 2, 'ROOT-MOB'],
  ['CTR-MOB', 'TM-MOB-ADVRES', '선행연구팀', 'Advanced Research (MOB)', 4, 'DIV-MOB-RND'],
  ['CTR-MOB', 'TM-MOB-DESIGN1', '설계1팀', 'Design 1 (MOB)', 4, 'DIV-MOB-RND'],
  ['CTR-MOB', 'TM-MOB-DESIGN2', '설계2팀', 'Design 2 (MOB)', 4, 'DIV-MOB-RND'],
  ['CTR-MOB', 'TM-MOB-PM', 'PM팀', 'PM (MOB)', 4, 'DIV-MOB-RND'],
  ['CTR-MOB', 'TM-MOB-PROTO', '시작팀', 'Prototype (MOB)', 4, 'DIV-MOB-RND'],
  ['CTR-MOB', 'TM-MOB-TEST', '시험팀', 'Testing (MOB)', 4, 'DIV-MOB-RND'],
  ['CTR-MOB', 'DIV-MOB-SALES', '영업본부', 'Sales Division (MOB)', 2, 'ROOT-MOB'],
  ['CTR-MOB', 'TM-MOB-SALES', '영업팀', 'Sales (MOB)', 4, 'DIV-MOB-SALES'],
  ['CTR-MOB', 'DIV-MOB-MGMT', '경영관리본부', 'Management Division (MOB)', 2, 'ROOT-MOB'],
  ['CTR-MOB', 'TM-MOB-MGMT', '경영관리팀', 'Management (MOB)', 4, 'DIV-MOB-MGMT'],
  ['CTR-MOB', 'TM-MOB-EHS', 'EHS팀', 'EHS (MOB)', 4, 'DIV-MOB-MGMT'],
  ['CTR-MOB', 'TM-MOB-INFOSEC', '정보보안팀', 'Information Security (MOB)', 4, 'DIV-MOB-MGMT'],
  ['CTR-MOB', 'DIV-MOB-PURCHASE', '구매본부', 'Purchasing Division (MOB)', 2, 'ROOT-MOB'],
  ['CTR-MOB', 'TM-MOB-PURCHASE', '구매팀', 'Purchasing (MOB)', 4, 'DIV-MOB-PURCHASE'],
  ['CTR-MOB', 'TM-MOB-SQ', 'SQ팀', 'Supplier Quality (MOB)', 4, 'DIV-MOB-PURCHASE'],
  ['CTR-MOB', 'DIV-MOB-FIN', '재무관리본부', 'Finance Division (MOB)', 2, 'ROOT-MOB'],
  ['CTR-MOB', 'TM-MOB-ACCT', '재경팀', 'Finance & Accounting (MOB)', 4, 'DIV-MOB-FIN'],
  ['CTR-MOB', 'TM-MOB-COSTACCT', '원가회계팀', 'Cost Accounting (MOB)', 4, 'DIV-MOB-FIN'],
  ['CTR-MOB', 'DIV-MOB-QUALITY', '품질본부', 'Quality Division (MOB)', 2, 'ROOT-MOB'],
  ['CTR-MOB', 'TM-MOB-QM', '품질경영팀', 'Quality Management (MOB)', 4, 'DIV-MOB-QUALITY'],
  ['CTR-MOB', 'DIV-MOB-PRODTECH', '생산기술센터', 'Production Tech Center (MOB)', 2, 'ROOT-MOB'],
  ['CTR-MOB', 'PLT-MOB-ULSAN', '울산공장', 'Ulsan Plant', 2, 'ROOT-MOB'],
  ['CTR-MOB', 'TM-MOB-UL-PRODTECH', '생산기술팀', 'Production Tech (Ulsan)', 4, 'PLT-MOB-ULSAN'],
  ['CTR-MOB', 'TM-MOB-UL-MAINT', '설비개선팀', 'Maintenance (Ulsan)', 4, 'PLT-MOB-ULSAN'],
  ['CTR-MOB', 'TM-MOB-UL-QC', '품질관리팀', 'Quality Control (Ulsan)', 4, 'PLT-MOB-ULSAN'],
  ['CTR-MOB', 'TM-MOB-UL-PRODOPS', '생산운영팀', 'Production Ops (Ulsan)', 4, 'PLT-MOB-ULSAN'],
  ['CTR-MOB', 'PLT-MOB-SEOSAN', '서산공장', 'Seosan Plant', 2, 'ROOT-MOB'],
  ['CTR-MOB', 'TM-MOB-SS-PRODTECH', '생산기술팀', 'Production Tech (Seosan)', 4, 'PLT-MOB-SEOSAN'],
  ['CTR-MOB', 'TM-MOB-SS-MAINT', '설비개선팀', 'Maintenance (Seosan)', 4, 'PLT-MOB-SEOSAN'],
  ['CTR-MOB', 'TM-MOB-SS-QC', '품질관리팀', 'Quality Control (Seosan)', 4, 'PLT-MOB-SEOSAN'],
  ['CTR-MOB', 'TM-MOB-SS-PRODOPS', '생산운영팀', 'Production Ops (Seosan)', 4, 'PLT-MOB-SEOSAN'],
  ['CTR-MOB', 'PLT-MOB-DAEGU', '대구공장', 'Daegu Plant', 2, 'ROOT-MOB'],
  ['CTR-MOB', 'TM-MOB-DG-PRODTECH', '생산기술팀', 'Production Tech (Daegu)', 4, 'PLT-MOB-DAEGU'],
  ['CTR-MOB', 'TM-MOB-DG-MAINT', '설비개선팀', 'Maintenance (Daegu)', 4, 'PLT-MOB-DAEGU'],
  ['CTR-MOB', 'TM-MOB-DG-QC', '품질관리팀', 'Quality Control (Daegu)', 4, 'PLT-MOB-DAEGU'],
  ['CTR-MOB', 'TM-MOB-DG-PRODOPS', '생산운영팀', 'Production Ops (Daegu)', 4, 'PLT-MOB-DAEGU'],

  // ────────────────────────────────────────────────────────────
  // CTR-ECO (~21 departments)
  // ────────────────────────────────────────────────────────────
  ['CTR-ECO', 'ROOT-ECO', 'CTR에코포징', 'CTR Ecoforging', 0, null],
  ['CTR-ECO', 'DIV-ECO-SALES', '영업본부', 'Sales Division (ECO)', 2, 'ROOT-ECO'],
  ['CTR-ECO', 'TM-ECO-SALES1', '영업1팀', 'Sales 1 (ECO)', 4, 'DIV-ECO-SALES'],
  ['CTR-ECO', 'DIV-ECO-RND', '연구개발본부', 'R&D Division (ECO)', 2, 'ROOT-ECO'],
  ['CTR-ECO', 'TM-ECO-ADVTECH', '선행기술팀', 'Advanced Tech (ECO)', 4, 'DIV-ECO-RND'],
  ['CTR-ECO', 'TM-ECO-MOLD', '금형개선팀', 'Mold Improvement (ECO)', 4, 'DIV-ECO-RND'],
  ['CTR-ECO', 'TM-ECO-FORGING', '단조개발팀', 'Forging Development (ECO)', 4, 'DIV-ECO-RND'],
  ['CTR-ECO', 'DIV-ECO-PURCHASE', '구매본부', 'Purchasing Division (ECO)', 2, 'ROOT-ECO'],
  ['CTR-ECO', 'TM-ECO-PURCHASE', '구매팀', 'Purchasing (ECO)', 4, 'DIV-ECO-PURCHASE'],
  ['CTR-ECO', 'TM-ECO-SQ', 'SQ팀', 'Supplier Quality (ECO)', 4, 'DIV-ECO-PURCHASE'],
  ['CTR-ECO', 'PLT-ECO-MIRYANG', '밀양공장', 'Miryang Plant', 2, 'ROOT-ECO'],
  ['CTR-ECO', 'TM-ECO-MY-OE', 'OE팀', 'OE (Miryang)', 4, 'PLT-ECO-MIRYANG'],
  ['CTR-ECO', 'TM-ECO-MY-QC', '품질관리팀', 'Quality Control (Miryang)', 4, 'PLT-ECO-MIRYANG'],
  ['CTR-ECO', 'TM-ECO-MY-PRODTECH', '생산기술팀', 'Production Tech (Miryang)', 4, 'PLT-ECO-MIRYANG'],
  ['CTR-ECO', 'TM-ECO-MY-MGMT', '경영관리팀', 'Management (Miryang)', 4, 'PLT-ECO-MIRYANG'],
  ['CTR-ECO', 'DIV-ECO-QUALITY', '품질본부', 'Quality Division (ECO)', 2, 'ROOT-ECO'],
  ['CTR-ECO', 'TM-ECO-QM', '품질경영팀', 'Quality Management (ECO)', 4, 'DIV-ECO-QUALITY'],
  ['CTR-ECO', 'TM-ECO-EHS', 'EHS팀', 'EHS (ECO)', 4, 'ROOT-ECO'],
  ['CTR-ECO', 'SEC-ECO-CFO', 'CFO실', 'CFO Office (ECO)', 3, 'ROOT-ECO'],
  ['CTR-ECO', 'TM-ECO-FPA', 'FP&A팀', 'FP&A (ECO)', 4, 'SEC-ECO-CFO'],
  ['CTR-ECO', 'TM-ECO-FINANCE', '재무회계팀', 'Finance & Accounting (ECO)', 4, 'SEC-ECO-CFO'],

  // ────────────────────────────────────────────────────────────
  // CTR-ROB (~17 departments)
  // ────────────────────────────────────────────────────────────
  ['CTR-ROB', 'ROOT-ROB', 'CTR Robotics', 'CTR Robotics', 0, null],
  ['CTR-ROB', 'DIV-ROB-MGMT', '경영지원본부', 'Management Support (ROB)', 2, 'ROOT-ROB'],
  ['CTR-ROB', 'TM-ROB-QC', '품질관리팀', 'Quality Control (ROB)', 4, 'DIV-ROB-MGMT'],
  ['CTR-ROB', 'TM-ROB-MGMTSUP', '경영지원팀', 'Management Support Team (ROB)', 4, 'DIV-ROB-MGMT'],
  ['CTR-ROB', 'TM-ROB-PURCHASE', '구매팀', 'Purchasing (ROB)', 4, 'DIV-ROB-MGMT'],
  ['CTR-ROB', 'DIV-ROB-SYSTEM', '시스템사업본부', 'System Business Division (ROB)', 2, 'ROOT-ROB'],
  ['CTR-ROB', 'TM-ROB-DESIGN', '설계팀', 'Design (ROB)', 4, 'DIV-ROB-SYSTEM'],
  ['CTR-ROB', 'TM-ROB-PM', 'PM팀', 'PM (ROB)', 4, 'DIV-ROB-SYSTEM'],
  ['CTR-ROB', 'TM-ROB-SALES1', '영업1팀', 'Sales 1 (ROB)', 4, 'DIV-ROB-SYSTEM'],
  ['CTR-ROB', 'TM-ROB-SALES2', '영업2팀', 'Sales 2 (ROB)', 4, 'DIV-ROB-SYSTEM'],
  ['CTR-ROB', 'TM-ROB-SALESPLAN', '영업기획팀', 'Sales Planning (ROB)', 4, 'DIV-ROB-SYSTEM'],
  ['CTR-ROB', 'DIV-ROB-TECH', '기술본부', 'Technology Division (ROB)', 2, 'ROOT-ROB'],
  ['CTR-ROB', 'TM-ROB-TS', 'TS팀', 'Technical Support (ROB)', 4, 'DIV-ROB-TECH'],
  ['CTR-ROB', 'TM-ROB-SW', 'S/W팀', 'Software (ROB)', 4, 'DIV-ROB-TECH'],
  ['CTR-ROB', 'TM-ROB-ADVTECH', '선행기술팀', 'Advanced Tech (ROB)', 4, 'DIV-ROB-TECH'],
  ['CTR-ROB', 'DIV-ROB-RESEARCH', '기업부설연구소', 'Corporate Research Lab (ROB)', 2, 'ROOT-ROB'],
  ['CTR-ROB', 'TM-ROB-PROFIT', '수익성강화 TFT', 'Profitability TFT (ROB)', 4, 'ROOT-ROB'],

  // ────────────────────────────────────────────────────────────
  // CTR-ENR (~8 departments)
  // ────────────────────────────────────────────────────────────
  ['CTR-ENR', 'ROOT-ENR', 'CTR에너지', 'CTR Energy', 0, null],
  ['CTR-ENR', 'DIV-ENR-RENEW', '신재생에너지사업본부', 'Renewable Energy Division', 2, 'ROOT-ENR'],
  ['CTR-ENR', 'PT-ENR-ICT', 'ICT 파트', 'ICT Part', 5, 'DIV-ENR-RENEW'],
  ['CTR-ENR', 'PT-ENR-RB1', 'RB1 파트', 'RB1 Part', 5, 'DIV-ENR-RENEW'],
  ['CTR-ENR', 'PT-ENR-RB2', 'RB2 파트', 'RB2 Part', 5, 'DIV-ENR-RENEW'],
  ['CTR-ENR', 'PT-ENR-RB3', 'RB3 파트', 'RB3 Part', 5, 'DIV-ENR-RENEW'],
  ['CTR-ENR', 'PT-ENR-ENG', '엔지니어링 파트', 'Engineering Part', 5, 'DIV-ENR-RENEW'],
  ['CTR-ENR', 'PT-ENR-EQUIP', '기자재솔루션 파트', 'Equipment Solutions Part', 5, 'DIV-ENR-RENEW'],

  // ────────────────────────────────────────────────────────────
  // CTR-FML (~6 departments)
  // ────────────────────────────────────────────────────────────
  ['CTR-FML', 'ROOT-FML', '포메이션랩스', 'Formationlabs', 0, null],
  ['CTR-FML', 'TM-FML-INFRA', '인프라 운영팀', 'Infrastructure Ops', 4, 'ROOT-FML'],
  ['CTR-FML', 'TM-FML-SYSOPS', '시스템 운영팀', 'System Operations', 4, 'ROOT-FML'],
  ['CTR-FML', 'TM-FML-DEV1', '솔루션 개발1팀', 'Solution Dev 1', 4, 'ROOT-FML'],
  ['CTR-FML', 'TM-FML-DEV2', '솔루션 개발2팀', 'Solution Dev 2', 4, 'ROOT-FML'],
  ['CTR-FML', 'TM-FML-SALES', '영업팀', 'Sales (FML)', 4, 'ROOT-FML'],

  // ────────────────────────────────────────────────────────────
  // CTR-CN (~19 departments)
  // ────────────────────────────────────────────────────────────
  ['CTR-CN', 'ROOT-CN', 'CTR China', 'CTR China', 0, null],
  ['CTR-CN', 'TM-CN-MGMTSUP', '경영지원팀', 'Management Support (CN)', 4, 'ROOT-CN'],
  ['CTR-CN', 'TM-CN-MGMT', '경영관리팀', 'Management (CN)', 4, 'ROOT-CN'],
  ['CTR-CN', 'DIV-CN-RND', '연구개발본부', 'R&D Division (CN)', 2, 'ROOT-CN'],
  ['CTR-CN', 'TM-CN-TEST', '시험팀', 'Testing (CN)', 4, 'DIV-CN-RND'],
  ['CTR-CN', 'TM-CN-DESIGN', '설계팀', 'Design (CN)', 4, 'DIV-CN-RND'],
  ['CTR-CN', 'DIV-CN-CRM', '고객관리본부', 'Customer Management (CN)', 2, 'ROOT-CN'],
  ['CTR-CN', 'TM-CN-PM', 'PM팀', 'PM (CN)', 4, 'DIV-CN-CRM'],
  ['CTR-CN', 'TM-CN-SALES', '영업팀', 'Sales (CN)', 4, 'DIV-CN-CRM'],
  ['CTR-CN', 'TM-CN-PURCHASE', '구매팀', 'Purchasing (CN)', 4, 'ROOT-CN'],
  ['CTR-CN', 'TM-CN-SQ', 'SQ팀', 'Supplier Quality (CN)', 4, 'ROOT-CN'],
  ['CTR-CN', 'DIV-CN-QUALITY', '품질본부', 'Quality Division (CN)', 2, 'ROOT-CN'],
  ['CTR-CN', 'TM-CN-QM', '품질경영팀', 'Quality Management (CN)', 4, 'DIV-CN-QUALITY'],
  ['CTR-CN', 'TM-CN-QC', '품질관리팀', 'Quality Control (CN)', 4, 'DIV-CN-QUALITY'],
  ['CTR-CN', 'PLT-CN-ZJG', '장가항공장', 'Zhangjiagang Plant', 2, 'ROOT-CN'],
  ['CTR-CN', 'TM-CN-ZJG-PROD', '생산팀', 'Production (ZJG)', 4, 'PLT-CN-ZJG'],
  ['CTR-CN', 'TM-CN-ZJG-MAINT', '설비개선팀', 'Maintenance (ZJG)', 4, 'PLT-CN-ZJG'],
  ['CTR-CN', 'TM-CN-ZJG-OE', 'OE팀', 'OE (ZJG)', 4, 'PLT-CN-ZJG'],
  ['CTR-CN', 'TM-CN-ZJG-PRODTECH', '생산기술팀', 'Production Tech (ZJG)', 4, 'PLT-CN-ZJG'],

  // ────────────────────────────────────────────────────────────
  // CTR-US (~12 departments)
  // ────────────────────────────────────────────────────────────
  ['CTR-US', 'ROOT-US', 'CTR America', 'CTR America', 0, null],
  ['CTR-US', 'SEC-US-CFO', 'CFO실', 'CFO Office (US)', 3, 'ROOT-US'],
  ['CTR-US', 'TM-US-MGMT', '경영관리팀', 'Management (US)', 4, 'SEC-US-CFO'],
  ['CTR-US', 'TM-US-PM', 'PM팀', 'PM (US)', 4, 'ROOT-US'],
  ['CTR-US', 'TM-US-CRM', '고객관리팀', 'Customer Management (US)', 4, 'ROOT-US'],
  ['CTR-US', 'TM-US-SALES', 'Sales팀', 'Sales (US)', 4, 'ROOT-US'],
  ['CTR-US', 'TM-US-SCM', 'SCM팀', 'SCM (US)', 4, 'ROOT-US'],
  ['CTR-US', 'PLT-US-MTY', '몬테레이공장', 'Monterrey Plant', 2, 'ROOT-US'],
  ['CTR-US', 'TM-US-MTY-PROD', '생산팀', 'Production (MTY)', 4, 'PLT-US-MTY'],
  ['CTR-US', 'TM-US-MTY-MAINT', '설비개선팀', 'Maintenance (MTY)', 4, 'PLT-US-MTY'],
  ['CTR-US', 'TM-US-MTY-OE', 'OE팀', 'OE (MTY)', 4, 'PLT-US-MTY'],
  ['CTR-US', 'TM-US-MTY-QC', '품질관리팀', 'Quality Control (MTY)', 4, 'PLT-US-MTY'],

  // ────────────────────────────────────────────────────────────
  // CTR-VN (~11 departments)
  // ────────────────────────────────────────────────────────────
  ['CTR-VN', 'ROOT-VN', 'CTR Vietnam', 'CTR Vietnam', 0, null],
  ['CTR-VN', 'SEC-VN-COO', 'COO V실', 'COO V Office', 3, 'ROOT-VN'],
  ['CTR-VN', 'TM-VN-MGMT', '경영관리팀', 'Management (VN)', 4, 'SEC-VN-COO'],
  ['CTR-VN', 'TM-VN-PROCTECH', '공정기술팀', 'Process Technology (VN)', 4, 'SEC-VN-COO'],
  ['CTR-VN', 'TM-VN-PRODMGMT', '생산관리팀', 'Production Management (VN)', 4, 'SEC-VN-COO'],
  ['CTR-VN', 'TM-VN-QC', '품질관리팀', 'Quality Control (VN)', 4, 'SEC-VN-COO'],
  ['CTR-VN', 'TM-VN-PURSCM', '구매SCM팀', 'Purchasing SCM (VN)', 4, 'SEC-VN-COO'],
  ['CTR-VN', 'DIV-VN-AMRND', 'AM R&D센터', 'AM R&D Center (VN)', 2, 'ROOT-VN'],
  ['CTR-VN', 'TM-VN-DESIGNV', '설계팀 V', 'Design V (VN)', 4, 'DIV-VN-AMRND'],
  ['CTR-VN', 'TM-VN-SALES', '영업팀', 'Sales (VN)', 4, 'DIV-VN-AMRND'],
  ['CTR-VN', 'TM-VN-MKT', '마케팅팀', 'Marketing (VN)', 4, 'ROOT-VN'],

  // ────────────────────────────────────────────────────────────
  // CTR-RU (~3 departments)
  // ────────────────────────────────────────────────────────────
  ['CTR-RU', 'ROOT-RU', 'CTR Russia', 'CTR Russia', 0, null],
  ['CTR-RU', 'TM-RU-MKT', '마케팅팀', 'Marketing (RU)', 4, 'ROOT-RU'],
  ['CTR-RU', 'TM-RU-SALES', '영업팀', 'Sales (RU)', 4, 'ROOT-RU'],

  // ────────────────────────────────────────────────────────────
  // CTR-EU (~1 department — placeholder)
  // ────────────────────────────────────────────────────────────
  ['CTR-EU', 'ROOT-EU', 'CTR Europe', 'CTR Europe', 0, null],
]

// ================================================================
// Seed Function
// ================================================================
export async function seedDepartments(prisma: PrismaClient): Promise<void> {
  console.log('\n🏢 B-1b: Seeding departments (~200, 13 companies)...\n')

  // ── Lookup companies ──
  const companies = await prisma.company.findMany({ select: { id: true, code: true } })
  const companyMap: Record<string, string> = {}
  for (const c of companies) companyMap[c.code] = c.id

  // Validate all company codes exist
  const usedCodes = [...new Set(DEPT_DATA.map(d => d[0]))]
  for (const code of usedCodes) {
    if (!companyMap[code]) {
      throw new Error(`Company code "${code}" not found in DB. Run base seed first.`)
    }
  }

  // ── Group by company ──
  const byCompany = new Map<string, DeptTuple[]>()
  for (const d of DEPT_DATA) {
    const co = d[0]
    if (!byCompany.has(co)) byCompany.set(co, [])
    byCompany.get(co)!.push(d)
  }

  // ── Upsert level by level (0 → 1 → 2 → 3 → 4 → 5) ──
  // Track deptCode → id per company for parent resolution
  const deptIdMap: Record<string, string> = {} // "companyCode:deptCode" → id

  const levels = [0, 1, 2, 3, 4, 5]
  let total = 0

  for (const level of levels) {
    const deptsAtLevel = DEPT_DATA.filter(d => d[4] === level)
    for (const [co, code, name, nameEn, lvl, parentCode] of deptsAtLevel) {
      const companyId = companyMap[co]

      // Resolve parent
      let parentId: string | null = null
      if (parentCode) {
        parentId = deptIdMap[`${co}:${parentCode}`] ?? null
        if (!parentId) {
          // Try looking up from DB (may exist from prior seeds)
          const existing = await prisma.department.findFirst({
            where: { companyId, code: parentCode },
            select: { id: true },
          })
          if (existing) parentId = existing.id
        }
        if (!parentId) {
          console.warn(`  ⚠️ Parent "${parentCode}" not found for ${co}:${code} — setting null`)
        }
      }

      // sortOrder = index within company
      const companyDepts = byCompany.get(co)!
      const sortOrder = companyDepts.findIndex(d => d[1] === code)

      const dept = await prisma.department.upsert({
        where: { companyId_code: { companyId, code } },
        update: { name, nameEn, level: lvl, sortOrder, parentId },
        create: { companyId, code, name, nameEn, level: lvl, sortOrder, parentId },
      })

      deptIdMap[`${co}:${code}`] = dept.id
      total++
    }
    if (deptsAtLevel.length > 0) {
      console.log(`  Level ${level}: ${deptsAtLevel.length} departments upserted`)
    }
  }

  // ── Verification ──
  const dbCount = await prisma.department.count()
  console.log(`\n  ✅ ${total} departments upserted (DB total: ${dbCount})`)

  // Check for orphans (non-root with null parent)
  const orphans = await prisma.department.count({
    where: { parentId: null, level: { not: 0 } },
  })
  if (orphans > 0) {
    console.warn(`  ⚠️ ${orphans} non-root departments have null parentId`)
  }

  // Level distribution
  for (const level of levels) {
    const count = DEPT_DATA.filter(d => d[4] === level).length
    if (count > 0) console.log(`    Level ${level}: ${count}`)
  }
}
