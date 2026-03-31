# 구현 검증 체크리스트

아래 순서대로 실행하고 결과를 보고하세요.

## 1. 타입 체크

```bash
npx tsc --noEmit 2>&1 | tail -20
```

0 errors 확인.

## 2. 린트

```bash
npm run lint 2>&1 | tail -20
```

새 warning 없음 확인.

## 2.5. DB Schema Sync

```bash
npx prisma migrate status 2>&1 | tail -5
```

Must show "Database schema is up to date". Report if drift detected.

## 3. 패턴 준수 확인

`git diff --name-only`로 변경된 파일을 확인하고, 파일 유형별로 규칙 준수를 체크하세요.

### page.tsx 파일 (`rules/pages.md`)
- [ ] `getServerSession(authOptions)` 호출
- [ ] `if (!session?.user) redirect('/login')`
- [ ] `<Suspense fallback={<...Skeleton />}>` 래핑
- [ ] `user` prop을 `SessionUser`으로 Client에 전달

### *Client.tsx 파일 (`rules/components.md`)
- [ ] `'use client'` 디렉티브 첫 줄
- [ ] 파일 헤더 주석 (═══ 구분자)
- [ ] 섹션 구분자 (─── Types/Constants/Helpers/Component ───)
- [ ] props로 `user: SessionUser` 수신
- [ ] 3-상태 처리: loading / error / empty

### API route 파일 (`rules/api.md`, `rules/data-fetching.md`)
- [ ] `withPermission` 래퍼 사용
- [ ] `perm(MODULE.XXX, ACTION.YYY)` 권한 지정
- [ ] `resolveCompanyId` 스코핑 (목록 조회 시)
- [ ] `apiSuccess` / `apiPaginated` / `apiError` 응답 헬퍼

### 에러 처리 (`rules/error-handling.md`)
- [ ] `AppError` 팩토리 사용 (Error 직접 throw 금지)
- [ ] Client: `toast()` 에러 표시
- [ ] 빈 catch 블록 없음

## 4. UI Visual QA (when UI files changed)

Run only if `git diff --name-only` includes `*Client.tsx` or `src/components/**`.

### Tool Selection Guide

| Scenario | Tool | Why |
|----------|------|-----|
| Quick check during dev | Claude Preview (`preview_inspect`) | Computed style: exact color/spacing measurement |
| Systematic QA | `/gstack` or `/qa` | Reports, multi-page, responsive |
| Complex interactions | Computer Use (Claude in Chrome) | Drag-and-drop, nested modals, real login flows |
| Design token verification | Claude Preview `preview_inspect` | Hex values, padding, font-size direct check |

### Checklist (any tool)
- [ ] Navigate changed pages + screenshot
- [ ] DESIGN.md token compliance (cross-check with rules/design.md)
- [ ] Multi-role test: super@ctr.co.kr + employee-a@ctr.co.kr minimum
- [ ] 3-state check: loading skeleton, error toast, empty state
- [ ] Responsive: desktop (1280px) + mobile (375px)

## 5. 결과 요약

위 체크리스트 결과를 아래 형식으로 보고하세요:

| Check | Result | Remarks |
|-------|--------|---------|
| tsc --noEmit | ✅/❌ | error count |
| lint | ✅/❌ | warning count |
| prisma migrate status | ✅/❌ | drift detected? |
| page.tsx patterns | ✅/❌ | non-compliant files |
| Client patterns | ✅/❌ | non-compliant items |
| API route patterns | ✅/❌ | non-compliant items |
| Error handling | ✅/❌ | non-compliant items |
| UI visual QA | ✅/❌/N/A | design token issues |
