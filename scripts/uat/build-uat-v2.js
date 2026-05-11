// CTR HR Hub UAT Guide v2.0 generator
//
// Run: cd scripts/uat && npm install && node build-uat-v2.js
// Output: docs/uat/UAT_가이드_v2.docx
//
// Source of truth for the UAT guide v2. Modify text/structure here and regenerate.

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, LevelFormat,
  TabStopType, TabStopPosition,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak,
} = require('docx');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(REPO_ROOT, 'docs/uat/screenshots-v2');
const OUT = path.join(REPO_ROOT, 'docs/uat/UAT_가이드_v2.docx');

// ---------- Configurable constants ----------
const STAGING_URL = 'https://ctr-hr-hub-git-staging-sangwoos-projects-b01c065c.vercel.app';
const CAPTURE_COMMIT = 'a5b0dade';
const CAPTURE_DATE = '2026-05-10';

// ---------- Style helpers ----------
const FONT = 'Malgun Gothic';
const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const cellBorders = { top: border, bottom: border, left: border, right: border };

const BLACK_RUN = { font: FONT, size: 22 }; // 11pt

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    ...opts,
    children: [new TextRun({ text, ...BLACK_RUN, ...(opts.run || {}) })],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    children: [new TextRun({ text, font: FONT, bold: true, size: 32 })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, font: FONT, bold: true, size: 26 })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 100 },
    children: [new TextRun({ text, font: FONT, bold: true, size: 22 })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    children: [new TextRun({ text, ...BLACK_RUN })],
  });
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    children: [new TextRun({ text, ...BLACK_RUN })],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ---------- Table builder ----------
function cell(text, opts = {}) {
  const isHeader = !!opts.header;
  return new TableCell({
    borders: cellBorders,
    width: { size: opts.width, type: WidthType.DXA },
    shading: isHeader
      ? { fill: 'F2F2F2', type: ShadingType.CLEAR, color: 'auto' }
      : undefined,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        children: [
          new TextRun({
            text: String(text),
            font: FONT,
            size: 22,
            bold: isHeader || opts.bold,
          }),
        ],
      }),
    ],
  });
}

function buildTable(headers, rows, columnWidths) {
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) =>
          cell(h, { header: true, width: columnWidths[i], align: AlignmentType.CENTER }),
        ),
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((c, i) => cell(c, { width: columnWidths[i] })),
          }),
      ),
    ],
  });
}

// ---------- Image helper ----------
// Source 1440x900. Fit within 6.5" content width (US Letter, 1" margins).
// 6.5" * 96 DPI = 624px. Height = 624 / 1.6 = 390px.
function image(filename, captionText) {
  const filePath = path.join(SHOTS, filename);
  const data = fs.readFileSync(filePath);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [
        new ImageRun({
          type: 'png',
          data,
          transformation: { width: 624, height: 390 },
          altText: {
            title: captionText,
            description: captionText,
            name: filename,
          },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: captionText,
          font: FONT,
          size: 20,
          italics: true,
          color: '595959',
        }),
      ],
    }),
  ];
}

// ---------- Sections ----------

function coverPage() {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 240 },
      children: [
        new TextRun({ text: 'CTR 통합 인사관리 시스템', font: FONT, size: 40, bold: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({ text: 'UAT (사용자 수용 테스트) 가이드', font: FONT, size: 36, bold: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 1200 },
      children: [
        new TextRun({ text: 'Version 2.0', font: FONT, size: 28, color: '595959' }),
      ],
    }),
    buildTable(
      ['항목', '내용'],
      [
        ['문서 버전', 'v2.0'],
        ['작성일', '2026년 5월 10일'],
        ['이전 버전', 'v1.0 (2026-04-17)'],
        ['작성자', 'CTR 개발팀'],
        ['대상', 'UAT 테스터 (HR 담당자)'],
        ['분류', '내부 문서 — 대외비'],
      ],
      [3000, 6360],
    ),
    new Paragraph({
      spacing: { before: 360, after: 120 },
      children: [
        new TextRun({ text: 'v1.0 → v2.0 변경 요약', font: FONT, size: 24, bold: true }),
      ],
    }),
    bullet('홈 대시보드 V2 정식 승격 (R4 promote 완료) — 4개 역할별 신규 화면 캡처 추가'),
    bullet('테스트 환경: Staging (Vercel Preview) — dev login 카드로 9개 역할 전환 가능 (Production은 SSO-only로 분리)'),
    bullet('알려진 이슈 8개 → 5개로 감소 (Phase 9 회귀 안전망 batch 1-17 반영)'),
    pageBreak(),
  ];
}

