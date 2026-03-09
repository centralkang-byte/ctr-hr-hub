# B4: 채용 ATS 고도화

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A(A2 Position 모델) 완료 상태. STEP 5(기존 ATS 8단계 파이프라인 + AI 스크리닝) 존재.

### DB 접근 규칙 (전 세션 공통)

- 모든 테이블 생성/변경은 `prisma/schema.prisma` → `prisma migrate dev`
- 쿼리는 Prisma Client 사용
- Supabase는 Auth + Storage + Realtime 용도만

---

## 세션 목표

STEP 5에서 구축한 기본 ATS(8단계 파이프라인 + AI 스크리닝)를 **기업급 채용 관리 시스템**으로 고도화합니다. 채용 요청(Requisition) 워크플로, Internal Mobility, Talent Pool, 후보자 히스토리, 중복 감지를 추가하고 A2 Position 모델과 연결합니다.

**핵심**: 이 세션은 STEP 5 기존 ATS를 **파괴하지 않고 확장**합니다.

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. context.md 읽기
cat CONTEXT.md

# 2. STEP 5 ATS 현재 상태 확인
# - 채용 공고(job_postings) 테이블 구조
# - 지원자(applications/candidates) 테이블 구조
# - 8단계 파이프라인: 어떤 stage 값들을 사용하는지
# - AI 스크리닝 기능: 어떤 API/모델을 사용하는지
# - 라우트: /recruitment, /jobs 등 어디에 있는지

# 3. A2 Position 모델 확인
# - positions 테이블 존재 여부 + 스키마
# - 현재 공석(vacant) Position 조회 가능 여부

# 4. B1 approval_flows 확인
# - module='recruitment' 인 승인 플로우 시드 존재 여부
# - ApprovalFlowStep 구조

# 5. B2 AssignmentTimeline 컴포넌트 경로 확인
# - import 경로: 'components/shared/AssignmentTimeline'
```

### ⚠️ STEP 5에서 잘못됐을 수 있는 부분

1. **Position 연결 없음** — STEP 5에서 채용 공고가 Position과 연결되지 않았을 가능성 높음. 공고 생성 시 Position 선택 또는 신규 Position 생성 플로우 필요.

2. **법인 구분 없는 단일 채용** — STEP 5가 한국법인 기준으로만 만들어져 있을 수 있음. 법인별 공고/지원자 필터 필요.

3. **불합격 후보자 데이터 유실** — STEP 5에서 "불합격" 처리 시 지원자 데이터가 soft delete 없이 상태만 변경될 수 있음. Talent Pool로 이관하려면 데이터 보존 확인 필요.

4. **채용 요청(Requisition) 프로세스 부재** — STEP 5는 HR이 바로 공고를 올리는 구조일 수 있음. 부서장 요청 → 결재 → 공고 생성 플로우가 없을 수 있음.

---

## 핵심 설계 원칙

### 1. Requisition → Position → Posting 플로우

```
부서장: "개발팀 사원 1명 필요"
    ↓ [채용 요청서 작성]
Requisition (채용 요청)
    ↓ [결재: 팀장→부서장→HR→대표 (B1 approval_flows)]
    ↓ [승인 완료]
Position (A2) 공석 연결 또는 신규 Position 생성
    ↓
Job Posting (채용 공고) 자동 초안 생성
    ↓ [HR 검토/수정 → 공고 게시]
