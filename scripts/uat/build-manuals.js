// CTR HR Hub Feature Manuals (markdown → docx)
//
// Run: cd scripts/uat && node build-manuals.js
// Output: docs/manuals/docx/<한글 파일명>.docx (12 files)
//
// Converts each docs/manuals/*.md (except README) into a Word doc styled to
// match docs/uat/UAT_가이드_v2.docx (Malgun Gothic, header/footer, page numbers).
//
// Markdown features handled: H1/H2/H3, paragraphs, GFM tables, bullet lists,
// numbered lists, fenced code blocks, blockquote callouts, inline bold/italic/code,
// links (rendered as plain text). Inline markdown is intentionally minimal — manuals
// follow a known structural template (see docs/manuals/README.md).

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  TabStopType, TabStopPosition,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak,
} = require('docx');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MANUALS_DIR = path.join(REPO_ROOT, 'docs/manuals');
const OUT_DIR = path.join(MANUALS_DIR, 'docx');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------- Manual registry (markdown file → Korean docx filename) ----------
// Order matches docs/manuals/README.md.
const MANUALS = [
  { md: 'leave.md',         out: '01_휴가관리_매뉴얼.docx',         title: '휴가관리 매뉴얼' },
  { md: 'payroll.md',       out: '02_급여_매뉴얼.docx',             title: '급여 매뉴얼' },
  { md: 'approval.md',      out: '03_결재승인_매뉴얼.docx',         title: '결재·승인 매뉴얼' },
  { md: 'loa.md',           out: '04_휴직_매뉴얼.docx',             title: '휴직 매뉴얼' },
  { md: 'employee.md',      out: '05_인사관리_매뉴얼.docx',         title: '인사관리 매뉴얼' },
  { md: 'attendance.md',    out: '06_출퇴근_매뉴얼.docx',           title: '출퇴근 매뉴얼' },
  { md: 'recruitment.md',   out: '07_채용_매뉴얼.docx',             title: '채용 매뉴얼' },
  { md: 'performance.md',   out: '08_성과평가_매뉴얼.docx',         title: '성과평가 매뉴얼' },
  { md: 'compensation.md',  out: '09_보상_매뉴얼.docx',             title: '보상 매뉴얼' },
  { md: 'onboarding.md',    out: '10_온보딩오프보딩_매뉴얼.docx',   title: '온보딩·오프보딩 매뉴얼' },
  { md: 'settings.md',      out: '11_마스터데이터설정_매뉴얼.docx', title: '마스터데이터·설정 매뉴얼' },
  { md: 'insights.md',      out: '12_인사이트분석_매뉴얼.docx',     title: '인사이트·분석 매뉴얼' },
];

// ---------- Style helpers (mirror UAT guide) ----------
const FONT = 'Malgun Gothic';
const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const cellBorders = { top: border, bottom: border, left: border, right: border };

const BLACK_RUN = { font: FONT, size: 22 }; // 11pt

function runsFromInline(text, baseOpts = {}) {
  // Parse **bold**, *italic*, `code`. No nesting. Links [text](url) → text only.
  // Returns an array of TextRun.
  const runs = [];
  let i = 0;
  let buf = '';
  const flush = (opts = {}) => {
    if (buf.length === 0) return;
    runs.push(new TextRun({ text: buf, ...BLACK_RUN, ...baseOpts, ...opts }));
    buf = '';
  };
  while (i < text.length) {
    const ch = text[i];
    // **bold**
    if (ch === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        flush();
        runs.push(new TextRun({
          text: text.slice(i + 2, end), ...BLACK_RUN, ...baseOpts, bold: true,
        }));
        i = end + 2;
        continue;
      }
    }
    // `code`
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        flush();
        runs.push(new TextRun({
          text: text.slice(i + 1, end),
          font: 'Consolas',
          size: 20,
          ...baseOpts,
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' },
        }));
        i = end + 1;
        continue;
      }
    }
    // [text](url) → text only
    if (ch === '[') {
      const close = text.indexOf('](', i + 1);
      const closeEnd = close !== -1 ? text.indexOf(')', close + 2) : -1;
      if (close !== -1 && closeEnd !== -1) {
        const linkText = text.slice(i + 1, close);
        flush();
        runs.push(new TextRun({
          text: linkText, ...BLACK_RUN, ...baseOpts, color: '1B7BA8',
        }));
        i = closeEnd + 1;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return runs;
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    ...opts,
    children: runsFromInline(text, opts.run || {}),
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
    children: runsFromInline(text),
  });
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    children: runsFromInline(text),
  });
}

function codeBlock(text) {
  // Render as a single shaded paragraph with monospace font. Preserve line breaks.
  const lines = text.split('\n');
  const children = [];
  lines.forEach((line, idx) => {
    if (idx > 0) children.push(new TextRun({ break: 1 }));
    children.push(new TextRun({ text: line, font: 'Consolas', size: 18 }));
  });
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    indent: { left: 240, right: 240 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F5F5F5' },
    children,
  });
}

function callout(text) {
  // Blockquote → light-blue shaded paragraph (matches UAT guide style).
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    indent: { left: 240, right: 240 },
    shading: { fill: 'E8F4F8', type: ShadingType.CLEAR, color: 'auto' },
    children: runsFromInline(text),
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
        children: runsFromInline(String(text), {
          bold: isHeader || opts.bold || undefined,
        }),
      }),
    ],
  });
}