function section1() {
  return [
    h1('1. UAT 개요'),
    h2('1.1 목적'),
    p('CTR 통합 인사관리 시스템(CTR HR Hub)의 사용자 수용 테스트(UAT)를 통해 실제 업무 환경에서 시스템이 요구사항을 충족하는지 검증합니다. 본 테스트는 HR 담당자가 직접 참여하여 실제 업무 시나리오를 기반으로 시스템의 정확성, 사용성, 안정성을 확인하는 것을 목표로 합니다.'),
    h2('1.2 범위'),
    p('Round 1 — 핵심 업무 모듈(인사관리, 출퇴근, 휴가, 급여, 결재/승인, 설정)에 대한 심층 검증을 수행하고, 나머지 모듈(채용, 성과/보상, 인사이트 등)에 대해서는 스모크 테스트로 기본 동작을 확인합니다.'),
    h2('1.3 기간'),
    p('2주 (10 영업일)'),
    h2('1.4 역할'),
    buildTable(
      ['역할', '담당자', '책임'],
      [
        ['UAT 관리자', '상우님', '전체 조율, 이슈 트리아지, 최종 판정'],
        ['UAT 테스터', 'HR 담당자', '시나리오 실행, 피드백 작성'],
      ],
      [2400, 2400, 4560],
    ),
  ];
}

function section2() {
  return [
    h1('2. 일정표'),
    p('아래는 10 영업일 기준 UAT 일정입니다. 상황에 따라 조정될 수 있습니다.'),
    buildTable(
      ['일차', '내용'],
      [
        ['Day 1', '킥오프, 계정 확인, 가이드 워크스루, 스모크 테스트'],
        ['Day 2-4', '인사관리 + 조직/마스터데이터 설정 시나리오'],
        ['Day 5-6', '출퇴근 + 휴가 + 결재/승인 시나리오'],
        ['Day 7-8', '급여 시나리오'],
        ['Day 9', '체크리스트 모듈 + 엣지케이스 + 수정건 재테스트'],
        ['Day 10', '최종 재테스트 + 알려진 이슈 정리 + 사인오프 결정'],
      ],
      [1800, 7560],
    ),
  ];
}