기존 STEP 5 ATS 파이프라인 진행
```

### 2. Talent Pool = 장기 자산

불합격/보류 후보자는 버리는 게 아니라 **Talent Pool에 축적**합니다:
- 2년 자동 만료 (GDPR/개인정보 보호)
- 신규 공고 등록 시 풀 내 매칭 후보 자동 추천
- 후보자 동의 기반 관리

### 3. Internal Mobility = 사내 공석 공개

직원이 다른 부서/법인의 공석에 지원할 수 있는 체계:
- 법인 간 이동도 가능 (Cross-boarding은 B5에서 처리)
- 매니저에게 알림 없이 지원 가능 (비밀 보장) vs 매니저 승인 필요 → 법인별 설정

---

## 작업 순서 (9 Tasks)

### Task 1: DB 마이그레이션 — Prisma 모델 추가

`prisma/schema.prisma`에 추가 후 `npx prisma migrate dev --name b4_ats_enhancement` 실행.

```prisma
model Requisition {
  id              String   @id @default(uuid()) @db.Uuid
  companyId       String   @db.Uuid
  company         Company  @relation(fields: [companyId], references: [id])
  departmentId    String   @db.Uuid
  requesterId     String   @db.Uuid          // 요청 부서장/매니저
  positionId      String?  @db.Uuid          // 기존 Position 연결 (NULL = 신규)
  title           String   @db.VarChar(200)   // 채용 직무명
  headcount       Int      @default(1)
  jobLevel        String?  @db.VarChar(20)    // 요청 직급
  employmentType  String   @db.VarChar(30)    // 'permanent' | 'contract' | 'intern'
  justification   String   @db.Text           // 채용 사유
  requirements    Json?                       // 우대사항, 필수역량 등 구조화 데이터
  urgency         String   @default("normal") @db.VarChar(20) // 'urgent' | 'normal' | 'low'
  targetDate      DateTime? @db.Date          // 희망 입사일
  status          String   @default("draft") @db.VarChar(20) // 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'filled'
  approvalFlowId  String?  @db.Uuid          // B1 approval_flows 참조
  jobPostingId    String?  @db.Uuid          // 승인 후 생성된 공고 연결
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  approvalRecords RequisitionApproval[]

  @@map("requisitions")
}

model RequisitionApproval {
  id              String      @id @default(uuid()) @db.Uuid
  requisitionId   String      @db.Uuid
  requisition     Requisition @relation(fields: [requisitionId], references: [id], onDelete: Cascade)
  stepOrder       Int
  approverId      String      @db.Uuid
  approverRole    String      @db.VarChar(50)
  status          String      @default("pending") @db.VarChar(20) // 'pending' | 'approved' | 'rejected'
  comment         String?     @db.Text
  decidedAt       DateTime?
  createdAt       DateTime    @default(now())

  @@map("requisition_approvals")
}

model TalentPoolEntry {
  id            String   @id @default(uuid()) @db.Uuid
  candidateId   String   @db.Uuid             // 기존 candidates 테이블 참조
  sourcePostingId String? @db.Uuid            // 어떤 공고에서 왔는지
  poolReason    String   @db.VarChar(30)       // 'rejected_qualified' | 'withdrawn' | 'overqualified' | 'manual'
  tags          String[] @default([])          // 스킬/직무 태그
  notes         String?  @db.Text
  consentGiven  Boolean  @default(false)       // 후보자 Talent Pool 동의 여부
  expiresAt     DateTime                       // 기본 2년 후 만료
  status        String   @default("active") @db.VarChar(20)  // 'active' | 'contacted' | 'expired' | 'hired'
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("talent_pool_entries")
}

