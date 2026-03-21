# B8-1: 조직도 시각화 + 조직 개편

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A(A2 departments/positions + Effective Dating) + B1(법인 엔진) + B2(직원 프로필 + EffectiveDatePicker) 완료.
> **트랙**: **[B] 트랙** — context/TRACK_B.md에만 기록

### DB 접근 규칙 (전 세션 공통)

- 모든 테이블 생성/변경은 `prisma/schema.prisma` → `prisma migrate dev`
- 쿼리는 Prisma Client 사용
- Supabase는 Auth + Storage + Realtime 용도만

---

## 컨텍스트 파일 규칙 (병렬 개발)

```bash
# 읽기: 3개 파일 모두 읽으세요
cat context/SHARED.md       # 공유 인프라 상태 확인
cat context/TRACK_A.md      # A 트랙이 뭘 하고 있는지 참고
cat context/TRACK_B.md      # 이전 B 트랙 작업 확인

# 쓰기: TRACK_B.md에만 기록하세요
# ❌ SHARED.md 수정 금지
# ❌ TRACK_A.md 수정 금지

# migrate 이름 규칙: b_ 접두사 사용
npx prisma migrate dev --name b_b8_org_chart
```

---

## 세션 목표

A2에서 구축한 departments/positions 데이터를 **인터랙티브 조직도**로 시각화하고, **조직 개편(Restructuring)** 시 "초안→비교→확정" 워크플로를 제공합니다. B2의 EffectiveDatePicker를 활용한 시점 조회도 구현합니다.

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. 컨텍스트 파일 3개 읽기
cat context/SHARED.md
cat context/TRACK_A.md
cat context/TRACK_B.md

# 2. A2 departments 테이블 구조 확인 (SHARED.md에서)
# - parent_id (계층 구조)
# - company_id (법인별 부서)
# - Effective Dating 적용 여부 (department_assignments?)

# 3. A2 positions 테이블 구조 확인
# - department_id 연결
# - 현재 배정 직원 조회 가능 여부

# 4. B2 EffectiveDatePicker 컴포넌트 경로 + props 확인

# 5. 기존 STEP에 조직도 UI가 있는지 확인
# - 있으면 확장, 없으면 신규 구축

# 6. [A] 트랙 상태 확인 — TRACK_A.md에서 DB 변경사항 확인
# A 트랙이 migrate를 실행했다면 먼저 pull 후 시작
npx prisma db pull  # 필요 시
```

---

## 핵심 설계 원칙

### 1. 조직도 = 트리 구조 시각화

```
CTR Korea Co., Ltd.
├── 경영지원본부 (본부장: 이OO)
│   ├── 인사팀 (팀장: 김OO) — 8명
│   ├── 재무팀 (팀장: 박OO) — 6명
│   └── 총무팀 (팀장: 최OO) — 5명
├── 기술연구소 (소장: 정OO)
│   ├── 선행연구팀 — 12명
│   └── 제품개발팀 — 15명
├── 생산본부 (본부장: 한OO)
│   ├── 생산1팀 — 45명
│   ├── 생산2팀 — 38명
│   └── 품질관리팀 — 10명
└── 영업본부 (본부장: 강OO)
    ├── 국내영업팀 — 8명
    └── 해외영업팀 — 6명
```

### 2. 3가지 뷰 모드

| 모드 | 용도 | 시각화 |
|------|------|--------|
| **트리 차트** | 전체 조직 구조 조망 | 수직/수평 트리 노드 |
| **리스트 뷰** | 부서별 상세 정보 | 접이식 아코디언 |
| **그리드 뷰** | 부서 카드 레이아웃 | 카드 그리드 (인원수/부서장 표시) |

### 3. 조직 개편 = 초안(Draft) → 비교 → 확정

```
현재 조직도 (실 데이터)
    ↓ [조직 개편 시작]
초안 조직도 (Draft — 수정 가능)
    ↓ [부서 이동/합병/신설/폐지]
변경 사항 diff 비교
    ↓ [HR 검토]
적용일(Effective Date) 지정 → 확정
    ↓ [A2 Effective Dating으로 반영]
