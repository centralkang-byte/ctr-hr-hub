# Plan: 3차 QA — UX 품질 개선 (U1~U4)

## Context
1차 QA(보안/RBAC), 2차 QA(서비스 완성도) 완료 후 3차 UX 품질 개선 진행 중. U1(디자인 토큰 통합)은 커밋 완료. U2(EmptyState 컴포넌트) 작업 중 — 공통 컴포넌트 생성 완료, 9개 파일 중 4개(Cards, Reports, Transactions) 교체 완료. 나머지 파일 교체 + U3(Toast) + U4(PageHeader) 진행 필요.

---

## U1: 디자인 토큰 통합 ✅ 완료 (커밋: 98f5f7f)
- `src/constants/colors.ts`에 `T` export 추가 (호환 키 포함)
- 9개 Client 파일에서 `const T = {...}` → `import { T } from '@/constants/colors'`

## U2: EmptyState 공통 컴포넌트 (진행 중)
- `src/components/ui/empty-state.tsx` 생성 완료
- 교체 완료: CardsClient, ReportsClient, TransactionsClient
- 남은 교체: RulesClient, MccClient, LogsClient

## U3: Toast 알림 시스템
- 기존 `AlertToast.tsx` 활용하여 전역 Toast hook 생성

## U4: PageHeader 표준화
- 공통 `PageHeader` 컴포넌트 생성, 각 페이지 헤더 통합

## Verification
- `npx next build` — 타입 에러 없이 빌드 통과
- 빈 상태 UI가 아이콘 + 메시지 + 설명으로 일관되게 표시되는지 확인