function section3() {
  return [
    h1('3. 테스트 환경'),
    h2('3.1 접속 정보'),
    buildTable(
      ['항목', '내용'],
      [
        ['Staging URL', STAGING_URL],
        ['로그인 방식', '테스트 계정 카드 (이메일만으로 로그인) — SSO 인증 불필요'],
        ['권장 브라우저', 'Chrome (최신 버전)'],
        ['화면 해상도', '1280 × 800 이상 권장 (1440 × 900 최적)'],
      ],
      [3000, 6360],
    ),
    new Paragraph({
      spacing: { before: 120, after: 120 },
      indent: { left: 240, right: 240 },
      shading: { fill: 'E8F4F8', type: ShadingType.CLEAR, color: 'auto' },
      children: [
        new TextRun({ text: '왜 Staging인가? ', font: FONT, size: 22, bold: true, color: '1B7BA8' }),
        new TextRun({
          text: 'UAT는 5개 역할(EMPLOYEE/MANAGER/EXECUTIVE/HR_ADMIN/SUPER_ADMIN)을 모두 검증해야 합니다. Production은 회사 SSO 1:1 매핑이라 한 사람당 한 역할만 보이므로 multi-role 테스트가 불가능합니다. Staging은 dev login 카드로 9개 테스트 계정을 자유롭게 전환할 수 있어 UAT에 적합합니다.',
          font: FONT,
          size: 22,
        }),
      ],
    }),
    h2('3.2 데이터 정책'),
    bullet('Staging 환경은 UAT 전용 시드 데이터로 구성됩니다 (엣지케이스 30명, 이력 3년치 사전 적재).'),
    bullet('테스트 시작 전 seed 데이터로 초기화됩니다.'),
    bullet('테스트 기간 중 데이터 리셋이 필요한 경우 UAT 관리자에게 요청해 주세요.'),
    bullet('리셋 시 모든 테스트 데이터가 초기 상태로 돌아갑니다.'),
    h2('3.3 접속 방법'),
    numbered('Staging URL에 Chrome 브라우저로 접속합니다.'),
    numbered('로그인 화면에서 테스트 계정 카드 목록을 확인합니다 (9개 역할).'),
    numbered('테스트할 역할에 맞는 카드를 클릭하면 자동 로그인됩니다.'),
    numbered('로그인 후 좌측 사이드바에서 각 메뉴로 이동하여 테스트를 진행합니다.'),
    numbered('다른 역할로 전환하려면 우측 상단 프로필 → 로그아웃 후 다른 카드를 선택합니다.'),
    new Paragraph({
      spacing: { before: 120, after: 120 },
      indent: { left: 240, right: 240 },
      shading: { fill: 'FFF4E5', type: ShadingType.CLEAR, color: 'auto' },
      children: [
        new TextRun({ text: '⚠ Production과의 차이: ', font: FONT, size: 22, bold: true, color: 'B85C00' }),
        new TextRun({
          text: 'Production(hr.ctr.co.kr)은 Microsoft 365 SSO 전용으로 운영되며, dev login 카드가 표시되지 않습니다. UAT는 Staging URL로 진행해야 9개 테스트 계정 사용이 가능합니다.',
          font: FONT,
          size: 22,
        }),
      ],
    }),
  ];
}

function section4() {
  return [
    h1('4. 역할/계정 매트릭스'),
    h2('4.1 테스트 계정 (9개)'),
    p('Staging 환경에서 dev login 카드로 즉시 전환 가능한 시드 계정입니다. 이메일만 입력하면 로그인되며, 비밀번호나 SSO 인증은 불필요합니다.'),
    buildTable(
      ['#', '이메일', '이름', '역할', '회사', '부서', '보고 라인'],
      [
        ['1', 'super@ctr.co.kr', '최상우', 'SUPER_ADMIN', 'CTR-HOLD', '—', '—'],
        ['2', 'hr@ctr.co.kr', '한지영', 'HR_ADMIN', 'CTR', '—', '—'],
        ['3', 'hr@ctr-cn.com', '陈美玲', 'HR_ADMIN', 'CTR-CN', 'ADMIN', '—'],
        ['4', 'manager@ctr.co.kr', '박준혁', 'MANAGER', 'CTR', '생산기술팀', '—'],
        ['5', 'manager2@ctr.co.kr', '김서연', 'MANAGER', 'CTR', '품질관리팀', '—'],
        ['6', 'employee-a@ctr.co.kr', '이민준', 'EMPLOYEE', 'CTR', '생산기술팀', '박준혁'],
        ['7', 'employee-b@ctr.co.kr', '정다은', 'EMPLOYEE', 'CTR', '생산기술팀', '박준혁'],
        ['8', 'employee-c@ctr.co.kr', '송현우', 'EMPLOYEE', 'CTR', '품질관리팀', '김서연'],
        ['9', 'executive@ctr.co.kr', '강대표', 'EXECUTIVE', 'CTR', '—', '—'],
      ],
      [600, 1700, 900, 1500, 1100, 1660, 1900],
    ),
    h2('4.2 역할별 접근 가능 메뉴'),
    buildTable(
      ['메뉴', 'EMPLOYEE', 'MANAGER', 'EXECUTIVE', 'HR_ADMIN', 'SUPER_ADMIN'],
      [
        ['홈/알림', 'O', 'O', 'O', 'O', 'O'],
        ['나의 공간 (전체)', 'O', 'O', 'O', 'O', 'O'],
        ['팀 관리', '—', 'O', '—', 'O', 'O'],
        ['인사 관리', '—', '—', '—', 'O', 'O'],
        ['채용', '—', '—', '—', 'O', 'O'],
        ['성과/보상', '—', '—', '—', 'O', 'O'],
        ['급여', '—', '—', '—', 'O', 'O'],
        ['인사이트', '—', 'O', 'O', 'O', 'O'],
        ['설정', '—', '—', '—', 'O', 'O'],
      ],
      [2160, 1440, 1440, 1440, 1440, 1440],
    ),
    h2('4.3 추천 테스트 시나리오별 계정'),
    buildTable(
      ['시나리오', '추천 계정'],
      [
        ['직원 셀프서비스', 'employee-a@ctr.co.kr'],
        ['매니저 기능', 'manager@ctr.co.kr'],
        ['HR 관리 전체', 'hr@ctr.co.kr'],
        ['다국적 테스트', 'hr@ctr-cn.com'],
        ['임원 분석', 'executive@ctr.co.kr'],
        ['최고 관리자', 'super@ctr.co.kr'],
      ],
      [3600, 5760],
    ),
  ];
}