새 조직도 활성화
```

---

## 작업 순서 (7 Tasks)

### Task 1: DB 마이그레이션 — Prisma 모델 추가

`prisma/schema.prisma`에 추가 후 `npx prisma migrate dev --name b_b8_org_chart` 실행.

> **⚠️ migrate 전 확인**: `cat context/TRACK_A.md`에서 [A] 트랙이 미완료 migrate가 있는지 확인. 있으면 A 트랙 migrate 완료 후 진행.

```prisma
model OrgRestructurePlan {
  id              String   @id @default(uuid()) @db.Uuid
  companyId       String   @db.Uuid
  company         Company  @relation(fields: [companyId], references: [id])
  title           String   @db.VarChar(200)      // "2025 2분기 조직 개편안"
  description     String?  @db.Text
  effectiveDate   DateTime @db.Date              // 적용 예정일
  status          String   @default("draft") @db.VarChar(20) // 'draft' | 'review' | 'approved' | 'applied' | 'cancelled'
  changes         Json                           // 변경 사항 배열
  createdBy       String   @db.Uuid
  approvedBy      String?  @db.Uuid
  approvedAt      DateTime?
  appliedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("org_restructure_plans")
}

// changes JSON 구조:
// [
//   { "type": "create", "department": { name, parentId, headId } },
//   { "type": "move", "departmentId": "uuid", "newParentId": "uuid" },
//   { "type": "merge", "sourceIds": ["uuid", "uuid"], "targetId": "uuid", "targetName": "..." },
//   { "type": "rename", "departmentId": "uuid", "newName": "..." },
//   { "type": "close", "departmentId": "uuid", "transferTo": "uuid" },
//   { "type": "transfer_employee", "employeeId": "uuid", "fromDeptId": "uuid", "toDeptId": "uuid" }
// ]
```

### Task 2: 인터랙티브 조직도 시각화

**라우트**: `/organization/chart`

**트리 차트 구현**:
- **D3.js** 또는 **순수 CSS+React**로 트리 노드 렌더링
- 노드 = 부서 카드 (부서명, 부서장명, 인원수, 법인 뱃지)
- 노드 간 연결선 (부모-자식)
- 줌 인/아웃 + 패닝 (큰 조직도 탐색)
- 노드 클릭 → 부서 상세 사이드패널

**트리 노드 디자인**:
```
┌─────────────────────┐
│ 🏢 기술연구소        │
│ 정OO (소장)         │
│ 👥 27명             │
│ CTR-KR              │
└─────────────────────┘
     ├──────┤
