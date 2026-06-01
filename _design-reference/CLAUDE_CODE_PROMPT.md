# Claude Code 시작 프롬프트

> **사용법**: Claude Code 세션 시작 시 아래 프롬프트를 복사해서 첫 메시지로 붙여넣으세요.
> CLAUDE.md 가 자동으로 로드되지만, 이 프롬프트로 명시적인 워크플로 지시를 추가합니다.

---

## 📋 복사용 프롬프트 (한국어)

```
이 프로젝트는 CTR HR Hub — Workday 스타일 한국형 HRIS 고충실도 프로토타입입니다.
빌드 도구 없이 HR Hub.html 을 브라우저에서 직접 여는 구조입니다 (Babel-in-browser).

작업 시작 전 다음 문서를 순서대로 통독해주세요:

1. CLAUDE.md       — 프로젝트 운영 규칙 (자동 로드되지만 명시적으로 확인)
2. HANDOVER.md     — 아키텍처·파일 맵·최근 변경·함정 (반드시 정독)
3. DESIGN_RULES.md — 디자인 시스템 컨벤션 (페이지 구조·KPI·컬러·톤·라벨)
4. REVIEW_REPORT.md — 30+ 페이지 통합 리뷰 + 우선순위 (P0-P4) + 남은 작업

그리고 다음 핵심 파일들의 구조도 파악해주세요:

- app.jsx           — 라우터 + 전역 모달 마운트 + Tweaks
- shell.jsx         — Sidebar (Classic/Modern) + Topbar + PAGE_LABELS + NAV
- ui.jsx            — 공용 컴포넌트 (Icons, Avatar, Card, EmptyState, useEscClose, 포맷 헬퍼)
- data.js           — window.HR_DATA mock 데이터 스키마
- styles.css        — 단일 통합 스타일시트 (~5500줄)
- HR Hub.html       — 스크립트 로딩 순서

핵심 컨벤션:

- import 금지 (Babel-in-browser) → Object.assign(window, { ... }) 로 전역 노출
- 각 JSX 파일은 고유 훅 별칭 (useStateXX, useCtxXX) 으로 React 훅 추출
- 친근 톤 (~예요/돼요), 격식체 금지
- KPI 패턴 5종 (.wd-stat-strip / .wd-status-chips / .wd-summary-lead / hero / 제거)
- 빈 상태는 <EmptyState /> 컴포넌트 사용 (구 <div className="empty"> 도 호환)
- 모달 ESC 는 반드시 useEscClose(open, onClose) 사용 (직접 keydown 금지)
- 페이지 추가 시 7단계 체크리스트 (HANDOVER.md §9.3)
- styles.css 의 :root 컬러 변수를 인라인 hex 보다 우선

진행 완료 작업:
- P0 (3건), P1 (4건), P2 #8·#10 (2건), P3 (5건), P4 (3건) 모두 완료
- P2 #9 (설정 placeholder 44탭) 만 남음 — REVIEW_REPORT.md 참고

작업 시작 전 다음을 확인해주세요:
1. HR Hub.html 을 브라우저에서 열어 콘솔 에러 없이 정상 동작하는지
2. ⌘K (Cmd/Ctrl+K) 로 글로벌 검색 열리는지
3. 위 4개 문서를 모두 읽었는지

그 다음에 어떤 작업부터 진행할지 알려주세요.
다음 우선 후보:
- P2 #9 설정 placeholder 채우기 (시스템 3탭 + 카테고리 대표 5탭 = 8탭 우선)
- 인사이트 차트 데이터를 페이지 내 하드코딩 → data.js 로 이전 (refactor)
- 다크모드 (--bg, --fg 등 변수는 이미 분리되어 있음)
- API 연동 (window.HR_DATA → fetch 결과로 교체)
- 새 페이지 추가 (가족수당·4대보험 등)
- 기존 페이지 개선

작업 중 컨벤션 위반이 발견되면 즉시 알려주시고, 수정 전 변경 의도를 한 줄로 요약해주세요.
```

---

## 🌐 영어 버전 (필요 시)

```
This project is **CTR HR Hub** — a Workday-style Korean HRIS high-fidelity prototype.
It runs without a build tool — just open HR Hub.html in a browser (Babel-in-browser).

Before any work, please read in order:

1. CLAUDE.md       — operating rules (auto-loaded, but explicitly verify)
2. HANDOVER.md     — architecture, file map, recent changes, pitfalls
3. DESIGN_RULES.md — design system conventions
4. REVIEW_REPORT.md — priority audit (P0-P4) and remaining work

Then survey these core files:

- app.jsx     — router + global modals + Tweaks
- shell.jsx   — Sidebar + Topbar + PAGE_LABELS + NAV
- ui.jsx      — shared components (Icons, Avatar, Card, EmptyState, useEscClose, formatters)
- data.js     — window.HR_DATA mock schema
- styles.css  — single stylesheet (~5500 lines)
- HR Hub.html — script load order

Critical conventions:

- NO `import` statements (Babel-in-browser) — use `Object.assign(window, { ... })`
- Each JSX file uses unique hook aliases (e.g. `useStateEM`, `useCtxOB`) to avoid collision
- Korean friendly tone (`~예요/돼요`) throughout — no formal style
- KPI patterns: 5 options documented in DESIGN_RULES.md
- Use <EmptyState /> for empty states (legacy <div className="empty"> stays for compat)
- Use `useEscClose(open, onClose)` for any modal — never raw keydown
- Adding a page: 7-step checklist in HANDOVER.md §9.3
- Prefer CSS variables (--accent, --success, etc.) over inline hex

Completed: P0 (3) · P1 (4) · P2 #8/#10 (2) · P3 (5) · P4 (3).
Remaining: P2 #9 (settings 44 placeholder tabs) — see REVIEW_REPORT.md.

Confirm before starting:
1. Open HR Hub.html in a browser — no console errors
2. Press ⌘K / Ctrl+K — global search opens
3. Confirm you've read all 4 docs above

Then tell me which task to tackle first.
```

---

## ⚙️ 추가 셸 명령 (선택)

GitHub 에 푸시하고 Claude Code 가 클론해서 시작한다면:

```bash
# 로컬에서 git 초기화 후
git init
git add .
git commit -m "초기 핸드오버 — P0-P4 모두 완료, 설정 placeholder 만 남음"
git remote add origin <your-repo-url>
git push -u origin main
```

Claude Code 에서:

```bash
git clone <your-repo-url> ctr-hr-hub
cd ctr-hr-hub
# (위 프롬프트 붙여넣기)
```

---

## 💡 사용 팁

1. **문서를 먼저 읽혔는지 확인**: Claude Code 가 가끔 문서를 스킵할 수 있어요. 프롬프트의 "작업 시작 전 다음을 확인해주세요" 부분으로 명시적 확인.

2. **컨벤션 위반 발견 시 즉시 지적**: 위 프롬프트 마지막 줄. Claude Code 가 무의식적으로 `import`, 격식체, 인라인 hex 색상 등을 쓸 수 있으니 한 번 더 환기.

3. **작업 의도 한 줄 요약**: 변경 전 의도를 명시하게 하면 큰 사고를 막아요.

4. **REVIEW_REPORT.md 우선순위 따르기**: P0 → P1 → ... 순서. 단일 작업 깊이 보다 일관성 우선.

5. **빌드 도구 도입 제안 거절**: Claude Code 가 "vite/webpack 으로 마이그레이션 하시겠어요?" 할 수 있어요. **빌드 도구 없음이 의도된 설계** — 거절하세요.