function section5() {
  return [
    pageBreak(),
    h1('5. V2 대시보드 화면 안내 (NEW)'),
    p('v1.0 → v2.0의 핵심 변경사항입니다. 홈 대시보드가 V2로 정식 승격(R4 promote 완료)되어 4개 역할별로 별도 레이아웃이 제공됩니다. 아래는 각 역할이 로그인 직후 보게 될 메인 화면입니다.'),
    new Paragraph({
      spacing: { before: 60, after: 120 },
      indent: { left: 240, right: 240 },
      shading: { fill: 'E8F4F8', type: ShadingType.CLEAR, color: 'auto' },
      children: [
        new TextRun({ text: '캡처 기준: ', font: FONT, size: 22, bold: true, color: '1B7BA8' }),
        new TextRun({
          text: `commit ${CAPTURE_COMMIT}(${CAPTURE_DATE}) 시점, 1440×900 viewport, ko-KR locale, Light mode. Staging과 Production은 동일 코드 베이스이므로 화면 레이아웃은 일치합니다.`,
          font: FONT,
          size: 22,
        }),
      ],
    }),

    h2('5.1 홈 대시보드 (4개 역할)'),
    p('로그인 직후 사용자가 가장 먼저 보는 화면입니다. 역할에 따라 노출되는 카드와 KPI가 달라집니다.'),

    h3('5.1.1 EMPLOYEE — 이민준 (employee-a@ctr.co.kr)'),
    p('직원이 보는 홈입니다. 본인 출근 상태, 휴가 잔액, 본인 작업(My Tasks), 알림이 핵심 카드로 노출됩니다.'),
    ...image('home-employee.png', '그림 5-1. EMPLOYEE 역할 홈 대시보드'),

    h3('5.1.2 MANAGER — 박준혁 (manager@ctr.co.kr)'),
    p('팀장이 보는 홈입니다. 팀 출근 현황, 결재 대기, 1:1 미팅 일정, 분기 평가 진행률이 카드로 표시됩니다.'),
    ...image('home-manager.png', '그림 5-2. MANAGER 역할 홈 대시보드'),

    h3('5.1.3 HR_ADMIN — 한지영 (hr@ctr.co.kr)'),
    p('HR 담당자가 보는 홈입니다. 전사 출근 현황, 결재 대기, 온보딩/오프보딩 트래커, 휴가 통계가 노출됩니다.'),
    ...image('home-hr-admin.png', '그림 5-3. HR_ADMIN 역할 홈 대시보드'),

    h3('5.1.4 SUPER_ADMIN — 최상우 (super@ctr.co.kr)'),
    p('지주사 최고 관리자가 보는 홈입니다. 전 법인 통합 KPI, 회사 스위처(cross-company), 시스템 알림이 표시됩니다.'),
    ...image('home-super-admin.png', '그림 5-4. SUPER_ADMIN 역할 홈 대시보드'),

    pageBreak(),
    h2('5.2 결재함 (Approvals Inbox)'),
    p('역할별 결재 대기 목록입니다. EMPLOYEE는 본인 신청 건만 보이고, MANAGER/HR_ADMIN은 결재 대기 + 본인 신청 둘 다 보입니다.'),

    h3('5.2.1 EMPLOYEE 결재함'),
    ...image('approvals-inbox-employee.png', '그림 5-5. EMPLOYEE 역할 결재함'),

    h3('5.2.2 MANAGER 결재함'),
    ...image('approvals-inbox-manager.png', '그림 5-6. MANAGER 역할 결재함'),

    h3('5.2.3 HR_ADMIN 결재함'),
    ...image('approvals-inbox-hr-admin.png', '그림 5-7. HR_ADMIN 역할 결재함'),

    h3('5.2.4 SUPER_ADMIN 결재함'),
    ...image('approvals-inbox-super-admin.png', '그림 5-8. SUPER_ADMIN 역할 결재함'),

    pageBreak(),
    h2('5.3 알림 센터'),
    p('역할별 시스템 알림 목록입니다. 결재 알림, 일정 알림, 시스템 공지가 통합되어 표시됩니다.'),

    h3('5.3.1 EMPLOYEE 알림'),
    ...image('notifications-employee.png', '그림 5-9. EMPLOYEE 역할 알림'),

    h3('5.3.2 MANAGER 알림'),
    ...image('notifications-manager.png', '그림 5-10. MANAGER 역할 알림'),

    h3('5.3.3 HR_ADMIN 알림'),
    ...image('notifications-hr-admin.png', '그림 5-11. HR_ADMIN 역할 알림'),

    h3('5.3.4 SUPER_ADMIN 알림'),
    ...image('notifications-super-admin.png', '그림 5-12. SUPER_ADMIN 역할 알림'),
  ];
}