model CandidateDuplicateLog {
  id            String   @id @default(uuid()) @db.Uuid
  candidateAId  String   @db.Uuid
  candidateBId  String   @db.Uuid
  matchType     String   @db.VarChar(30)       // 'email' | 'phone' | 'name_dob'
  matchScore    Float                          // 0.0 ~ 1.0
  resolution    String?  @db.VarChar(20)       // 'merged' | 'not_duplicate' | 'pending'
  resolvedBy    String?  @db.Uuid
  resolvedAt    DateTime?
  createdAt     DateTime @default(now())

  @@map("candidate_duplicate_logs")
}
```

**기존 테이블 수정 (확인 후 필요 시)**:
- 기존 job_postings/candidates 테이블에 `companyId` 필드 추가 (법인 구분)
- 기존 candidates 테이블에 `talentPoolConsent Boolean @default(false)` 추가
- 기존 job_postings에 `requisitionId String? @db.Uuid` 추가 (채용 요청 연결)
- 기존 job_postings에 `positionId String? @db.Uuid` 추가 (Position 연결)
- 기존 job_postings에 `isInternal Boolean @default(false)` 추가 (사내 공고 구분)

### Task 2: 채용 요청(Requisition) 워크플로

**라우트**: `/recruitment/requisitions` (인사운영 > 채용)

**요청서 작성 폼**:
```
┌─────────────────────────────────────────────────┐
│ 채용 요청서 작성                                   │
├─────────────────────────────────────────────────┤
│ 법인:     [CTR-KR ▼]                             │
│ 부서:     [개발팀 ▼]    (법인에 따라 필터)           │
│ 직무명:   [시니어 백엔드 개발자          ]           │
│ 인원:     [1]                                    │
│ 직급:     [과장(S3) ▼]   (법인 직급체계 반영)        │
│ 고용형태: [○정규 ○계약 ○인턴]                       │
│ 긴급도:   [○긴급 ●보통 ○낮음]                       │
│ 희망입사일: [2025-06-01]                           │
│                                                 │
│ 연결 포지션: [기존 공석 선택 ▼] 또는 [+ 신규 생성]    │
│                                                 │
│ 채용 사유:                                        │
│ [신규 프로젝트 인력 확충. 클라우드 마이그레이션       │
│  프로젝트에 백엔드 시니어 1명 필요.               ]  │
│                                                 │
│ 필수 역량: (B3-1 competencies에서 선택)             │
│ [+ 역량 추가] → 검색 자동완성                       │
│                                                 │
│ 결재선: [2단계: 팀장→HR] (B1 approval_flows 자동)   │
│                                                 │
│ [임시저장]  [결재 요청]                              │
└─────────────────────────────────────────────────┘
```

**결재 프로세스**:
```typescript
// 결재 요청 시 B1 approval_flows 참조
const flow = await getApprovalFlow('recruitment', companyId, requisition.urgency);

// urgency='urgent'이면 4단계(팀장→부서장→HR→대표)
// urgency='normal'이면 2단계(팀장→HR)

// 각 단계별 RequisitionApproval 레코드 생성
// 현재 단계 승인자에게 인앱 알림 + 이메일
```

**승인 완료 후 자동 처리**:
1. Position이 연결되어 있으면 → 해당 Position 상태 업데이트
2. Position이 없으면 → 신규 Position 자동 생성 (A2 positions)
3. Job Posting 초안 자동 생성 (요청서 내용 기반)
4. HR에게 "공고 검토 요청" 알림

### Task 3: 채용 요청 목록 + 승인함

**요청 목록** (`/recruitment/requisitions`):

| 요청번호 | 직무명 | 부서 | 요청자 | 상태 | 긴급도 | 요청일 |
|---------|--------|------|--------|------|--------|-------|
| REQ-001 | 시니어 BE 개발 | 개발팀 | 김팀장 | 결재중 (2/3) | 🟡보통 | 2025.03.01 |
| REQ-002 | QA 엔지니어 | 품질팀 | 이팀장 | 승인 | 🔴긴급 | 2025.02.28 |

**승인함** (HR Admin / 결재자 뷰):
```
나의 결재 대기 (3건)
├── REQ-003: 금형설계 과장 · CTR-KR · 🟡보통
│   요청자: 박부장 | 사유: "퇴직자 대체 충원"
│   [승인] [반려] [코멘트]
├── ...
```

**승인 스테퍼**: 결재 진행 상태를 단계별로 시각화
```
[팀장 ✅] → [부서장 ✅] → [HR ⏳ 현재] → [대표 ⬜]
```

### Task 4: Internal Mobility — 사내 공석 공개

**직원용 라우트**: `/my/internal-jobs` (나의 공간)

```
┌─────────────────────────────────────────────────┐
│ 사내 공석                        [법인: 전체 ▼]    │
├─────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────┐   │
│ │ 시니어 품질 엔지니어 · CTR-VN · 과장(S3)     │   │
│ │ 품질관리부 | 마감: 2025.04.30              │   │
│ │ 매칭 스킬: 품질관리(✅) 영어(✅) 베트남어(❌) │   │
│ │ [상세보기] [지원하기]                       │   │
│ └───────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────┐   │
│ │ PLC 프로그래머 · CTR-MX · 대리(S2)          │   │
│ │ 생산기술부 | 마감: 2025.05.15              │   │
│ │ 매칭 스킬: PLC(✅) 스페인어(❌)             │   │
│ │ [상세보기] [지원하기]                       │   │
│ └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**스킬 매칭 추천**: 직원의 스킬 데이터(B8-3에서 구축 예정)가 있으면 매칭률 표시. 없으면 매칭 섹션 미표시.