┌────┴───┐ ┌┴────────┐
│선행연구  │ │제품개발   │
│12명     │ │15명      │
└────────┘ └─────────┘
```

**부서 클릭 → 사이드패널**:
```
┌──────────────────────────────┐
│ 기술연구소                     │
│ 부서장: 정OO (소장)            │
│ 상위 부서: CTR-KR (법인)       │
│ 인원: 27명 (직속 0 + 하위 27)  │
│ 하위 부서: 선행연구(12), 제품개발(15) │
│                              │
│ 구성원 목록                    │
│ ├── 정OO (소장)               │
│ ├── 선행연구팀 (12명)          │
│ │   ├── 김OO (팀장)           │
│ │   └── ...                  │
│ └── 제품개발팀 (15명)          │
│     ├── 박OO (팀장)           │
│     └── ...                  │
│                              │
│ [직원 상세] [부서 편집]         │
└──────────────────────────────┘
```

### Task 3: 뷰 모드 전환 + 필터

**상단 컨트롤 바**:
```
┌─────────────────────────────────────────────────────┐
│ 법인: [CTR-KR ▼]  뷰: [🌳트리] [📋리스트] [⊞그리드]  │
│ 검색: [부서/직원 검색...🔍]                            │
│ 시점: [2025-03-01 📅] ← EffectiveDatePicker          │
│ [조직 개편]                                           │
└─────────────────────────────────────────────────────┘
```

**리스트 뷰**: 아코디언 형태로 부서 계층 표시 — 접기/펼치기
**그리드 뷰**: 부서 카드 그리드 — 인원수 크기에 따라 카드 크기 변경

**검색**: 부서명/직원명으로 검색 → 해당 노드 하이라이트 + 경로 자동 펼침

**EffectiveDatePicker 연동**: 
- 과거 시점 선택 → 해당 시점의 조직도 표시 (Effective Dating 쿼리)
- 미래 시점 선택 → 예정된 조직 개편이 반영된 조직도 표시

### Task 4: 조직 개편 워크플로

**조직 개편 편집기**:
```
┌─────────────────────────────────────────────────────┐
│ 조직 개편 — 2025 2분기 조직 개편안     [초안]         │
│ 적용 예정일: [2025-04-01]                             │
├─────────────────────────────────────────────────────┤
│ [현재 조직도]          [개편 후 조직도 (초안)]          │
│ (좌측 패널)            (우측 패널 — 편집 가능)          │
│                                                     │
│ 변경 사항:                                           │
│ ├── ✏️ 생산본부 → 생산기술본부 (이름 변경)              │
│ ├── 🆕 DX팀 신설 (기술연구소 산하)                     │
│ ├── ➡️ 품질관리팀: 생산본부 → 경영지원본부 (이동)       │
│ ├── 🔀 국내영업+해외영업 → 글로벌영업팀 (합병)          │
│ └── 👤 김과장: 제품개발팀 → DX팀 (인원 이동)           │
│                                                     │
│ [+ 변경 추가]  [변경 취소]  [미리보기]  [검토 요청]     │
└─────────────────────────────────────────────────────┘
```

**지원하는 변경 유형 6가지**:
1. **신설 (create)**: 새 부서 추가 — 이름, 상위부서, 부서장 지정
2. **이동 (move)**: 기존 부서의 상위부서 변경
3. **합병 (merge)**: 2개 이상 부서를 1개로 통합 — 인원 자동 이동
4. **이름변경 (rename)**: 부서명 변경
5. **폐지 (close)**: 부서 폐지 — 잔여 인원 이동처 지정 필수
6. **인원이동 (transfer_employee)**: 특정 직원 부서 이동

### Task 5: 변경사항 비교(Diff) 뷰

조직 개편 "미리보기" 시 현재 vs 개편 후를 시각적으로 비교.

```
┌─────────────────────────────────────────────────────┐
│ 변경 영향도 분석                                      │
├─────────────────────────────────────────────────────┤
│ 영향 부서: 6개 | 영향 인원: 32명                      │
│                                                     │
│ 부서 변경                인원 변동                     │
│ ┌───────────────────┐   ┌──────────────────────┐    │
│ │ +1 신설 (DX팀)     │   │ 품질관리팀 → 경영지원  │    │
│ │ -2 합병 (영업)     │   │  10명 이동            │    │
│ │ ~1 이동 (품질)     │   │ 영업1+2 → 글로벌영업  │    │
│ │ ~1 이름변경 (생산)  │   │  14명 재배치          │    │
│ └───────────────────┘   │ DX팀 신설            │    │
│                         │  8명 전입             │    │
│                         └──────────────────────┘    │
│                                                     │
│ [현재 트리]    →    [개편 후 트리]                     │
│ (변경된 노드 하이라이트 — 신설:초록, 이동:파랑, 폐지:빨강) │
└─────────────────────────────────────────────────────┘
```

### Task 6: 확정 → Effective Dating 반영

개편 확정 시 A2의 Effective Dating 체계에 따라 데이터를 업데이트합니다.

```typescript
async function applyRestructurePlan(planId: string) {
  const plan = await prisma.orgRestructurePlan.findUnique({ where: { id: planId } });
  
  for (const change of plan.changes as OrgChange[]) {
    switch (change.type) {
      case 'create':
        await prisma.department.create({
          data: { ...change.department, effectiveFrom: plan.effectiveDate }
        });
        break;
        
      case 'move':
        await closeDepartmentAssignment(change.departmentId, plan.effectiveDate);
        await createDepartmentAssignment(change.departmentId, change.newParentId, plan.effectiveDate);
        break;
        
      case 'merge':
        for (const sourceId of change.sourceIds) {
          await transferAllEmployees(sourceId, change.targetId, plan.effectiveDate);
          await closeDepartment(sourceId, plan.effectiveDate);
        }
        break;
        
      case 'close':
        await transferAllEmployees(change.departmentId, change.transferTo, plan.effectiveDate);
        await closeDepartment(change.departmentId, plan.effectiveDate);
        break;
        
      case 'transfer_employee':
        await createEmployeeAssignment(change.employeeId, change.toDeptId, plan.effectiveDate);
        break;
    }
  }
  
  await prisma.orgRestructurePlan.update({
    where: { id: planId },
    data: { status: 'applied', appliedAt: new Date() }
  });
}
```

### Task 7: 검증

```bash
# 1. 조직도 시각화
#    - 트리 차트 렌더링 (3단계 이상 계층)
#    - 줌/패닝 동작
#    - 노드 클릭 → 사이드패널

