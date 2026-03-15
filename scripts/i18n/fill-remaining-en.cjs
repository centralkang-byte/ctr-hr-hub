#!/usr/bin/env node
/**
 * Fill remaining EN translations from en_missing.json
 * Reads missing items, translates them, updates _done files
 */
const fs = require('fs');
const path = require('path');

const CHUNKS_DIR = path.join(__dirname, 'chunks');
const missingPath = path.join(CHUNKS_DIR, 'en_missing.json');

if (!fs.existsSync(missingPath)) {
  console.log('No missing items file found.');
  process.exit(0);
}

const missing = JSON.parse(fs.readFileSync(missingPath, 'utf-8'));

// Direct ko→en map for all remaining items
const translations = {
  // Settings - titles / positions
  "순서": "Order",
  "법인 기본정보": "Entity Basic Info",
  "통화": "Currency",
  "필드 키": "Field Key",
  "영문": "English",
  "레벨": "Level",
  "재무/회계": "Finance/Accounting",
  "생산/제조": "Production/Manufacturing",
  "영업": "Sales",
  "마케팅": "Marketing",
  "대리": "Assistant Manager",
  "과세": "Taxable",
  "차장": "Deputy Director",
  "이사": "Director",
  "승진 소요": "Promotion Tenure",
  "수습 연장 허용": "Allow Probation Extension",
  "변경을 취소했습니다": "Change has been cancelled.",
  "월 기본급 기준": "Based on Monthly Base Salary",
  "연봉 기준": "Based on Annual Salary",
  "정액": "Fixed Amount",
  "통화/환율": "Currency/Exchange Rate",
  "환율": "Exchange Rate",
  "출처": "Source",
  "법정": "Statutory",
  "연봉 밴드": "Salary Band",
  "직종": "Job Category",
  "중간": "Middle",
  "교통비 (자가운전보조금)": "Transportation Allowance (Commuting Subsidy)",
  "자녀보육수당": "Childcare Allowance",
  "연구활동비": "Research Activity Allowance",
  "생산직 야간근로수당": "Production Night Shift Premium",
  "비과세 한도": "Tax Exemption Limit",
  "한도액 (월)": "Monthly Limit",
  "근거": "Legal Basis",
  "본부 단위": "Headquarters Level",
  "법인 전체": "All Entities",
  "직접 변경 허용": "Allow Direct Changes",
  "일마다 리마인더": "days reminder interval",
  "역량 라이브러리": "Competency Library",
  "글로벌 고정": "Global Fixed",
  "배분 가이드라인 설정": "Distribution Guideline Settings",
  "배분 가이드": "Distribution Guide",
  "초안": "Draft",
  "개": "items",
  "이력서 자동 파싱": "Auto Resume Parsing",
  "AI 스크리닝": "AI Screening",
  "점 이상": "points or above",
  "오프보딩 체크리스트": "Offboarding Checklist",
  "체크리스트 추가": "Add Checklist",
  "체크리스트명": "Checklist Name",
  "태스크 수": "Number of Tasks",
  "서류접수": "Document Receipt",
  "서류심사": "Document Screening",
  "처우 협의": "Compensation Negotiation",
  "불합격": "Failed",
  "새로고침": "Refresh",
  "날짜": "Date",
  "데이터 보존 정책": "Data Retention Policy",
  "데이터 보존": "Data Retention",
  "PII 마스킹 활성화": "Enable PII Masking",
  "ERP 연동": "ERP Integration",
  "연동": "Integration",
  "언어/타임존": "Language/Timezone",
  "앱 푸시": "App Push",
  "이벤트": "Event",
  "조회 전용": "View Only",
  "기본 근무시간": "Base Working Hours",
  "일 기준 근무시간": "Daily Working Hours",
  "주 근무일수": "Weekly Work Days",
  "주 최대 근무시간": "Maximum Weekly Hours",
  "유연근무제 (Flex Time)": "Flexible Work (Flex Time)",
  "유연근무제 활성화": "Enable Flexible Work",
  "임계값": "Threshold",
  "주의": "Caution",
  "클락인 차단 활성화": "Enable Clock-in Blocking",
  "교대근무 활성화": "Enable Shift Work",
  "교대근무 사용": "Use Shift Work",
  "교대근무 상세 설정": "Shift Work Detail Settings",
  "초과 근무 차단": "Overtime Blocking",
  "시간": "Hours",
  "연간 부여": "Annual Grant",
  "월별 부여": "Monthly Grant",
  "수동 부여": "Manual Grant",
  "회계연도 기준": "Fiscal Year Basis",
  "연간 일괄 부여": "Annual Bulk Grant",
  "월별 적립": "Monthly Accrual",
  "회계연도 (1/1)": "Fiscal Year (Jan 1)",
  "이월 불가": "No Carryover",
  "전액 이월": "Full Carryover",
  "무제한": "Unlimited",
  "회 이상": "times or more",
  "월간보고": "Monthly Report",
  "대결": "Acting",
  "보기": "View",
  "컴플라이언스": "Compliance",
  "대기 중 변경 요청": "Pending Change Requests",
  "자세히": "Details",
  "연말 정산": "Year-end Tax Settlement",
  "유급": "Paid",
  "무급": "Unpaid",
  "야간근무": "Night Shift",
  "조 수": "Number of Groups",
  "야간 가산": "Night Premium",
  "교대 수": "Number of Shifts",
  "수당 계산 배율": "Allowance Multiplier",
  "근무 유형": "Work Type",
  "단위": "Unit",
  "사전 승인 활성화": "Enable Pre-approval",
  "순환보직": "Job Rotation",
  "전무": "Senior Managing Director",
  "법인 오버라이드": "Entity Override",
  "되돌리기": "Revert",
  "키": "Key",
  "라벨": "Label",
  "색상": "Color",
  "빈도": "Frequency",
  // Long sentences
  "직급 체계는 현재 시스템에서 관리됩니다. API 연결 후 편집이 가능합니다.": "Job grade system is managed by the system. Editing available after API connection.",
  "직종/직무": "Job Category/Function",
  "직종/직무 분류는 현재 시스템에서 관리됩니다. API 연결 후 편집이 가능합니다.": "Job category/function classification is managed by the system. Editing available after API connection.",
  "연차촉진 규칙은 현재 시스템에 하드코딩되어 있습니다. 이 설정 화면은 H-2c에서 실제 시스템과 연결됩니다.": "Annual leave promotion rules are currently hardcoded. This settings screen will connect to the actual system in phase H-2c.",
  "직속 상사": "Direct Supervisor",
  "HR 담당자": "HR Manager",
  "연말 소멸": "Year-end Expiration",
  "이월 후 소멸": "Post-carryover Expiration",
  "— 이월 규칙에 따라 이월 후 잔여분 소멸": "— Remaining leave after carryover expires per rule",
  "소멸": "Expiration",
  "일 전 경고": "days prior warning",
  "코드": "Code",
  "반차": "Half Day",
  "증빙": "Evidence",
  "범위": "Range",
  "연장근무 (주간)": "Overtime (Weekly)",
  "법정근로시간 초과 시": "When statutory work hours exceeded",
  "배": "×",
  "배 가산": "× Premium",
  "법정 공휴일 및 주말 근무 시": "For statutory holidays and weekend work",
  "본인 (필수)": "Self (Required)",
  "등급별 권장 배분 비율": "Recommended distribution ratio by grade",
  "강제 배분 적용": "Apply Forced Distribution",
  "등급 체계가 설정되지 않았습니다": "Grade system not configured",
  "등급 × 밴드위치 기반 연봉 인상률 (%)": "Grade × bandwidth-based salary raise rate (%)",
  "인상률 매트릭스가 설정되지 않았습니다": "Raise rate matrix not configured",
  "인상률 매트릭스": "Raise Rate Matrix",
  "계좌이체": "Bank Transfer",
  "수표": "Check",
  "AI 기반 서류 심사 자동화 설정": "AI-powered document screening automation settings",
  "합격 시 자동 전환": "Auto-transition on pass",
  "설정을 변경하면 자동으로 기록됩니다.": "Settings changes are automatically recorded.",
  "자동 삭제 활성화": "Enable Auto-deletion",
  "법인별 기본 언어 및 타임존 설정": "Per-entity language and timezone settings",
  "역할/권한은 시스템에서 관리됩니다. 변경이 필요하면 시스템 관리자에게 문의하세요.": "Roles and permissions are managed by the system. Contact the system administrator for changes.",
  "설정을 불러오는데 실패했습니다.": "Failed to load settings.",
  "경고 임계값은 주의 < 경고 < 차단 순서여야 합니다.": "Alert thresholds must be in order: Caution < Warning < Block.",
  "법인 기준 표준 근무시간을 설정합니다.": "Set standard working hours per entity.",
  "코어 타임과 최소 일일 근무시간을 설정합니다.": "Set core time and minimum daily work hours.",
  "직원이 코어 타임 내에서 출퇴근 시간을 자유롭게 조정합니다.": "Employees can freely adjust clock-in/out within core time.",
  "주간 누적 근무시간이 임계값에 도달하면 알림이 발송됩니다.": "Notifications are sent when weekly cumulative work hours reach the threshold.",
  "차단 임계값 도달 시 클락인을 차단합니다.": "Clock-in is blocked when blocking threshold is reached.",
  "차단 임계값 초과 시 직원의 출근 기록이 자동으로 거부됩니다.": "Employee clock-in records are automatically rejected when blocking threshold is exceeded.",
  "법인에서 교대근무(2교대/3교대)를 운영합니다.": "Entity operates shift work (2-shift/3-shift).",
  "활성화하면 교대근무 패턴 및 그룹 관리 기능이 활성화됩니다.": "When enabled, shift work pattern and group management features are activated.",
  "잔여 연차가 0일 미만으로 내려갈 수 있도록 허용": "Allow remaining annual leave to go below 0 days",
  "입사 첫해 비례 부여": "Prorated granting in first year",
  "입사일이 연도 중간인 경우 비례 계산하여 부여": "Prorated calculation for mid-year hires",
  "6개 법인 KPI 나란히 비교": "Compare KPIs across 6 entities side by side",
  "안녕하세요, {name}님!": "Hello, {name}!",
  "군복무 등록, 전자문서(КЭДО) 및 법정 보고서 관리": "Military service registration, electronic documents, and statutory reports",
  "한국 비과세 한도 (소득세법 §12 ②)": "Korea Tax Exemption Limits (Income Tax Act §12 ②)",
  "항목별 비과세 한도액 (2025 기준)": "Tax exemption limits per item (2025 basis)",
  "세법 개정 시 관리자가 직접 한도액을 수정할 수 있습니다. 변경 사항은 급여 계산에 즉시 반영됩니다.": "Admins can update limits directly when tax laws change. Changes are reflected immediately in payroll calculations.",
  "월별 교대 일정 배정 및 조 편성": "Monthly shift schedule assignment and group allocation",
  "교대근무 야간 수당 안내": "Shift Work Night Premium Info",
  "교대 근무 패턴을 생성하고 조별로 배정합니다": "Create shift patterns and assign to groups",
  "법인별 수당 배율이 다릅니다": "Allowance multipliers differ by entity",
  "법인별 참고 배율": "Reference multiplier by entity",
  "법인별 기본 언어 및 타임존 설정": "Per-entity language and timezone settings",
  "· 법인을 선택하면 해당 법인 공휴일이 표시됩니다": "· Select an entity to display its statutory holidays",
  "기본 근무시간, 점심시간, 유연근무 설정": "Base working hours, lunch break, flex work settings",
  "법정 주간 근무 상한과 알림 임계값 설정": "Statutory weekly work limit and notification threshold settings",
  "시간 (근로기준법 기준)": "Hours (per Labor Standards Act)",
  "마이너스 연차 허용": "Allow Negative Annual Leave",
  "최대 마이너스 한도:": "Maximum negative limit:",
  "비례 부여 활성화": "Enable Proportional Granting",
  "부여 방식": "Granting Method",
  "이월 소멸": "Carryover Expiration",
  "가산": "Premium",
  "상한": "Upper Limit",
  "법정 공휴일": "Statutory Holidays",
  "법인 커스텀 설정": "Entity Custom Settings",
  "글로벌 기본값": "Global Default",
  "초과근무, 52h 위반, 근태 패턴을 분석합니다.": "Analyzes overtime, 52h violations, and attendance patterns.",
  "단위: 시간/주": "Unit: Hours/Week",
};

// Build path → translation from ko text
const pathMap = {};
for (const m of missing) {
  pathMap[m.path] = translations[m.ko] || '';
}

// Read all _done files and update missing entries
const chunkFiles = fs.readdirSync(CHUNKS_DIR)
  .filter(f => f.startsWith('en_chunk_') && f.includes('_done') && f.endsWith('.json'))
  .sort();

let filled = 0;
let stillMissing = 0;

for (const file of chunkFiles) {
  const filePath = path.join(CHUNKS_DIR, file);
  const items = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let changed = false;
  
  for (const item of items) {
    if (!item.translated && pathMap[item.path]) {
      item.translated = pathMap[item.path];
      filled++;
      changed = true;
    }
    if (!item.translated) stillMissing++;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2) + '\n');
  }
  
  const done = items.filter(i => i.translated).length;
  console.log(`${file}: ${done}/${items.length}`);
}

console.log(`\nFilled: ${filled} additional translations`);
console.log(`Still missing: ${stillMissing}`);