**비밀 보장 설정** (법인별 B1 설정):
- `internal_mobility_notify_manager: boolean` — 지원 시 현 매니저에게 알림 여부
- CTR-KR: 알림 없음 (비밀 보장)
- CTR-US: 매니저에게 알림

**지원 후 플로우**:
1. 내부 지원자 별도 트랙으로 기존 ATS 파이프라인 진입
2. 채용 확정 시 → B5 Cross-boarding 트리거 (법인 간 이동인 경우)

### Task 5: Talent Pool

**라우트**: `/recruitment/talent-pool`

**진입 경로**:
1. ATS 파이프라인에서 "불합격" 처리 시 → "Talent Pool 추가" 체크박스
2. "보류" 처리 시 → 자동 Talent Pool 이관
3. HR이 수동으로 외부 후보자 등록

**풀 관리 UI**:
```
┌─────────────────────────────────────────────────┐
│ Talent Pool                    [만료 예정 12명]   │
│ 필터: [직무태그 ▼] [스킬 ▼] [등록일 ▼] [법인 ▼]  │
├─────────────────────────────────────────────────┤
│ 홍길동 · BE개발 · 2024.09 등록 · 만료 2026.09   │
│ 태그: Java, Spring, AWS | 출처: REQ-015 불합격   │
│ 동의: ✅ | [연락] [상세] [삭제]                   │
├─────────────────────────────────────────────────┤
│ Jane Smith · QA · 2024.11 등록 · 만료 2026.11   │
│ 태그: QA, Selenium | 출처: 수동등록              │
│ 동의: ✅ | [연락] [상세] [삭제]                   │
└─────────────────────────────────────────────────┘
```

**자동 매칭**: 신규 공고 게시 시 Talent Pool 검색 → 태그 매칭 후보 자동 추천
```
💡 Talent Pool 매칭 (3명)
├── 홍길동: Java, Spring (태그 2/3 매칭)
├── ...
[후보자에게 연락하기]
```

**2년 만료**: 
- 만료 30일 전 HR에게 알림 ("12명의 Talent Pool 엔트리가 곧 만료됩니다")
- 만료 시 자동 status='expired' (데이터 soft delete, 복구 불가)

### Task 6: 후보자 히스토리 — AssignmentTimeline 재사용

B2에서 만든 `AssignmentTimeline` 컴포넌트를 후보자 히스토리에 재사용합니다.

```typescript
// 후보자의 지원 이력을 TimelineEvent[]로 변환
const candidateEvents: TimelineEvent[] = applications.map(app => ({
  id: app.id,
  date: app.appliedAt,
  type: app.status,  // 'applied' | 'screening' | 'interview' | 'offered' | 'rejected' | 'hired'
  title: app.jobPosting.title,
  description: `${app.jobPosting.company.name} · ${app.stage}`,
  details: {
    postingId: app.jobPostingId,
    interviewNotes: app.interviewNotes,
    screeningScore: app.screeningScore,
  }
}));

// AssignmentTimeline 그대로 사용
<AssignmentTimeline 
  events={candidateEvents} 
  onEventClick={openCandidateDetail} 
/>
```