# 2. 뷰 모드 전환
#    - 트리 → 리스트 → 그리드

# 3. 법인 전환
#    - CTR-KR → CTR-US 전환 시 조직도 변경

# 4. EffectiveDatePicker
#    - 과거 시점 조회 → 해당 시점 조직도

# 5. 조직 개편
#    - 6가지 변경 유형 동작
#    - Diff 비교 뷰
#    - 확정 → departments/assignments 업데이트

# 6. 검색
#    - 부서명/직원명 검색 → 하이라이트

# 7. [A] 트랙과의 충돌 확인
#    - TRACK_A.md 확인하여 겹치는 테이블/라우트 없는지 검증

npx tsc --noEmit
npm run build
# context/TRACK_B.md 업데이트 (SHARED.md, TRACK_A.md 수정 금지)
```

---

## 산출물 체크리스트

- [ ] Prisma 모델 1개 (OrgRestructurePlan)
- [ ] 인터랙티브 조직도: 트리 차트 (줌/패닝/클릭) + 부서 사이드패널
- [ ] 3가지 뷰 모드 (트리/리스트/그리드) 전환
- [ ] 법인별 조직도 + 검색 + EffectiveDatePicker 시점 조회
- [ ] 조직 개편 편집기: 6가지 변경 유형
- [ ] Diff 비교 뷰 (영향도 분석)
- [ ] 확정 → Effective Dating 반영
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] **context/TRACK_B.md 업데이트** (아래 내용 기록)

---

## context/TRACK_B.md 업데이트 내용 (세션 종료 시)

```markdown
## B8-1 완료 (날짜)

### DB 테이블
- org_restructure_plans
- migrate 이름: b_b8_org_chart

### 주요 컴포넌트
- OrgChart (트리 차트) — D3.js 또는 CSS 기반
- OrgTreeNode — 부서 노드 카드
- RestructureEditor — 개편 편집기
- RestructureDiffView — 변경 비교

### [A] 트랙 참고사항
- 이 세션의 테이블은 [A] 트랙과 독립적 (충돌 없음)
- departments/positions 테이블은 읽기만 사용 (A2 공유 인프라)

### 다음 세션 주의사항 (B 트랙)
- B8-2: People Directory에서 부서 필터 시 departments 쿼리 참조
- B8-3: 스킬 매트릭스에서 부서별 스킬 분포 표시 시 조직도 연동
- B10-1: 조직 변경 이력 → 조직 건강도 지표
```

---

## 주의사항

1. **D3.js vs 순수 React** — 트리 차트를 D3.js로 그리면 줌/패닝이 편하지만, React state와 동기화가 복잡합니다. **큰 조직(100+ 부서)이 아니라면 CSS Flexbox/Grid + React state로 먼저 구현**하고, 성능이 문제되면 D3로 전환하세요.

2. **조직 개편 확정은 되돌리기 어려움** — `status='applied'` 후에는 departments와 assignments에 이미 반영되었으므로 rollback이 복잡합니다. 확정 전 "되돌릴 수 없습니다" 경고를 표시하세요.

3. **합병(merge) 시 하위부서 처리** — 부서 A와 B를 합병할 때, A/B 각각의 하위부서는 어떻게 할지 선택해야 합니다. "하위부서도 합병 대상에 포함" 또는 "하위부서는 통합 부서 아래로 이동" 옵션을 제공하세요.

4. **EffectiveDatePicker로 미래 시점 조회** — 확정된 조직 개편의 effectiveDate가 미래이면, 해당 날짜 이후 시점을 조회하면 개편 후 조직도가 표시되어야 합니다.

5. **조직도 인쇄/내보내기** — 경영진이 조직도를 프린트하거나 PPT에 넣을 수 있도록 PNG/PDF 내보내기 기능을 고려하세요. 이번 세션에서는 선택사항이지만, `html2canvas` + PDF 변환으로 간단히 추가 가능합니다.

6. **migrate 이름에 `b_` 접두사 필수** — [A] 트랙과의 migrate lock 충돌을 방지합니다.
