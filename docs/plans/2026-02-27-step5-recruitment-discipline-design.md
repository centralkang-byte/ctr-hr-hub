# STEP5 — 채용 ATS + 징계·상벌 설계서

## 개요
CTR HR Hub STEP5: 채용 ATS 파이프라인 + AI 이력서 분석 + 면접 평가 + 징계·상벌 관리

## 구현 범위

### A. 채용 ATS
1. 채용 공고 CRUD (목록/생성/수정/상세)
2. AI 공고 초안 생성 (generateJobDescription)
3. 지원자 등록 + 이력서 S3 업로드
4. 파이프라인 칸반 보드 (8단계 드래그앤드롭)
5. AI 이력서 분석 (analyzeResume)
6. 면접 일정 + 평가
7. 오퍼 관리
8. 채용 대시보드 (KPI + 퍼널 차트)

### B. 징계 관리
1. 징계 등록 (7유형) + 증빙 S3 업로드
2. 징계 목록/상세
3. 이의신청 UI
4. 징계 상태 머신 (ACTIVE → EXPIRED/OVERTURNED)

### C. 포상 관리
1. 포상 등록 (7유형)
2. 포상 목록/상세
3. CTR 핵심가치상 연동

### D. 역량 라이브러리
1. 역량 CRUD (settings/competencies)

---

## Prisma 스키마 변경

### Enum 추가/변경
```
ApplicationStage: + FINAL (INTERVIEW_2 → FINAL → OFFER)
AiFeature: + JOB_DESCRIPTION_GENERATION, RESUME_ANALYSIS
DisciplinaryCategory: + MISCONDUCT, HARASSMENT, FRAUD (스펙 기준)
RewardType: + CTR_VALUE_AWARD
새 enum WorkMode: OFFICE / REMOTE / HYBRID
새 enum InterviewType: PHONE / VIDEO / ONSITE / PANEL
새 enum InterviewRound: FIRST / SECOND / FINAL
새 enum DisciplinaryStatus: ACTIVE / EXPIRED / OVERTURNED
```

### JobPosting 필드 추가
- preferred String? (우대사항)
- headcount Int @default(1)
- workMode WorkMode?
- recruiterId String? (담당 리크루터 FK → Employee)
- deadlineDate DateTime? (마감일)
- salaryHidden Boolean @default(false)
- requiredCompetencies Json? (역량 태그 ID 배열)

### Application 필드 추가
- offeredSalary Decimal?
- offeredDate DateTime?
- expectedStartDate DateTime?

### Applicant 필드 추가
- portfolioUrl String?
- memo String?

### DisciplinaryAction 필드 추가
- status DisciplinaryStatus @default(ACTIVE)
- validMonths Int? (유효기간)
- expiresAt DateTime? (만료일 — validMonths 기반 계산)
- appealText String? (이의신청 사유)
- demotionGradeId String? (강등 시 변경 직급)
- salaryReductionRate Decimal? (감봉 비율)
- salaryReductionMonths Int? (감봉 기간)

### RewardRecord 필드 추가
- ctrValue String? (CTR_VALUE_AWARD 시 핵심가치)
- serviceYears Int? (LONG_SERVICE 시 근속연수)

### InterviewSchedule 필드 추가
- interviewType InterviewType?
- round InterviewRound?

---

## 페이지 구조

```
(dashboard)/
├── recruitment/
│   ├── page.tsx + RecruitmentListClient.tsx     # 공고 목록
│   ├── new/page.tsx + PostingFormClient.tsx      # 공고 생성
│   ├── [id]/
│   │   ├── page.tsx + PostingDetailClient.tsx    # 공고 상세
│   │   ├── edit/page.tsx + PostingEditClient.tsx # 공고 수정
│   │   ├── applicants/
│   │   │   ├── page.tsx + ApplicantListClient.tsx
│   │   │   └── new/page.tsx + ApplicantFormClient.tsx
│   │   ├── pipeline/
│   │   │   └── page.tsx + PipelineClient.tsx     # 칸반 보드
│   │   └── interviews/
│   │       ├── page.tsx + InterviewListClient.tsx
│   │       └── new/page.tsx + InterviewFormClient.tsx
│   └── dashboard/
│       └── page.tsx + RecruitmentDashboardClient.tsx
├── discipline/
│   ├── page.tsx + DisciplineListClient.tsx       # 징계 목록
│   ├── new/page.tsx + DisciplineFormClient.tsx   # 징계 등록
│   ├── [id]/page.tsx + DisciplineDetailClient.tsx
│   ├── rewards/
│   │   ├── page.tsx + RewardsListClient.tsx      # 포상 목록
│   │   ├── new/page.tsx + RewardFormClient.tsx
│   │   └── [id]/page.tsx + RewardDetailClient.tsx
└── settings/
    └── competencies/
        └── page.tsx + CompetencyListClient.tsx   # 역량 라이브러리
```