function section6() {
  return [
    h1('6. 테스트 데이터 카탈로그'),
    h2('6.1 엣지케이스 페르소나 (30명)'),
    p('시스템에는 비정상 상황을 시뮬레이션하기 위한 30명의 특수 직원이 등록되어 있습니다. 아래는 주요 엣지케이스 페르소나입니다.'),
    h3('고용 상태 엣지케이스 (8명)'),
    buildTable(
      ['#', '코드', '이름', '상태 설명'],
      [
        ['1', 'EDGE-001', '김수습', '수습 진행 중 (2026-06-01까지)'],
        ['2', 'EDGE-002', '박만료', '수습 기간 초과 (이미 만료됨)'],
        ['3', 'EDGE-003', '이계약', '계약 만료 D-30'],
        ['4', 'EDGE-004', '최만기', '계약 이미 만료'],
        ['5', 'EDGE-005', '정육아', '육아휴직 중'],
        ['6', 'EDGE-006', '한복귀', '휴직 복귀 예정'],
        ['7', 'EDGE-007', '오퇴사', '퇴사 예정 D-30'],
        ['8', 'EDGE-008', '유퇴직', '퇴직 처리 완료'],
      ],
      [600, 1500, 1500, 5760],
    ),
    h3('조직 엣지케이스 (일부)'),
    buildTable(
      ['#', '코드', '이름', '상태 설명'],
      [
        ['9', 'EDGE-009', '강겸직', '2개 법인 겸직'],
        ['10', 'EDGE-010', '임다직', '3개 직위 동시 보유'],
      ],
      [600, 1500, 1500, 5760],
    ),
    p('※ 나머지 엣지케이스는 테스트북 엣지케이스 시트를 참고해 주세요.'),
    h2('6.2 주요 테스트 데이터'),
    buildTable(
      ['항목', '내용'],
      [
        ['부서', '생산기술팀, 품질관리팀 등'],
        ['법인', 'CTR-HOLD (지주사), CTR (한국), CTR-CN (중국) 등 13개'],
        ['연차 잔액', '이민준, 정다은 — 각 15일 (2026년)'],
      ],
      [3000, 6360],
    ),
  ];
}