**표시 위치**: 후보자 상세 페이지 사이드패널 또는 탭

### Task 7: 중복 감지

**트리거**: 새 지원자 등록 시 자동 실행

**감지 로직** (3단계):
```typescript
async function detectDuplicates(candidate: NewCandidate) {
  const duplicates: DuplicateMatch[] = [];
  
  // 1순위: 이메일 완전 일치
  const emailMatch = await prisma.candidate.findFirst({
    where: { email: candidate.email }
  });
  if (emailMatch) duplicates.push({ 
    candidate: emailMatch, matchType: 'email', matchScore: 1.0 
  });
  
  // 2순위: 전화번호 완전 일치
  const phoneMatch = await prisma.candidate.findFirst({
    where: { phone: normalizePhone(candidate.phone) }
  });
  if (phoneMatch) duplicates.push({ 
    candidate: phoneMatch, matchType: 'phone', matchScore: 1.0 
  });
  
  // 3순위: 이름 + 생년월일 일치
  const nameMatch = await prisma.candidate.findMany({
    where: { 
      name: candidate.name,
      birthDate: candidate.birthDate 
    }
  });
  nameMatch.forEach(m => duplicates.push({ 
    candidate: m, matchType: 'name_dob', matchScore: 0.9 
  }));
  
  // 중복 로그 저장
  for (const dup of duplicates) {
    await prisma.candidateDuplicateLog.create({ ... });
  }
  
  return duplicates;
}
```

**UI**: 중복 감지 시 경고 모달
```
⚠️ 중복 후보자 감지

홍길동 (hong@email.com) 이(가) 이미 등록되어 있습니다.
├── 이메일 일치 (100%)
├── 최근 지원: 2024.09 · BE개발 · 불합격
└── Talent Pool: 활성

[기존 후보자로 연결] [새로 등록 (중복 아님)] [취소]
```

### Task 8: A2 Position 연결 강화

기존 STEP 5 ATS와 A2 Position 모델을 연결합니다.

**Position → Posting 연결**:
- 공고 생성 시 Position 선택 필수 (또는 Requisition에서 자동 연결)
- 채용 확정(hired) 시 → Position 상태 'filled'로 업데이트
- Position의 headcount > 현재 filled 수이면 → "추가 채용 필요" 표시

**공석 현황 대시보드** (HR 뷰):
```
공석 현황 요약
├── 전체 공석: 15개 (KR:8 | CN:3 | US:2 | VN:1 | MX:1)
├── 채용 진행 중: 8개
├── 미진행 공석: 7개 ← "채용 요청 생성" 버튼
└── 평균 충원 소요일: 45일
```

### Task 9: 검증

```bash
# 1. 채용 요청 플로우
#    - 요청서 작성 → 결재 요청 → 단계별 승인 → 공고 초안 자동생성
#    - 반려 시 → 요청자에게 코멘트와 함께 반려 알림

# 2. 기존 STEP 5 ATS 미파괴 확인
#    - 8단계 파이프라인 정상 동작
#    - AI 스크리닝 정상 동작
#    - 칸반보드 드래그앤드롭

# 3. Internal Mobility
#    - 직원 뷰: 사내 공석 목록 + 법인 필터
#    - 지원 → ATS 파이프라인 진입

# 4. Talent Pool
#    - 불합격 시 "Talent Pool 추가" → 풀 등록
#    - 신규 공고 시 자동 매칭 추천
#    - 2년 만료 로직

# 5. 중복 감지
#    - 동일 이메일 지원 → 경고 모달
#    - "기존 후보자로 연결" 동작

# 6. Position 연결
#    - 공고 생성 시 Position 선택
#    - hired 시 Position filled 업데이트

npx tsc --noEmit
npm run build
# context.md 업데이트
```

