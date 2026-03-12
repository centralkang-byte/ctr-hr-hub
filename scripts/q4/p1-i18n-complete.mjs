/**
 * Q-4 P1: i18n Auto-Replacement Script
 * Safe flat-string replacements only. No JSX structure changes.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');
const LOG_DIR = path.join(ROOT, 'scripts/q4');

const report = {
  files_scanned: 0,
  files_modified: 0,
  placeholder: 0,
  alert_simple: 0,
  toast_kr: 0,
  h1_title: 0,
  confirm_simple: 0,
};

// Log files for detect-only patterns
const LOGS = {
  emptystate: [],
  confirm_complex: [],
  submitguard: [],
  button_complex: [],
  placeholder_unmapped: [],
  alert_complex: [],
};

// ─── Placeholder Map ────────────────────────────────────────────────────────
const PLACEHOLDER_MAP = [
  // Generic patterns → tCommon()
  [/placeholder="검색\.\.\."/g, "placeholder={tCommon('searchPlaceholder')}"],
  [/placeholder="검색어를 입력하세요\.\.\."/g, "placeholder={tCommon('searchPlaceholder')}"],
  [/placeholder="검색어를 입력하세요"/g, "placeholder={tCommon('searchPlaceholder')}"],
  [/placeholder="검색어 입력\.\.\."/g, "placeholder={tCommon('searchPlaceholder')}"],
  [/placeholder="검색어 입력"/g, "placeholder={tCommon('searchPlaceholder')}"],
  [/placeholder="이름으로 검색\.\.\."/g, "placeholder={tCommon('searchByName')}"],
  [/placeholder="이름으로 검색"/g, "placeholder={tCommon('searchByName')}"],
  [/placeholder="이름 검색\.\.\."/g, "placeholder={tCommon('searchByName')}"],
  [/placeholder="이름 검색"/g, "placeholder={tCommon('searchByName')}"],
  [/placeholder="이름, 부서 검색\.\.\."/g, "placeholder={tCommon('searchPlaceholder')}"],
  [/placeholder="이름, 부서 검색"/g, "placeholder={tCommon('searchPlaceholder')}"],
  [/placeholder="이름, 이메일, 연락처 검색\.\.\."/g, "placeholder={tCommon('searchPlaceholder')}"],
  [/placeholder="직원 검색\.\.\."/g, "placeholder={tCommon('searchEmployee')}"],
  [/placeholder="직원 검색"/g, "placeholder={tCommon('searchEmployee')}"],
  [/placeholder="직원 이름 또는 사번 검색"/g, "placeholder={tCommon('searchEmployee')}"],
  [/placeholder="직원명, 설명 검색"/g, "placeholder={tCommon('searchPlaceholder')}"],
  [/placeholder="이름 또는 이메일로 검색\.\.\."/g, "placeholder={tCommon('searchPlaceholder')}"],
  [/placeholder="이름 또는 사번으로 검색\.\.\."/g, "placeholder={tCommon('searchEmployee')}"],
  [/placeholder="선택\.\.\."/g, "placeholder={tCommon('selectPlaceholder')}"],
  [/placeholder="선택해주세요\.\.\."/g, "placeholder={tCommon('selectPlaceholder')}"],
  [/placeholder="선택해주세요"/g, "placeholder={tCommon('selectPlaceholder')}"],
  [/placeholder="선택"/g, "placeholder={tCommon('selectPlaceholder')}"],
  [/placeholder="메모를 입력하세요\.\.\."/g, "placeholder={tCommon('enterNote')}"],
  [/placeholder="메모를 입력하세요"/g, "placeholder={tCommon('enterNote')}"],
  [/placeholder="체크인 메모"/g, "placeholder={tCommon('enterNote')}"],
  [/placeholder="내용을 입력하세요\.\.\."/g, "placeholder={tCommon('enterContent')}"],
  [/placeholder="내용을 입력하세요"/g, "placeholder={tCommon('enterContent')}"],
  [/placeholder="제목을 입력하세요\.\.\."/g, "placeholder={tCommon('enterTitle')}"],
  [/placeholder="제목을 입력하세요"/g, "placeholder={tCommon('enterTitle')}"],
  [/placeholder="사유를 입력하세요\.\.\."/g, "placeholder={tCommon('enterReason')}"],
  [/placeholder="사유를 입력하세요"/g, "placeholder={tCommon('enterReason')}"],
  [/placeholder="설명을 입력하세요\.\.\."/g, "placeholder={tCommon('enterDescription')}"],
  [/placeholder="설명을 입력하세요"/g, "placeholder={tCommon('enterDescription')}"],
  [/placeholder="코멘트\.\.\."/g, "placeholder={tCommon('enterComment')}"],
  [/placeholder="코멘트"/g, "placeholder={tCommon('enterComment')}"],
  [/placeholder="코멘트 입력 \(선택\)"/g, "placeholder={tCommon('enterComment')}"],
  [/placeholder="코멘트 \(선택\)"/g, "placeholder={tCommon('enterComment')}"],
  [/placeholder="의견을 입력하세요\.\.\."/g, "placeholder={tCommon('enterContent')}"],
  [/placeholder="이름 입력"/g, "placeholder={tCommon('enterTitle')}"],
  // Performance domain → t()
  [/placeholder="피드백을 입력하세요\.\.\."/g, "placeholder={t('enterFeedback')}"],
  [/placeholder="평가 코멘트 \(선택\)"/g, "placeholder={t('enterComment')}"],
];

// ─── Toast KR Map ────────────────────────────────────────────────────────────
const TOAST_MAP = [
  [/title: '오류'/g, "title: tCommon('error')"],
  [/title: "오류"/g, "title: tCommon('error')"],
  [/title: '저장되었습니다'/g, "title: tCommon('saved')"],
  [/title: "저장되었습니다"/g, "title: tCommon('saved')"],
  [/title: '삭제되었습니다'/g, "title: tCommon('deleted')"],
  [/title: "삭제되었습니다"/g, "title: tCommon('deleted')"],
  [/title: '수정되었습니다'/g, "title: tCommon('updated')"],
  [/title: "수정되었습니다"/g, "title: tCommon('updated')"],
  [/title: '등록되었습니다'/g, "title: tCommon('created')"],
  [/title: "등록되었습니다"/g, "title: tCommon('created')"],
  [/title: '완료되었습니다'/g, "title: tCommon('completed')"],
  [/title: "완료되었습니다"/g, "title: tCommon('completed')"],
  [/title: '처리되었습니다'/g, "title: tCommon('saved')"],
  [/title: "처리되었습니다"/g, "title: tCommon('saved')"],
  [/title: '저장 실패'/g, "title: tCommon('saveFailed')"],
  [/title: "저장 실패"/g, "title: tCommon('saveFailed')"],
  [/title: '저장에 실패했습니다'/g, "title: tCommon('saveFailed')"],
  [/title: "저장에 실패했습니다"/g, "title: tCommon('saveFailed')"],
  [/title: '오류가 발생했습니다'/g, "title: tCommon('error')"],
  [/title: "오류가 발생했습니다"/g, "title: tCommon('error')"],
  [/title: '변경을 취소했습니다'/g, "title: tCommon('cancelled')"],
  [/title: "변경을 취소했습니다"/g, "title: tCommon('cancelled')"],
  [/title: '일괄 부여 실패'/g, "title: tCommon('error')"],
  [/title: '이수 완료 처리되었습니다\.'/g, "title: tCommon('completed')"],
  [/title: '이수 완료 처리되었습니다'/g, "title: tCommon('completed')"],
  [/title: '완료 처리 실패'/g, "title: tCommon('error')"],
  [/title: '신청 실패'/g, "title: tCommon('error')"],
  [/title: '상태 변경 실패'/g, "title: tCommon('saveFailed')"],
  [/title: '수강 신청이 완료되었습니다\.'/g, "title: tCommon('created')"],
  [/title: '수강 신청이 완료되었습니다'/g, "title: tCommon('created')"],
  [/title: '수강 신청 실패'/g, "title: tCommon('error')"],
  [/title: '학습을 시작합니다\.'/g, "title: tCommon('completed')"],
  [/title: '휴가 신청이 완료되었습니다'/g, "title: tCommon('submitted')"],
];

// ─── Simple Alert Map ────────────────────────────────────────────────────────
// Only matches: alert('exact text')  or  alert("exact text")
const ALERT_SIMPLE_MAP = [
  [/\balert\('저장되었습니다'\)/g, "toast({ title: tCommon('saved') })"],
  [/\balert\("저장되었습니다"\)/g, "toast({ title: tCommon('saved') })"],
  [/\balert\('삭제되었습니다'\)/g, "toast({ title: tCommon('deleted') })"],
  [/\balert\("삭제되었습니다"\)/g, "toast({ title: tCommon('deleted') })"],
  [/\balert\('수정되었습니다'\)/g, "toast({ title: tCommon('updated') })"],
  [/\balert\("수정되었습니다"\)/g, "toast({ title: tCommon('updated') })"],
  [/\balert\('등록되었습니다'\)/g, "toast({ title: tCommon('created') })"],
  [/\balert\("등록되었습니다"\)/g, "toast({ title: tCommon('created') })"],
  [/\balert\('완료되었습니다'\)/g, "toast({ title: tCommon('completed') })"],
  [/\balert\("완료되었습니다"\)/g, "toast({ title: tCommon('completed') })"],
  [/\balert\('처리되었습니다'\)/g, "toast({ title: tCommon('saved') })"],
  [/\balert\("처리되었습니다"\)/g, "toast({ title: tCommon('saved') })"],
  [/\balert\('오류가 발생했습니다'\)/g, "toast({ title: tCommon('error'), variant: 'destructive' })"],
  [/\balert\("오류가 발생했습니다"\)/g, "toast({ title: tCommon('error'), variant: 'destructive' })"],
  [/\balert\('저장에 실패했습니다'\)/g, "toast({ title: tCommon('saveFailed'), variant: 'destructive' })"],
  [/\balert\("저장에 실패했습니다"\)/g, "toast({ title: tCommon('saveFailed'), variant: 'destructive' })"],
];

// ─── H1 Title Map ─────────────────────────────────────────────────────────────
// Only replaces <h1 ...>Korean text</h1> — maps to domain t('pageTitle') or specific key
const H1_MAP = [
  // Analytics
  [/<h1([^>]*)>해외 급여 업로드<\/h1>/g, "<h1$1>{t('importTitle')}</h1>"],
  [/<h1([^>]*)>펄스 서베이<\/h1>/g, "<h1$1>{t('pulseSurveyTitle')}</h1>"],
  [/<h1([^>]*)>팀원 평가 \(Manager Evaluation\)<\/h1>/g, "<h1$1>{t('managerEvalTitle')}</h1>"],
  [/<h1([^>]*)>팀원 역량 평가<\/h1>/g, "<h1$1>{t('pageTitle')}</h1>"],
  [/<h1([^>]*)>팀 건강 대시보드<\/h1>/g, "<h1$1>{t('teamHealthTitle')}</h1>"],
  [/<h1([^>]*)>통합 승인함<\/h1>/g, "<h1$1>{tCommon('approvalsInbox')}</h1>"],
  [/<h1([^>]*)>채용단가 ROI 분석<\/h1>/g, "<h1$1>{t('costAnalysisTitle')}</h1>"],
  [/<h1([^>]*)>채용 요청서 작성<\/h1>/g, "<h1$1>{t('requisitionFormTitle')}</h1>"],
  [/<h1([^>]*)>채용 요청<\/h1>/g, "<h1$1>{t('requisitionTitle')}</h1>"],
  [/<h1([^>]*)>자기평가 \(Self Evaluation\)<\/h1>/g, "<h1$1>{t('selfEvalTitle')}</h1>"],
  [/<h1([^>]*)>인력 분석<\/h1>/g, "<h1$1>{t('workforceTitle')}</h1>"],
  [/<h1([^>]*)>이직 분석<\/h1>/g, "<h1$1>{t('turnoverTitle')}</h1>"],
  [/<h1([^>]*)>알림 설정<\/h1>/g, "<h1$1>{t('notificationSettingsTitle')}</h1>"],
  [/<h1([^>]*)>스킬 매트릭스<\/h1>/g, "<h1$1>{t('skillMatrixTitle')}</h1>"],
  [/<h1([^>]*)>수동 조정<\/h1>/g, "<h1$1>{t('adjustmentsTitle')}</h1>"],
  [/<h1([^>]*)>성별 급여 격차 분석<\/h1>/g, "<h1$1>{t('genderPayGapTitle')}</h1>"],
  [/<h1([^>]*)>성과 분석<\/h1>/g, "<h1$1>{t('performanceTitle')}</h1>"],
  [/<h1([^>]*)>설정<\/h1>/g, "<h1$1>{t('pageTitle')}</h1>"],
  [/<h1([^>]*)>승인함<\/h1>/g, "<h1$1>{tCommon('approvalsInbox')}</h1>"],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stripComments(content) {
  return content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function findClientFiles(dir) {
  const results = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.next', 'generated'].includes(entry.name)) walk(full);
      } else if (
        entry.name.endsWith('.tsx') &&
        !entry.name.includes('route') &&
        !entry.name.includes('layout') &&
        !entry.name.includes('middleware') &&
        !['page.tsx'].includes(entry.name)  // Skip pure server pages; include Client files
      ) {
        const content = fs.readFileSync(full, 'utf-8');
        if (content.includes("'use client'") || content.includes('"use client"') || 
            entry.name.includes('Client')) {
          results.push(full);
        }
      }
    }
  }
  walk(dir);
  return results;
}

// ─── Main ────────────────────────────────────────────────────────────────────
const files = findClientFiles(path.join(ROOT, 'src'));
report.files_scanned = files.length;
console.log(`Scanning ${files.length} client files...\n`);

for (const filePath of files.sort()) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  const rel = path.relative(ROOT, filePath);

  // Skip files that don't have tCommon (safety net)
  if (!content.includes('tCommon') && !content.includes('useTranslations')) continue;

  // ── Auto: Placeholder replacements ──
  let plCount = 0;
  for (const [pat, rep] of PLACEHOLDER_MAP) {
    const before = content;
    content = content.replace(pat, rep);
    if (content !== before) plCount++;
  }
  report.placeholder += plCount;

  // ── Auto: Toast KR titles ──
  let toastCount = 0;
  for (const [pat, rep] of TOAST_MAP) {
    const before = content;
    content = content.replace(pat, rep);
    if (content !== before) toastCount++;
  }
  report.toast_kr += toastCount;

  // ── Auto: Simple alert() → toast ──
  let alertCount = 0;
  for (const [pat, rep] of ALERT_SIMPLE_MAP) {
    const before = content;
    content = content.replace(pat, rep);
    if (content !== before) alertCount++;
  }
  report.alert_simple += alertCount;

  // ── Auto: <h1> Korean titles ──
  let h1Count = 0;
  for (const [pat, rep] of H1_MAP) {
    const before = content;
    content = content.replace(pat, rep);
    if (content !== before) h1Count++;
  }
  report.h1_title += h1Count;

  // Write if changed
  if (content !== original) {
    const origLines = original.split('\n').length;
    const newLines = content.split('\n').length;
    if (newLines < origLines * 0.85) {
      console.error(`  SAFETY SKIP (shrunk): ${rel}`);
      continue;
    }
    if (!DRY_RUN) fs.writeFileSync(filePath, content, 'utf-8');
    report.files_modified++;
    if (plCount + toastCount + alertCount + h1Count > 0) {
      console.log(`  ✓ ${path.basename(filePath)} (ph:${plCount} toast:${toastCount} alert:${alertCount} h1:${h1Count})`);
    }
  }

  // ── Detect-only: EmptyState import but no JSX ──
  if (content.includes('EmptyState') && !content.includes('<EmptyState')) {
    LOGS.emptystate.push(rel);
  }

  // ── Detect-only: complex alert() ──
  const stripped = stripComments(content);
  if (/\balert\(/.test(stripped)) {
    LOGS.alert_complex.push(rel);
  }

  // ── Detect-only: confirm() ──
  if (/window\.confirm\(/.test(stripped) || /[^a-zA-Z]confirm\(/.test(stripped.replace(/confirmDelete|confirmApprove|confirmReject|confirmSubmit|confirmDeleteDesc/g, ''))) {
    LOGS.confirm_complex.push(rel);
  }

  // ── Detect-only: needs useSubmitGuard ──
  if (/(type="submit"|handleSubmit[^G]|onSubmit[^G])/.test(content) && !content.includes('useSubmitGuard')) {
    LOGS.submitguard.push(rel);
  }

  // ── Detect-only: complex buttons ──
  const btnMatches = content.match(/>[가-힣]+<\/button>/g);
  if (btnMatches && btnMatches.some(m => !m.includes('tCommon') && !m.includes("t('"))) {
    LOGS.button_complex.push(`${rel}: ${btnMatches.filter(m => !m.includes('tCommon')).join(', ')}`);
  }
}

// Write log files
fs.writeFileSync(path.join(LOG_DIR, 'emptystate-manual.txt'), LOGS.emptystate.join('\n') + '\n');
fs.writeFileSync(path.join(LOG_DIR, 'confirm-manual.txt'), LOGS.confirm_complex.join('\n') + '\n');
fs.writeFileSync(path.join(LOG_DIR, 'submitguard-manual.txt'), LOGS.submitguard.join('\n') + '\n');
fs.writeFileSync(path.join(LOG_DIR, 'button-manual.txt'), LOGS.button_complex.join('\n') + '\n');
fs.writeFileSync(path.join(LOG_DIR, 'alert-complex.txt'), LOGS.alert_complex.join('\n') + '\n');

console.log('\n=== REPORT ===');
console.log(JSON.stringify(report, null, 2));
console.log('\n=== DETECT-ONLY COUNTS ===');
console.log('emptystate-manual:', LOGS.emptystate.length);
console.log('confirm-manual:', LOGS.confirm_complex.length);
console.log('submitguard-manual:', LOGS.submitguard.length);
console.log('button-manual:', LOGS.button_complex.length);
console.log('alert-complex:', LOGS.alert_complex.length);
console.log('\nDRY_RUN:', DRY_RUN);
console.log('Log files written to scripts/q4/');
