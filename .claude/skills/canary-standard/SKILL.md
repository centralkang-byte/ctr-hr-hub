---
name: canary-standard
description: 카나리(canary) 컴포넌트 작업 표준 — N1 기능충실도 7레이어 3분법 + N2 E2E 의무 + 검증 게이트 + P2 색토큰통합 변형. "카나리 작업", "canary", "N1/N2", "기능 충실도 audit", 다중선택 바·일괄액션 카나리 작업 시작 시 반드시 로드.
---

> **상태 (2026-06)**: Phase 2 카나리(P1-1~P1-7, P2a/P2b)는 **완료**. 본 표준은 **Phase 3a 카나리 슬롯의 준거**로 유지된다.
> **주의**: 아래 "gstack 3구간", "D3 사전 audit"은 어느 SSOT에도 정식 정의가 없는 내부 약칭(aspirational) — 실제 게이트 기준은 `.claude/commands/verify.md`로 해석한다.

## 카나리 작업 표준 (P1-7부터 모든 카나리에 적용)

### N1 — 기능 충실도 3분법

카나리 컴포넌트가 노출하는 액션마다 사전 audit 후 분류:

| 분류 | 조건 | 처리 |
|---|---|---|
| (가) 완전 존재 | 7레이어 모두 작동 | 연결만. 신규 구현 0 |
| (나) 부분 존재 | 일부 레이어만 존재 | 누락 레이어만 구현 + 연결 |
| (다) 미존재 | 어느 레이어도 없음 | 전체 구현 (권한·API·DB·상태·UX 끝까지) |

"존재" = end-to-end 7레이어: ① Prisma mutation ② API endpoint(route+validation+RLS)
③ 권한 가드(롤별) ④ FE mutation ⑤ UI 트리거 ⑥ 사용자 피드백(toast/loading/error)
⑦ 상태 갱신(선택 해제·refetch). 1개라도 누락 → (나). **mock·stub·"준비 중
disabled" 금지** (P1-6b quick-actions disabled는 시그니처 외 액션 한정 예외).
누락분 구현이 시그니처 범위를 크게 초과하면 사전 보고 후 사용자 판단
(A: P1-7 내 구현 / B: 해당 액션 제외 + 별도 트랙 + 카나리 비노출).

### N2 — E2E 테스트 의무

카나리 액션마다 Playwright E2E 작성: 다중선택→바 노출→액션→실결과 검증
(DB/UI/toast) + 롤별(가능 롤 / 비가시 롤). 위치 `e2e/flows/*.spec.ts`
(`npm run test:e2e`). **gstack 라이브(시각) ≠ E2E(자동화) — 둘 다 PASS해야 완료.**

### 검증 게이트 (강화)

tsc 0 · lint clean · Codex Gate 2 HIGH 0 · **E2E PASS(롤별)** · gstack 3구간
(라이트 풀 + 다크 스모크 + ctr-* known-deferred) → 커밋·푸시 → 보고 → 승인.
D3 사전 audit = 액션 × 7레이어 매트릭스 표로 보고.

### P2 토큰통합 트랙 변형 (색 SSOT — 시그니처 아님)

색 토큰 통합(예: Workday `--wt-*` 팔레트 SSOT)은 N1/N2를 다음으로 변형:

- **N1 변형 = 색 매핑 표**: 토큰별 (가) 신 hex/oklch 정의 / (나) 기존 어느
  토큰·hex 가 매핑 / (다) 영향 파일·셀렉터. 7레이어 audit 대체.
- **N2 변형 = 시각 회귀 3축 단언**: ① 변경 대상 셀렉터 computed-style →
  신 값 확인 ② 불변 대상(나머지 토큰) 회귀 0 ③ 그 외(chrome/타이포/
  레이아웃) before/after PNG. (픽셀 diff 도구 미가정 — computed-style
  정량 + PNG + 사용자 판정.)
- **변환 규칙**: oklch→HSL 등 색공간 변환은 **수동·근사 금지**. 브라우저
  엔진(`getComputedStyle`) 또는 검증된 라이브러리로만. 신규 토큰값은
  globals.css 수정 **전 swatch(HTML+PNG)로 사전 보고·시각 확인 게이트**.
- **블라스트 분리**: 다소비처(차트 등 10+) 토큰은 저블라스트(상태/아바타)
  와 별 서브트랙으로 분리, 각 카나리 1곳 후 확산.
- 다크 토큰은 레퍼런스 정의 없으면 라이트만 통합, 다크는 known-deferred 합류.
