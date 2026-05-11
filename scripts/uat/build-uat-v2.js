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
        new TextRun({ text: '핵심 업무 모듈 검증 가이드', font: FONT, size: 28, color: '595959' }),
      ],
    }),
    buildTable(
      ['항목', '내용'],
      [
        ['작성일', '2026년 5월 11일'],
        ['작성자', 'CTR 개발팀'],
        ['대상', '인사 담당자 (UAT 테스터)'],
        ['분류', '내부 문서 — 대외비'],
      ],
      [3000, 6360],
    ),
    pageBreak(),
  ];
}

function section1() {
  return [
    h1('1. UAT 개요'),
    h2('1.1 목적'),
    p('CTR 통합 인사관리 시스템(CTR HR Hub)의 사용자 수용 테스트(UAT)를 통해 실제 업무 환경에서 시스템이 요구사항을 충족하는지 검증합니다. 본 테스트는 HR 담당자가 직접 참여하여 실제 업무 시나리오를 기반으로 시스템의 정확성, 사용성, 안정성을 확인하는 것을 목표로 합니다.'),
    h2('1.2 범위'),
    p('1차 테스트 — 핵심 업무 모듈(인사관리, 출퇴근, 휴가, 급여, 결재/승인, 설정)을 자세히 검증하고, 나머지 모듈(채용, 성과/보상, 인사이트 등)은 기본 동작만 간단히 점검합니다.'),
    h2('1.3 기간'),
    p('2주 (10 영업일)'),
    h2('1.4 역할'),
    buildTable(
      ['역할', '담당자', '책임'],
      [
        ['UAT 관리자', '강상우', '전체 조율, 이슈 분류, 최종 판정'],
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
        ['1일차', '시작 미팅, 계정 확인, 가이드 안내, 전체 기본 동작 점검'],
        ['2-4일차', '인사관리 + 조직/마스터데이터 설정 시나리오'],
        ['5-6일차', '출퇴근 + 휴가 + 결재/승인 시나리오'],
        ['7-8일차', '급여 시나리오'],
        ['9일차', '체크리스트 모듈 + 특수 상황 사례 + 수정 사항 재테스트'],
        ['10일차', '최종 재테스트 + 알려진 이슈 정리 + 최종 승인 결정'],
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
        ['테스트 사이트 주소', STAGING_URL],
        ['로그인 방법', '테스트 계정 카드 클릭 — 비밀번호 불필요'],
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
        new TextRun({ text: '왜 별도 테스트 사이트인가요? ', font: FONT, size: 22, bold: true, color: '1B7BA8' }),
        new TextRun({
          text: 'UAT는 5개 역할(직원/팀장/임원/인사담당자/전사관리자)을 모두 점검해야 합니다. 실제 운영 사이트는 본인 계정으로만 로그인할 수 있어 한 사람당 한 역할만 보이지만, 테스트 사이트에서는 9개 테스트 계정 카드를 클릭만 하면 즉시 역할을 전환할 수 있어 UAT에 적합합니다.',
          font: FONT,
          size: 22,
        }),
      ],
    }),
    h2('3.2 데이터 정책'),
    bullet('테스트 사이트는 UAT 전용 가상 데이터로 구성됩니다 (특수 상황 직원 30명, 3년치 이력 사전 입력).'),
    bullet('테스트 시작 전 가상 데이터로 초기화됩니다.'),
    bullet('테스트 기간 중 데이터 초기화가 필요하면 UAT 관리자에게 요청해 주세요.'),
    bullet('초기화 시 모든 테스트 데이터가 시작 상태로 돌아갑니다.'),
    h2('3.3 접속 방법'),
    numbered('테스트 사이트 주소에 Chrome 브라우저로 접속합니다.'),
    numbered('로그인 화면에서 테스트 계정 카드 목록을 확인합니다 (총 9개).'),
    numbered('테스트할 역할에 맞는 카드를 클릭하면 자동으로 로그인됩니다.'),
    numbered('로그인 후 왼쪽 메뉴에서 각 항목으로 이동하여 테스트를 진행합니다.'),
    numbered('다른 역할로 바꾸려면 오른쪽 위 프로필 → 로그아웃 후 다른 카드를 클릭합니다.'),
    new Paragraph({
      spacing: { before: 120, after: 120 },
      indent: { left: 240, right: 240 },
      shading: { fill: 'FFF4E5', type: ShadingType.CLEAR, color: 'auto' },
      children: [
        new TextRun({ text: '⚠ 실제 운영 사이트와의 차이: ', font: FONT, size: 22, bold: true, color: 'B85C00' }),
        new TextRun({
          text: '실제 운영 사이트(hr.ctr.co.kr)에서는 Microsoft 365 회사 계정으로만 로그인할 수 있고, 테스트 카드가 표시되지 않습니다. UAT 기간 동안은 반드시 이 가이드의 테스트 사이트 주소로 접속해 주세요.',
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
    p('테스트 사이트의 로그인 화면에서 아래 카드를 클릭하면 즉시 해당 역할로 로그인됩니다. 비밀번호나 회사 계정 인증은 필요하지 않습니다.'),
    buildTable(
      ['#', '이메일', '이름', '역할', '회사', '부서', '보고 라인'],
      [
        ['1', 'super@ctr.co.kr', '대조영', '전사관리자', 'CTR-HOLD', '—', '—'],
        ['2', 'hr@ctr.co.kr', '한지영', '인사담당자', 'CTR', '—', '—'],
        ['3', 'hr@ctr-cn.com', '陈美玲', '인사담당자', 'CTR-CN', 'ADMIN', '—'],
        ['4', 'manager@ctr.co.kr', '박준혁', '팀장', 'CTR', '생산기술팀', '—'],
        ['5', 'manager2@ctr.co.kr', '김서연', '팀장', 'CTR', '품질관리팀', '—'],
        ['6', 'employee-a@ctr.co.kr', '이민준', '직원', 'CTR', '생산기술팀', '박준혁'],
        ['7', 'employee-b@ctr.co.kr', '정다은', '직원', 'CTR', '생산기술팀', '박준혁'],
        ['8', 'employee-c@ctr.co.kr', '송현우', '직원', 'CTR', '품질관리팀', '김서연'],
        ['9', 'executive@ctr.co.kr', '강대표', '임원', 'CTR', '—', '—'],
      ],
      [600, 1700, 900, 1500, 1100, 1660, 1900],
    ),
    h2('4.2 역할별 접근 가능 메뉴'),
    buildTable(
      ['메뉴', '직원', '팀장', '임원', '인사담당자', '전사관리자'],
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
        ['직원 셀프서비스 (휴가/근태/내 정보)', 'employee-a@ctr.co.kr'],
        ['팀장 기능 (팀 관리/결재)', 'manager@ctr.co.kr'],
        ['인사 관리 전체', 'hr@ctr.co.kr'],
        ['해외 법인 테스트 (중국)', 'hr@ctr-cn.com'],
        ['임원 분석 대시보드', 'executive@ctr.co.kr'],
        ['전사 관리 (전 법인 권한)', 'super@ctr.co.kr'],
      ],
      [3600, 5760],
    ),
  ];
}

function section5() {
  return [
    pageBreak(),
    h1('5. 주요 화면 안내'),
    p('아래는 각 역할로 로그인했을 때 가장 먼저 보게 될 주요 화면입니다. 화면 구성을 미리 익혀두시면 테스트가 수월합니다.'),
    new Paragraph({
      spacing: { before: 60, after: 120 },
      indent: { left: 240, right: 240 },
      shading: { fill: 'E8F4F8', type: ShadingType.CLEAR, color: 'auto' },
      children: [
        new TextRun({ text: '캡처 기준: ', font: FONT, size: 22, bold: true, color: '1B7BA8' }),
        new TextRun({
          text: `${CAPTURE_DATE} 기준, 한국어 화면, 일반 데스크톱 해상도. 화면 구성은 실제 운영 사이트와 동일합니다.`,
          font: FONT,
          size: 22,
        }),
      ],
    }),

    h2('5.1 홈 대시보드 (4개 역할)'),
    p('로그인 직후 가장 먼저 보이는 화면입니다. 역할에 따라 노출되는 카드와 지표가 달라집니다.'),

    h3('5.1.1 직원 — 이민준 (employee-a@ctr.co.kr)'),
    p('일반 직원이 보는 홈 화면입니다. 본인 출근 상태, 휴가 잔여 일수, 본인 할 일, 알림이 주요 카드로 표시됩니다.'),
    ...image('home-employee.png', '그림 5-1. 직원 역할 홈 화면'),

    h3('5.1.2 팀장 — 박준혁 (manager@ctr.co.kr)'),
    p('팀장이 보는 홈 화면입니다. 팀 출근 현황, 결재 대기, 1:1 미팅 일정, 분기 평가 진행률이 표시됩니다.'),
    ...image('home-manager.png', '그림 5-2. 팀장 역할 홈 화면'),

    h3('5.1.3 인사담당자 — 한지영 (hr@ctr.co.kr)'),
    p('인사 담당자가 보는 홈 화면입니다. 전사 출근 현황, 결재 대기, 입사/퇴사 진행 현황, 휴가 통계가 표시됩니다.'),
    ...image('home-hr-admin.png', '그림 5-3. 인사담당자 역할 홈 화면'),

    h3('5.1.4 전사관리자 — 대조영 (super@ctr.co.kr)'),
    p('지주사 차원의 최고 관리자가 보는 홈 화면입니다. 전 법인 통합 지표, 회사 전환 메뉴, 시스템 공지가 표시됩니다.'),
    ...image('home-super-admin.png', '그림 5-4. 전사관리자 역할 홈 화면'),

    pageBreak(),
    h2('5.2 결재함'),
    p('역할별 결재 대기 목록입니다. 직원은 본인이 올린 신청 건만 보이고, 팀장/인사담당자는 결재 대기 건과 본인이 올린 건이 함께 보입니다.'),

    h3('5.2.1 직원 결재함'),
    ...image('approvals-inbox-employee.png', '그림 5-5. 직원 역할 결재함'),

    h3('5.2.2 팀장 결재함'),
    ...image('approvals-inbox-manager.png', '그림 5-6. 팀장 역할 결재함'),

    h3('5.2.3 인사담당자 결재함'),
    ...image('approvals-inbox-hr-admin.png', '그림 5-7. 인사담당자 역할 결재함'),

    h3('5.2.4 전사관리자 결재함'),
    ...image('approvals-inbox-super-admin.png', '그림 5-8. 전사관리자 역할 결재함'),

    pageBreak(),
    h2('5.3 알림 센터'),
    p('역할별 알림 목록입니다. 결재 알림, 일정 알림, 시스템 공지가 한 곳에서 통합 표시됩니다.'),

    h3('5.3.1 직원 알림'),
    ...image('notifications-employee.png', '그림 5-9. 직원 역할 알림'),

    h3('5.3.2 팀장 알림'),
    ...image('notifications-manager.png', '그림 5-10. 팀장 역할 알림'),

    h3('5.3.3 인사담당자 알림'),
    ...image('notifications-hr-admin.png', '그림 5-11. 인사담당자 역할 알림'),

    h3('5.3.4 전사관리자 알림'),
    ...image('notifications-super-admin.png', '그림 5-12. 전사관리자 역할 알림'),
  ];
}

function section6() {
  return [
    h1('6. 테스트 데이터 안내'),
    h2('6.1 특수 상황 테스트 직원 (30명)'),
    p('실제 인사 업무에서 자주 발생하는 까다로운 상황을 점검할 수 있도록 30명의 특수 상황 가상 직원이 미리 등록되어 있습니다. 아래는 대표 사례입니다.'),
    h3('고용 상태 관련 (8명)'),
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
    h3('조직 구성 관련 (일부)'),
    buildTable(
      ['#', '코드', '이름', '상태 설명'],
      [
        ['9', 'EDGE-009', '강겸직', '2개 법인 겸직'],
        ['10', 'EDGE-010', '임다직', '3개 직위 동시 보유'],
      ],
      [600, 1500, 1500, 5760],
    ),
    p('※ 나머지 특수 상황 직원은 별도 테스트북 파일의 특수 상황 시트를 참고해 주세요.'),
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
        ['치명적 (Critical)', '시스템 사용 불가, 데이터 손실/유출 위험', '로그인 불가, 급여 계산 오류, 다른 법인 데이터가 보임'],
        ['중대 (Major)', '핵심 업무 수행 불가, 우회 방법 없음', '휴가 신청 실패, 결재 승인 안됨, 직원 등록 오류'],
        ['경미 (Minor)', '불편하지만 다른 방법으로 진행 가능', '화면 정렬 어긋남, 번역 누락, 로딩이 느림'],
        ['개선 제안', '기능 개선 아이디어', '사용성 개선, 필터 추가 요청, 라벨 변경'],
      ],
      [1500, 3500, 4360],
    ),
  ];
}

function section8() {
  return [
    h1('8. 이슈 리포트 규칙'),
    p('이슈가 발견되면 별도 피드백 Excel 파일에 아래 정보를 기록해 주세요. 재현 절차가 정확할수록 수정이 빨라집니다.'),
    buildTable(
      ['#', '항목', '작성 방법', '예시'],
      [
        ['1', '모듈명', '테스트 중인 기능 영역', '휴가관리'],
        ['2', '시나리오 번호', '시나리오/체크리스트 항목 번호', 'TC-LEAVE-003'],
        ['3', '사용한 계정', '로그인한 테스트 계정 이메일', 'hr@ctr.co.kr'],
        ['4', '현재 페이지 주소', '브라우저 주소창에서 복사', '/hr/leave/requests'],
        ['5', '재현 절차', '클릭/입력 등 단계별 조작 과정', '1. 휴가 신청 클릭 → 2. 날짜 선택 → 3. 제출'],
        ['6', '기대 결과', '원래는 어떻게 되어야 하는지', '"휴가 신청 완료" 메시지가 표시되어야 함'],
        ['7', '실제 결과', '실제로 어떤 일이 일어났는지', '오류 메시지가 표시됨: "서버 오류"'],
        ['8', '심각도', '위 7번 섹션의 기준 참고', '중대 (Major)'],
        ['9', '화면 캡처', '가능하면 첨부 (PrintScreen → Excel에 붙여넣기)', '(이미지 첨부)'],
      ],
      [500, 1900, 3060, 3900],
    ),
  ];
}

function section9() {
  return [
    h1('9. 알려진 이슈'),
    p('아래 항목들은 현재 개발팀이 인지하고 있거나 의도된 동작입니다. 버그가 아니니 발견하셔도 따로 보고하지 않으셔도 됩니다.'),
    buildTable(
      ['#', '내용', '상세 설명'],
      [
        ['1', '비정기 보상 변경 알림 미발송', '정기 보상 외 임시 보상 조정 시 결재 알림이 자동 발송되지 않습니다 (개발팀에서 별도 작업 중).'],
        ['2', '출퇴근 화면 일부 오류 메시지 누락', '특정 오류 상황에서 화면 알림이 표시되지 않을 수 있습니다.'],
        ['3', '발령일 날짜 계산 1일 오차 가능', '시간대 처리 차이로 인해 발령일이 1일 다르게 보일 수 있습니다.'],
        ['4', '법인 코드 변경 시 캐시 새로고침 필요', '법인 코드를 변경한 직후 화면이 즉시 반영되지 않을 수 있으며, 잠시 후 새로고침 시 정상 표시됩니다.'],
        ['5', '일부 자동 검증 항목 점검 중', '내부 자동 점검 항목 중 일부가 별도 정리 작업 중이며, UAT 시나리오 진행에는 영향이 없습니다.'],
      ],
      [500, 2860, 6000],
    ),
  ];
}

function section10() {
  return [
    h1('10. 통과 기준 & 최종 승인'),
    h2('10.1 통과 기준 (모두 충족 시 GO)'),
    buildTable(
      ['기준', '조건'],
      [
        ['치명적 이슈 (Critical)', '0건'],
        ['중대 이슈 (Major) — 핵심 모듈', '미해결 0건 — 인사/출퇴근/휴가/급여/결재/설정'],
        ['중대 이슈 (Major) — 전체', '해결률 80% 이상 (미해결 건은 담당자/기한/우회방안 명시)'],
        ['핵심 시나리오 통과율', '95% 이상'],
        ['전체 체크리스트 통과율', '90% 이상'],
        ['보안/데이터 이슈', '0건 — 법인 간 데이터 분리, 급여 정보 유출, 권한 누수'],
      ],
      [3000, 6360],
    ),
    p('※ "해결됨" 정의: 수정 완료 → 테스트 사이트 반영 → 보고자가 재테스트 → 종료'),
    h2('10.2 최종 승인 양식'),
    buildTable(
      ['모듈', '담당자', '날짜', '판정', '수용한 미해결 건', '서명'],
      [
        ['인사관리', '', '', '승인 / 반려', '', ''],
        ['출퇴근', '', '', '승인 / 반려', '', ''],
        ['휴가관리', '', '', '승인 / 반려', '', ''],
        ['급여', '', '', '승인 / 반려', '', ''],
        ['결재/승인', '', '', '승인 / 반려', '', ''],
        ['마스터데이터 설정', '', '', '승인 / 반려', '', ''],
        ['기타 (체크리스트)', '', '', '승인 / 반려', '', ''],
      ],
      [2000, 1300, 1300, 1660, 1900, 1200],
    ),
    h2('10.3 최종 판정'),
    p('☐  전체 승인 — 운영 배포 진행'),
    p('☐  조건부 승인 — 명시된 조건 해결 후 배포'),
    p('☐  반려 — 재테스트 필요'),
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
  title: 'CTR HR Hub UAT 가이드',
  description: 'CTR 통합 인사관리 시스템 UAT (사용자 수용 테스트) 가이드',
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
          children: [new TextRun({ text: 'CTR HR Hub UAT 가이드', font: FONT, size: 18, color: '595959' })],
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