function section7() {
  return [
    h1('7. 심각도 정의'),
    p('이슈 발견 시 아래 기준에 따라 심각도를 분류합니다.'),
    buildTable(
      ['심각도', '정의', '예시'],
      [
        ['Critical', '시스템 사용 불가, 데이터 손실/유출 위험', '로그인 불가, 급여 계산 오류, 타 법인 데이터 노출'],
        ['Major', '핵심 업무 수행 방해, 우회 방법 없음', '휴가 신청 실패, 결재 승인 안됨, 직원 등록 오류'],
        ['Minor', '불편하지만 우회 가능', 'UI 정렬 깨짐, 번역 누락, 느린 로딩'],
        ['개선', '기능 개선 제안', 'UX 개선, 추가 필터 요청, 라벨 변경'],
      ],
      [1500, 3500, 4360],
    ),
  ];
}

function section8() {
  return [
    h1('8. 이슈 리포트 규칙'),
    p('이슈 발견 시 피드백 Excel 파일에 아래 정보를 기입합니다. 정확한 재현 정보가 빠른 수정의 핵심입니다.'),
    buildTable(
      ['#', '항목', '작성 방법', '예시'],
      [
        ['1', '모듈명', '테스트 중인 기능 영역', '휴가관리'],
        ['2', '시나리오 번호', '시나리오/체크리스트 항목 번호', 'TC-LEAVE-003'],
        ['3', '사용한 계정', '로그인한 테스트 계정 이메일', 'hr@ctr.co.kr'],
        ['4', '현재 페이지 URL', '브라우저 주소창에서 복사', '/hr/leave/requests'],
        ['5', '재현 스텝', '단계별 조작 과정', '1. 휴가 신청 클릭 → 2. 날짜 선택 → 3. 제출'],
        ['6', '기대 결과', '무엇이 되어야 하는지', '휴가 신청 완료 메시지 표시'],
        ['7', '실제 결과', '실제로 무엇이 일어났는지', '에러 메시지: "서버 오류"'],
        ['8', '심각도', '위 기준 참고', 'Major'],
        ['9', '스크린샷', '가능하면 첨부 (Print Screen → Excel 붙여넣기)', '(이미지 첨부)'],
      ],
      [500, 1900, 3060, 3900],
    ),
  ];
}

function section9() {
  return [
    h1('9. 알려진 이슈'),
    p('아래 항목들은 현재 개발 중이거나 의도된 동작입니다. 버그가 아니니 참고만 해주세요.'),
    p('v1.0 → v2.0: 8건 → 5건으로 감소했습니다 (Phase 9 회귀 안전망 batch 1-17 반영, E2E 137 → 14 fail).', { run: { italics: true, color: '595959' } }),
    buildTable(
      ['#', '내용', '상세 설명'],
      [
        ['1', '비정기 보상 이벤트 알림 미발송', '이벤트 버스 미구현. Off-cycle compensation의 submit/approve/reject 시 알림이 자동 발송되지 않음. (Session 207에서 trailing self-skip 회귀는 fix됨)'],
        ['2', '출퇴근 관리 에러 토스트 미표시', '일부 오류 상황에서 사용자 알림이 뜨지 않음 (콘솔에만 기록)'],
        ['3', '발령일 타임존 비교 이슈', 'UTC vs 로컬 타임존 비교에서 경계값 차이 발생 가능 (1일 오차)'],
        ['4', 'Redis 캐시 키 불일치', '법인 코드 변경 시 수동 캐시 초기화 필요 (운영 배포 시 조치 예정)'],
        ['5', 'E2E API 12건 잔여 fail', 'Phase 9 Cluster D — heterogeneous (503 rate limit / boolean assertion drift / 409 sequence / 500). 별도 batch에서 정리 중. UAT 시나리오에는 영향 없음.'],
      ],
      [500, 2860, 6000],
    ),
  ];
}

