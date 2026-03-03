# B3-2: Talent Review + AI 평가 리포트 — 설계 문서

> 작성일: 2026-03-02
> 트랙: A
> 선행 완료: B3-1 (역량 프레임워크 + 동적 평가 폼)

---

## 1. 컨텍스트 요약

### 기존 구현 상태 (변경 금지)
| 항목 | 위치 | 상태 |
|------|------|------|
| 9-Block Calibration | `/performance/calibration/CalibrationClient.tsx` | ✅ 동작 중 |
| SuccessionPlan / Candidate | `prisma/schema.prisma` + `/succession/` | ✅ 동작 중 |
| Readiness enum | schema.prisma | ✅ 존재 (READY_NOW/READY_1_2_YEARS/READY_3_PLUS_YEARS) |
| `callClaude()` + AI 함수들 | `src/lib/claude.ts` | ✅ 존재 |
| OneOnOne | schema.prisma | ✅ sentimentTag 없음 |

### 스펙 vs 현실 차이
- `SuccessionCandidate`: 스펙의 `ranking`, `developmentNote` 필드 없음 → 추가
- `OneOnOne`: `sentimentTag` 없음 → 추가
- `AiEvaluationDraft`, `BiasDetectionLog`: 없음 → 신규 생성
- 9-Block: Readiness 오버레이 없음 → 추가
- 편향 감지: 없음 → 신규

---

## 2. DB 변경사항

### 기존 모델 필드 추가

```prisma
// OneOnOne — sentimentTag 추가
model OneOnOne {
  ...
  sentimentTag String? @map("sentiment_tag")  // 'positive'|'neutral'|'negative'|'concerned'
}

// SuccessionCandidate — ranking, developmentNote 추가
model SuccessionCandidate {
  ...
  ranking         Int     @default(0)
  developmentNote String? @db.Text @map("development_note")
}
```

### 신규 모델 2개

```prisma
model AiEvaluationDraft {
  id           String   @id @default(uuid())
  evaluationId String   @map("evaluation_id")
  employeeId   String   @map("employee_id")
  reviewerId   String   @map("reviewer_id")
  draftContent Json     @map("draft_content")
  inputSummary Json     @map("input_summary")
  status       String   @default("draft") @map("status")  // 'draft'|'reviewed'|'applied'|'discarded'
  managerEdits Json?    @map("manager_edits")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("ai_evaluation_drafts")
}

model BiasDetectionLog {
  id              String   @id @default(uuid())
  evaluationCycle String   @map("evaluation_cycle")
  reviewerId      String   @map("reviewer_id")
  companyId       String   @map("company_id")
  biasType        String   @map("bias_type")   // 'central_tendency'|'leniency'|'severity'|'recency'|'tenure'|'gender'
  severity        String   @map("severity")    // 'info'|'warning'|'critical'
  description     String   @db.Text
  details         Json?
  isAcknowledged  Boolean  @default(false) @map("is_acknowledged")
  createdAt       DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id])

  @@map("bias_detection_logs")
}
```

**마이그레이션**: `npx prisma migrate dev --name a_b3_talent_review`

---

## 3. API 라우트

### 신규
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/performance/evaluations/[id]/ai-draft` | AI 평가 초안 생성 |
| GET | `/api/v1/performance/evaluations/[id]/ai-draft` | 초안 조회 |
| PATCH | `/api/v1/performance/evaluations/[id]/ai-draft/[draftId]` | 초안 상태 변경 (applied/discarded) |
| POST | `/api/v1/performance/evaluations/bias-check` | 편향 감지 실행 |
| GET | `/api/v1/performance/evaluations/bias-check` | 편향 로그 조회 |
| GET | `/api/v1/employees/[id]/insights` | 직원 통합 인사이트 (목표+원온원+BEI) |

### 기존 수정
| 경로 | 변경사항 |
|------|----------|
| `PUT /api/v1/succession/plans/[id]/candidates/[candidateId]` | ranking, developmentNote 추가 |
| `POST /api/v1/performance/one-on-one` (있으면) | sentimentTag 수신 |

---

## 4. 컴포넌트

### 신규
| 컴포넌트 | 경로 | 용도 |
|---------|------|------|
| `EmployeeInsightPanel` | `src/components/performance/EmployeeInsightPanel.tsx` | 직원 통합 사이드패널 |
| `AiDraftModal` | `src/components/performance/AiDraftModal.tsx` | AI 초안 생성/표시 모달 |
| `BiasDetectionBanner` | `src/components/performance/BiasDetectionBanner.tsx` | 편향 감지 경고 배너 |
| `/talent/succession/page.tsx` | `src/app/(dashboard)/talent/succession/` | 승계계획 (기존 컴포넌트 재사용) |

### 수정
| 컴포넌트 | 변경사항 |
|---------|----------|
| `CalibrationClient.tsx` | Readiness 뱃지 + 직원 클릭 → EmployeeInsightPanel + BiasDetectionBanner |
| `ManagerEvalClient.tsx` | "AI 초안 생성" 버튼 추가 |
| `OneOnOneDetailClient.tsx` | sentimentTag 선택 UI 추가 |

---

## 5. claude.ts 추가 함수

```typescript
// src/lib/claude.ts 에 추가
export async function generateEvaluationDraft(input: EvalDraftInput, companyId: string, reviewerId: string): Promise<EvalDraftResult>
```

---

## 6. 편향 감지 로직 (규칙 기반, LLM 불필요)

| 편향 유형 | 감지 로직 | 임계값 |
|----------|----------|--------|
| central_tendency | 단일 등급 집중도 | warning: 60%, critical: 80% |
| leniency | 상위 2등급 집중도 | warning: 70%, critical: 85% |
| severity | 하위 2등급 집중도 | warning: 70%, critical: 85% |
| recency | 최근 3개월 원온원 sentimentTag vs 등급 상관 | >0.8 |
| tenure | 재직기간-등급 피어슨 상관 | >0.7 |
| gender | 성별 등급 분포 카이제곱 | p<0.05 |

임계값은 `evaluation_settings` JSONB의 `biasThresholds` 필드로 관리.

---

## 7. 접근 권한

| 기능 | 권한 |
|------|------|
| 승계계획 조회/편집 | HR_ADMIN, SUPER_ADMIN |
| AI 초안 생성 | MANAGER, HR_ADMIN, SUPER_ADMIN |
| 편향 감지 조회 | HR_ADMIN, SUPER_ADMIN |
| 직원 통합 패널 | MANAGER, HR_ADMIN, SUPER_ADMIN |

---

## 8. 구현 순서 (8 Tasks)

1. DB 마이그레이션 (`a_b3_talent_review`)
2. 9-Block 확장 (Readiness 오버레이 + 법인별 축 동적화)
3. `/talent/succession/` 라우트 + 기존 컴포넌트 확장
4. `EmployeeInsightPanel` 신규 컴포넌트
5. AI 초안 생성 (`generateEvaluationDraft` + API + `AiDraftModal`)
6. 편향 감지 (`bias-check` API + `BiasDetectionBanner`)
7. 기존 STEP 6A 연결 (CalibrationClient, ManagerEvalClient, OneOnOne)
8. 검증 (`tsc`, `build`)