---

## 산출물 체크리스트

- [ ] Prisma 모델 4개 (Requisition, RequisitionApproval, TalentPoolEntry, CandidateDuplicateLog)
- [ ] 기존 job_postings/candidates 테이블 확장 (companyId, positionId, isInternal 등)
- [ ] 채용 요청 워크플로: 작성 폼 + 결재 프로세스 + 공고 자동생성
- [ ] 채용 요청 목록 + 승인함 + 승인 스테퍼
- [ ] Internal Mobility: 사내 공석 목록 + 지원 플로우
- [ ] Talent Pool: 풀 관리 UI + 자동 매칭 + 2년 만료
- [ ] 후보자 히스토리: AssignmentTimeline 재사용
- [ ] 중복 감지: 3단계 로직 + 경고 모달
- [ ] A2 Position 연결: 공석 현황 + hired 시 상태 업데이트
- [ ] 기존 STEP 5 ATS 미파괴 확인
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] context.md 업데이트

---

## context.md 업데이트 내용 (세션 종료 시)

```markdown
## B4 완료 (날짜)

### DB 테이블
- requisitions, requisition_approvals
- talent_pool_entries, candidate_duplicate_logs
- 기존 job_postings 확장 (requisitionId, positionId, isInternal, companyId)
- 기존 candidates 확장 (companyId, talentPoolConsent)

### 주요 라우트
- /recruitment/requisitions — 채용 요청 목록/작성
- /recruitment/talent-pool — Talent Pool 관리
- /my/internal-jobs — 직원용 사내 공석

### 재사용 컴포넌트
- AssignmentTimeline (B2) → 후보자 히스토리에 재사용 확인
- ApprovalFlow 승인 스테퍼 → B6, B9에서도 동일 패턴

### 다음 세션 주의사항
- B5: Internal Mobility에서 법인 간 이동 확정 시 Cross-boarding 트리거 연결
- B8-2: People Directory에서 Internal Mobility 공고 배너 가능
- B8-3: 스킬 데이터 구축 후 Internal Mobility 매칭률 고도화
- B10-1: 채용 리드타임(Requisition→Hired 소요일) → HR KPI 위젯
- B11: 알림 이벤트 등록 — 결재요청, 승인/반려, Talent Pool 만료 등
```

---

## 주의사항

1. **채용 요청 결재선은 B1 `approval_flows` 재사용** — 별도 결재 시스템을 만들지 마세요. `module='recruitment'`인 ApprovalFlow를 조회하고, urgency에 따라 다른 플로우를 적용. RequisitionApproval은 실행 인스턴스(실제 결재 기록)이고, ApprovalFlow는 템플릿입니다.

2. **기존 STEP 5 candidates 테이블 구조를 최소한으로 변경** — 필드 추가는 OK, 기존 필드 변경/삭제는 위험. 기존 파이프라인 로직이 깨질 수 있습니다.

3. **Talent Pool 개인정보 보호** — `consentGiven=false`인 후보자는 Talent Pool UI에 이름만 표시, 연락처 마스킹. GDPR/개인정보보호법 준수를 위해 만료 로직은 반드시 구현하세요.

4. **Internal Mobility와 B5 Cross-boarding 연결 시점** — B4에서는 "사내 지원 → ATS 파이프라인 진입"까지만 구현. 채용 확정 후 Cross-boarding(기존 법인 오프보딩 + 새 법인 온보딩) 트리거는 B5에서 구현합니다. B4에서는 hired 이벤트만 발생시키고, B5에서 이 이벤트를 수신하면 됩니다.

5. **공고 자동 초안 생성은 간단하게** — Requisition 데이터를 기반으로 공고 필드를 채우는 수준. AI 공고 작성은 이미 STEP 5에 있을 수 있으므로 중복 구현하지 마세요. 있으면 재활용, 없으면 필드 매핑만.