function section10() {
  return [
    h1('10. 통과 기준 & 사인오프'),
    h2('10.1 통과 기준 (모두 충족 시 GO)'),
    buildTable(
      ['기준', '조건'],
      [
        ['Critical 이슈', '0건'],
        ['Major (핵심 모듈)', '미해결 0건 — 인사/출퇴근/휴가/급여/결재/설정'],
        ['Major (전체)', '해결률 80% 이상 (미해결 건은 담당자/기한/우회방안 명시)'],
        ['핵심 시나리오 통과율', '95% 이상'],
        ['체크리스트 스모크 통과율', '90% 이상'],
        ['보안/데이터 이슈', '0건 — 법인 격리, 급여 유출, 권한 누수'],
      ],
      [3000, 6360],
    ),
    p('※ "해결됨" 정의: 수정 완료 → staging 배포 → 보고자 재테스트 → 종료'),
    h2('10.2 사인오프 양식'),
    buildTable(
      ['모듈', '담당자', '날짜', '판정', '수용한 미해결 건', '서명'],
      [
        ['인사관리', '', '', 'GO / NO-GO', '', ''],
        ['출퇴근', '', '', 'GO / NO-GO', '', ''],
        ['휴가관리', '', '', 'GO / NO-GO', '', ''],
        ['급여', '', '', 'GO / NO-GO', '', ''],
        ['결재/승인', '', '', 'GO / NO-GO', '', ''],
        ['마스터데이터 설정', '', '', 'GO / NO-GO', '', ''],
        ['기타 (체크리스트)', '', '', 'GO / NO-GO', '', ''],
      ],
      [2000, 1300, 1300, 1660, 1900, 1200],
    ),
    h2('10.3 최종 판정'),
    p('☐  전체 GO — 운영 배포 진행'),
    p('☐  조건부 GO — 명시된 조건 해결 후 배포'),
    p('☐  NO-GO — 재테스트 필요'),
    new Paragraph({
      spacing: { before: 360, after: 120 },
      children: [new TextRun({ text: '판정자: _________________________________', ...BLACK_RUN })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: '날  짜: _________________________________', ...BLACK_RUN })],
    }),
  ];
}

// ---------- Document assembly ----------
const doc = new Document({
  creator: 'CTR HR Hub Dev Team',
  title: 'CTR HR Hub UAT 가이드 v2.0',
  description: 'CTR 통합 인사관리 시스템 UAT 가이드 v2.0 (V2 대시보드 + Staging 환경)',
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: FONT },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: FONT },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: FONT },
        paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: 'numbers',
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'CTR HR Hub UAT 가이드 v2.0', font: FONT, size: 18, color: '595959' })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: '내부 문서 — 대외비', font: FONT, size: 18, color: '595959' }),
            new TextRun({ text: '\t', font: FONT, size: 18 }),
            new TextRun({ text: 'Page ', font: FONT, size: 18, color: '595959' }),
            new TextRun({ font: FONT, size: 18, color: '595959', children: [PageNumber.CURRENT] }),
            new TextRun({ text: ' / ', font: FONT, size: 18, color: '595959' }),
            new TextRun({ font: FONT, size: 18, color: '595959', children: [PageNumber.TOTAL_PAGES] }),
          ],
        })],
      }),
    },
    children: [
      ...coverPage(),
      ...section1(),
      ...section2(),
      ...section3(),
      ...section4(),
      ...section5(),
      ...section6(),
      ...section7(),
      ...section8(),
      ...section9(),
      ...section10(),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  const stat = fs.statSync(OUT);
  console.log(`Wrote ${OUT} (${(stat.size / 1024).toFixed(1)} KB)`);
});