function buildTable(headers, rows) {
  // Auto-size columns to ~9360 DXA (6.5" content width). Equal distribution.
  const TOTAL = 9360;
  const colCount = headers.length;
  const colW = Math.floor(TOTAL / colCount);
  const columnWidths = Array(colCount).fill(colW);
  return new Table({
    width: { size: TOTAL, type: WidthType.DXA },
    columnWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((hdr, i) =>
          cell(hdr, { header: true, width: columnWidths[i], align: AlignmentType.CENTER }),
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

// ---------- Markdown parser ----------
function parseMarkdown(src) {
  // Strip frontmatter-like leading quote metadata block? We render it as part of body.
  const lines = src.split(/\r?\n/);
  const blocks = [];
  let i = 0;

  // Skip the H1 line if present at top (we render title separately on cover page).
  // We'll still capture it as docTitle.
  let docTitle = null;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && lines[i].startsWith('# ')) {
    docTitle = lines[i].slice(2).trim();
    i++;
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line → skip
    if (trimmed === '') { i++; continue; }

    // Horizontal rule → page break optional; we skip as document flow already breaks.
    if (/^---+$/.test(trimmed) || /^===+$/.test(trimmed)) { i++; continue; }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ type: 'code', text: buf.join('\n') });
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', text: trimmed.slice(4).trim() });
      i++; continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3).trim() });
      i++; continue;
    }
    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', text: trimmed.slice(2).trim() });
      i++; continue;
    }

    // Blockquote (callout) — consume contiguous > lines
    if (trimmed.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'callout', text: buf.join(' ').trim() });
      continue;
    }

    // GFM table — header row | separator row | body rows
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-+:?/.test(lines[i + 1])) {
      const headerCells = splitTableRow(line);
      i += 2; // skip header + separator
      const bodyRows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', headers: headerCells, rows: bodyRows });
      continue;
    }

    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'bullets', items: buf });
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'numbers', items: buf });
      continue;
    }

    // Paragraph — accumulate until blank line or block-starter
    const buf = [trimmed];
    i++;
    while (i < lines.length) {
      const nxt = lines[i];
      const nxtTrim = nxt.trim();
      if (nxtTrim === '') break;
      if (nxtTrim.startsWith('#')) break;
      if (nxtTrim.startsWith('>')) break;
      if (nxtTrim.startsWith('```')) break;
      if (/^[-*]\s+/.test(nxtTrim)) break;
      if (/^\d+\.\s+/.test(nxtTrim)) break;
      if (/^---+$/.test(nxtTrim)) break;
      if (nxt.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-+:?/.test(lines[i + 1])) break;
      buf.push(nxtTrim);
      i++;
    }
    blocks.push({ type: 'p', text: buf.join(' ') });
  }

  return { docTitle, blocks };
}

function splitTableRow(line) {
  // Trim leading/trailing pipes, then split on |
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

// ---------- Cover page ----------
function coverPage(manual) {
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
        new TextRun({ text: manual.title, font: FONT, size: 36, bold: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 1200 },
      children: [
        new TextRun({ text: '기능 매뉴얼 (Feature Manual)', font: FONT, size: 28, color: '595959' }),
      ],
    }),
    buildTable(
      ['항목', '내용'],
      [
        ['작성일', '2026년 5월 12일'],
        ['작성자', 'CTR 개발팀'],
        ['대상', '인사 담당자, 임원, 신규 입사자'],
        ['분류', '내부 문서 — 대외비'],
      ],
    ),
    pageBreak(),
  ];
}

// ---------- Block → docx element ----------
function renderBlock(b) {
  switch (b.type) {
    case 'h1': return [h1(b.text)];
    case 'h2': return [h2(b.text)];
    case 'h3': return [h3(b.text)];
    case 'p':  return [p(b.text)];
    case 'callout': return [callout(b.text)];
    case 'code': return [codeBlock(b.text)];
    case 'bullets': return b.items.map(bullet);
    case 'numbers': return b.items.map(numbered);
    case 'table':
      if (b.rows.length === 0) return [p('(표 데이터 없음)')];
      return [buildTable(b.headers, b.rows)];
    default: return [];
  }
}

// ---------- Document assembly ----------
function buildDoc(manual, parsed) {
  return new Document({
    creator: 'CTR HR Hub Dev Team',
    title: `CTR HR Hub ${manual.title}`,
    description: `CTR 통합 인사관리 시스템 ${manual.title}`,
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
            children: [new TextRun({
              text: `CTR HR Hub — ${manual.title}`,
              font: FONT, size: 18, color: '595959',
            })],
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
        ...coverPage(manual),
        ...parsed.blocks.flatMap(renderBlock),
      ],
    }],
  });
}

// ---------- Main loop ----------
async function main() {
  for (const m of MANUALS) {
    const srcPath = path.join(MANUALS_DIR, m.md);
    if (!fs.existsSync(srcPath)) {
      console.error(`✗ Missing: ${srcPath}`);
      continue;
    }
    const md = fs.readFileSync(srcPath, 'utf8');
    const parsed = parseMarkdown(md);
    const doc = buildDoc(m, parsed);
    const buf = await Packer.toBuffer(doc);
    const outPath = path.join(OUT_DIR, m.out);
    fs.writeFileSync(outPath, buf);
    const stat = fs.statSync(outPath);
    console.log(`✓ ${m.out.padEnd(40)} (${(stat.size / 1024).toFixed(1)} KB)`);
  }
  console.log(`\n12 manuals → ${path.relative(REPO_ROOT, OUT_DIR)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
