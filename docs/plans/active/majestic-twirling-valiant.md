# 체결본 보관함 독립 페이지 (/contracts/archive)

## Context
현재 체결본 보관함은 `/contracts?status=COMPLETED` 필터로 접근하는 계약목록 서브뷰. 독립 페이지로 분리하여 AI 검색, 그리드/리스트 뷰 전환, 보안등급 표시 등 전용 기능 제공.

## Files to Create

### 1. `app/(dashboard)/contracts/archive/page.tsx` (Server Component)
- `getSession()` + RBAC (LIMITED_ROLES 패턴 재사용)
- Prisma query: `status: 'COMPLETED'` 고정 필터
- searchParams: `q`, `type`, `securityLevel`, `dateFrom`, `dateTo`, `page`
- 병렬 쿼리: contracts, total, type별 count
- `amount.toNumber()` 직렬화
- include: `department`, `creator`, `files` (파일 수 표시용)

### 2. `app/(dashboard)/contracts/archive/archive-client.tsx` (Client Component)
- 뷰 전환 state: `grid` | `list` (localStorage 저장, key: `clm-archive-view`)
- AI 검색 input → `/api/search?q=...` 호출 (기존 글로벌 검색 API 재활용)
- 필터바: 계약유형 Select, 보안등급 Select, 텍스트 검색 (URL searchParams 업데이트)
- 그리드 뷰: 3열 카드 레이아웃 (template-grid.tsx 패턴)
- 리스트 뷰: contracts-table.tsx 패턴 테이블
- 보안등급 아이콘: GENERAL(Shield), CONFIDENTIAL(ShieldAlert), TOP_SECRET(ShieldOff)
- 페이지네이션
- EmptyState 컴포넌트 재사용

## Files to Modify

### 3. `lib/rbac.ts` (line 163)
- `signedArchive` href: `/contracts?status=COMPLETED` → `/contracts/archive`

### 4. `messages/ko.json` + `messages/en.json`
- `archive` 네임스페이스 추가: title, searchPlaceholder, aiSearch, viewGrid, viewList, securityLevel labels, noData

## Architecture
```
page.tsx (Server)
  ├─ getSession + RBAC
  ├─ Prisma query (COMPLETED only)
  └─ <ArchiveClient contracts={...} total={...} />

archive-client.tsx (Client)
  ├─ Header: 제목 + 건수 배지 + 뷰전환 토글
  ├─ AI 검색바 (emerald accent, sparkle icon)
  ├─ 필터바: 유형 + 보안등급 + 날짜 + 텍스트검색
  ├─ Grid View: 카드 (유형칩 + 보안아이콘 + 제목 + 상대방 + 금액 + 날짜)
  ├─ List View: 테이블 (contractNumber, title, type, counterparty, amount, securityLevel, date)
  └─ 페이지네이션
```

## Security Level Icons
| Level | Icon | Color |
|-------|------|-------|
| GENERAL | Shield | slate-400 |
| CONFIDENTIAL | ShieldAlert | amber-500 |
| TOP_SECRET | ShieldOff | red-500 |

## Verification
1. `npx tsc --noEmit`
2. Preview: navigate to `/contracts/archive`, verify grid/list toggle, filter, card rendering
3. Sidebar: "체결본 보관함" 클릭 시 `/contracts/archive`로 이동 확인
4. Mobile responsive check