## API 구조

```
api/v1/
├── recruitment/
│   ├── postings/route.ts                  # GET + POST
│   ├── postings/[id]/route.ts             # GET + PUT + DELETE
│   ├── postings/[id]/publish/route.ts     # PUT (게시)
│   ├── postings/[id]/close/route.ts       # PUT (마감)
│   ├── postings/[id]/applicants/route.ts  # GET + POST
│   ├── applicants/[id]/route.ts           # GET + PUT
│   ├── applications/[id]/stage/route.ts   # PUT (단계변경)
│   ├── applications/[id]/offer/route.ts   # POST (오퍼)
│   ├── interviews/route.ts               # GET + POST
│   ├── interviews/[id]/route.ts           # GET + PUT + DELETE
│   ├── interviews/[id]/evaluate/route.ts  # POST (평가)
│   └── dashboard/route.ts                # GET (KPI+퍼널)
├── ai/
│   ├── job-description/route.ts           # POST
│   └── resume-analysis/route.ts           # POST
├── competencies/route.ts                  # GET + POST
├── competencies/[id]/route.ts             # GET + PUT + DELETE
├── disciplinary/route.ts                  # GET + POST
├── disciplinary/[id]/route.ts             # GET + PUT
├── disciplinary/[id]/appeal/route.ts      # PUT (이의신청)
├── rewards/route.ts                       # GET + POST
└── rewards/[id]/route.ts                  # GET + PUT + DELETE
```

## AI 함수 (lib/claude.ts)

### generateJobDescription
- input: title, department, grade, category, requirements
- output: { description, qualifications, preferred }
- feature: JOB_DESCRIPTION_GENERATION
- prompt_version: job-description-v1.0

### analyzeResume
- input: resume_text, job_posting info
- output: { overall_score, fit_assessment, strengths, concerns, experience_match, skill_match, culture_fit_indicators, summary }
- feature: RESUME_ANALYSIS
- prompt_version: resume-analysis-v1.0

## 칸반 보드 구현
- HTML5 Drag & Drop API (외부 의존성 없음)
- 8단계 열: APPLIED → SCREENING → INTERVIEW_1 → INTERVIEW_2 → FINAL → OFFER → HIRED → REJECTED
- 카드: 지원자명 + AI 점수 뱃지 + 지원일
- REJECTED 이동 시 사유 입력 모달
- OFFER 이동 시 오퍼 정보 입력 모달

## 디자인 시스템 적용 (CTR_DESIGN_SYSTEM.md 기반)
- 페이지 배경 #FAFAFA, 카드 #FFFFFF, 보더 1px solid #E8E8E8
- CTA #00C853 단색, 호버 #00A844
- 테이블 헤더 12px #999, 본문 14px #333
- 채용 퍼널: .funnel-stage 패턴 (접수 N > 서류평가 N > ...)
- 역량 점수: 좌측 4px 컬러바 (5=초록 ~ 1=빨강)
- 배지: 연한 배경 + 진한 텍스트
- AI 점수: 80+=#00C853, 50~79=#FF9800, <50=#F44336
- Textarea (Rich Text 대체, 향후 Tiptap 교체 가능)

## 구현 순서 (4 Phase)

### Phase 1: Prisma 스키마 + 징계/포상 CRUD
- 스키마 변경 + migration
- 징계 API + UI (목록/등록/상세/이의신청)
- 포상 API + UI (목록/등록/상세)

### Phase 2: 채용 공고 + 역량 라이브러리 + AI
- 역량 라이브러리 CRUD
- 공고 CRUD API + UI
- AI 공고 초안 생성 (generateJobDescription)

### Phase 3: 지원자 + 칸반 + AI 분석
- 지원자 등록/목록 API + UI
- 칸반 파이프라인 (드래그앤드롭)
- AI 이력서 분석 (analyzeResume)
- 오퍼 관리

### Phase 4: 면접 + 대시보드
- 면접 일정/평가 API + UI
- 채용 대시보드 (KPI + 퍼널 차트)
