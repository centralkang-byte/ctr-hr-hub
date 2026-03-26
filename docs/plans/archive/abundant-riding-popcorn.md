# Plan: CTR HR Hub 디자인 시스템 구축 (DESIGN.md)

## Context

CTR HR Hub의 UI가 페이지마다 하드코딩된 hex 값(30+), 상태 뱃지 색상 불일치(7개+ 파일이 독립 정의), 카드 스타일 4종 혼재 등 디자인 시스템 부재로 일관성이 깨져 있다. 이를 해결하기 위해 DESIGN.md(프로젝트 디자인 SSOT)를 생성하고, 후속으로 코드를 수정할 기반을 마련한다.

## 리서치 완료 사항

### 현재 문제 (5가지 점검 완료)
1. **시맨틱 컬러 🔴**: APPROVED 4종, PENDING 3종, REJECTED 4종 색상 혼재. `badge.tsx`(hex)와 `StatusBadge.tsx`(Tailwind) 서로 다른 시스템
2. **차트 컬러 🟡**: `CHART_THEME`, `CHART_COLORS`, CSS `--chart-1~5` 세 곳에 중복 정의, 값 불일치
3. **Z-Index 🟢**: z-50→z-10 계층 깔끔, 문서화만 필요
4. **인터랙티브 상태 🟢**: focus/hover/disabled 일관적, hex 하드코딩만 교체 필요
5. **아이콘 🟢**: lucide-react 100% 통일, 사이즈 상수화 필요

### 추가 발견
- 카드 스타일 4종 (shadow 유무, p-5 vs p-6, border 색상 차이)
- 페이지 헤더 50%가 PageHeader 컴포넌트 미사용
- 폼 인풋 border 색상 `#E8E8E8` vs `#D4D4D4` 혼재
- `text-[15px]`, `text-[11px]` 임의 픽셀값 사용

## Step 1: /design-consultation 실행

`/design-consultation` 스킬을 실행하여:
- 현재 코드베이스 분석 결과를 입력으로 제공
- 컬러 팔레트 (Primary, Neutral, Semantic, Chart)
- 타이포그래피 스케일 (CJK 고려)
- 스페이싱 시스템 (4px 기반)
- 레이아웃 패턴 표준
- DESIGN.md 생성
- 폰트/컬러 프리뷰 페이지 생성

## Step 2: 후속 작업 (별도 세션)

DESIGN.md 기반으로 실제 코드 수정:
1. CSS 변수 통합 (`globals.css`)
2. `STATUS_COLORS` 단일 파일 생성 → 7개+ 파일의 개별 정의 교체
3. `CHART_THEME` 단일화
4. `table.tsx`, `button.tsx`, `input.tsx` 등 핵심 컴포넌트 hex → CSS 변수
5. 카드/뱃지/인풋 스타일 통일

## Verification

- DESIGN.md가 프로젝트 루트에 생성됨
- 프리뷰 페이지에서 컬러/폰트/스페이싱 시각 확인
- 기존 코드 변경 없음 (DESIGN.md는 문서 + 프리뷰만)
