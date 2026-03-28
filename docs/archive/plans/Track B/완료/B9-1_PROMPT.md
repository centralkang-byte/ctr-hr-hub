# B9-1: 학습/교육 관리 (LMS Lite)

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A + B3-1(역량 프레임워크) + B8-3(스킬 갭 분석) 완료.
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
npx prisma migrate dev --name b_b9_lms_lite
```

---

## 세션 목표

B8-3에서 도출된 스킬 갭을 **교육 과정으로 연결**하여 역량 개발을 체계화합니다. 풀 LMS가 아닌 **LMS Lite** — 과정 카탈로그 관리, 수강 등록/이수 추적, 스킬 갭 기반 추천, 법정 의무교육 관리에 집중합니다.

**핵심**: 실제 교육 콘텐츠(영상/퀴즈)를 호스팅하는 것이 아니라, **교육 이력 + 과정 매핑 + 이수 관리**를 다룹니다.

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. 컨텍스트 파일 3개 읽기
cat context/SHARED.md
cat context/TRACK_A.md
cat context/TRACK_B.md

# 2. B3-1 competencies 테이블 확인 (TRACK_A.md에서)
# ⚠️ B3-1은 [A] 트랙 — TRACK_A.md에서 결과 확인
# - 과정을 역량과 연결하기 위해

# 3. B8-3 employee_skill_assessments 확인 (TRACK_B.md에서)
# - 스킬 갭 데이터로 과정 추천

# 4. B5 온보딩 체크리스트에 "필수 교육" 항목이 있는지 확인 (TRACK_B.md에서)
# ⚠️ B5는 [B] 트랙 — TRACK_B.md에서 결과 확인
# - 온보딩 ↔ 교육 연동 포인트

# 5. [A] 트랙 상태 확인 — TRACK_A.md에서 DB 변경사항 확인
# A 트랙이 migrate를 실행했다면 먼저 pull 후 시작
npx prisma db pull  # 필요 시
```

---

## 핵심 설계 원칙

### 1. 교육 과정 = 역량 연결

```
[과정]                        [역량]
PLC 기초과정         →  PLC 프로그래밍 (레벨 1→2 향상 기대)
용접 심화 OJT        →  용접 기술 (레벨 3→4)
리더십 워크숍         →  전략적 사고, 팀 빌딩
산업안전보건교육 (법정) →  (역량 무관, 법정 의무)
```

### 2. 3가지 교육 유형

| 유형 | 설명 | 추적 방식 |
|------|------|----------|
| **법정 의무** | 산업안전보건, 성희롱예방, 개인정보보호 | 이수 여부 + 유효기간(매년 갱신) |
| **직무 필수** | 직급/직무별 필수 교육 | 이수 여부 + 역량 레벨 반영 |
| **자기 개발** | 직원 선택 수강 | 이수 여부 |

### 3. 스킬 갭 → 자동 추천

```
김사원: PLC 갭 -1 (기대 2, 실제 1)
  → 추천: "PLC 기초과정" (레벨 1→2 대상)
  → 매니저 승인 → 수강 등록
```

---

## 작업 순서 (7 Tasks)

### Task 1: DB 마이그레이션

`prisma/schema.prisma`에 추가 후 `npx prisma migrate dev --name b_b9_lms_lite` 실행.

> **⚠️ migrate 전 확인**: `cat context/TRACK_A.md`에서 [A] 트랙이 미완료 migrate가 있는지 확인. 있으면 A 트랙 migrate 완료 후 진행.

```prisma
model Course {
  id              String   @id @default(uuid()) @db.Uuid
  companyId       String?  @db.Uuid               // NULL = 전사 공통
  company         Company? @relation(fields: [companyId], references: [id])
  code            String   @db.VarChar(30)
  title           String   @db.VarChar(200)
  titleEn         String?  @db.VarChar(200)
  description     String?  @db.Text
  category        String   @db.VarChar(30)         // 'mandatory' | 'job_required' | 'self_development'
  format          String   @db.VarChar(20)         // 'online' | 'offline' | 'blended' | 'ojt'
  provider        String?  @db.VarChar(100)        // 교육기관명
  durationHours   Float?                           // 교육 시간
  validityMonths  Int?                             // 유효기간 (법정교육: 12개월 등)
  targetJobLevels String[] @default([])            // 대상 직급 ["S1","S2"]
  linkedCompetencyIds String[] @default([])        // 연결된 역량 ID
  expectedLevelGain Int?                           // 이수 시 기대 레벨 향상 (1)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  enrollments     CourseEnrollment[]

  @@unique([companyId, code])
  @@map("courses")
}

model CourseEnrollment {
  id              String   @id @default(uuid()) @db.Uuid
  courseId         String   @db.Uuid
  course          Course   @relation(fields: [courseId], references: [id])
  employeeId      String   @db.Uuid
  enrolledAt      DateTime @default(now())
  source          String   @default("manual") @db.VarChar(20) // 'manual' | 'gap_recommendation' | 'mandatory_auto' | 'onboarding'
  status          String   @default("enrolled") @db.VarChar(20) // 'enrolled' | 'in_progress' | 'completed' | 'failed' | 'expired' | 'cancelled'
  startDate       DateTime? @db.Date
  completedAt     DateTime?
  expiresAt       DateTime?                        // 법정교육 유효기간 만료일
  score           Float?                           // 이수 점수 (있으면)
  certificatePath String?  @db.VarChar(500)        // 수료증 파일 경로
  notes           String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([employeeId, status])
  @@map("course_enrollments")
}

model MandatoryTrainingConfig {
  id              String   @id @default(uuid()) @db.Uuid
  companyId       String?  @db.Uuid
  company         Company? @relation(fields: [companyId], references: [id])
  courseId         String   @db.Uuid
  targetGroup     String   @db.VarChar(30)         // 'all' | 'manager' | 'new_hire' | 'production'
  frequency       String   @db.VarChar(20)         // 'annual' | 'biennial' | 'once'
  deadlineMonth   Int?                             // 이수 마감 월 (연간: 12 = 12월까지)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())

  @@map("mandatory_training_configs")
}
```

### Task 2: 과정 카탈로그 관리 (Admin)

**라우트**: `/settings/training` (설정) + `/hr/training` (관리)

```
┌─────────────────────────────────────────────────┐
│ 교육 과정 관리                    [+ 과정 추가]   │
│ [법정의무(3)] [직무필수(8)] [자기개발(12)]         │
├─────────────────────────────────────────────────┤
│ 법정 의무교육                                    │
│ ┌─────────────────────────────────────────┐     │
│ │ SAF-001 산업안전보건교육 | 오프라인 | 4h    │     │
│ │ 대상: 전 직원 | 주기: 매년 | 유효: 12개월   │     │
│ │ 연결 역량: 없음                           │     │
│ │ [편집] [이수현황]                          │     │
│ ├─────────────────────────────────────────┤     │
│ │ HAR-001 성희롱예방교육 | 온라인 | 1h       │     │
│ │ 대상: 전 직원 | 주기: 매년                 │     │
│ ├─────────────────────────────────────────┤     │
│ │ PRI-001 개인정보보호교육 | 온라인 | 2h     │     │
│ └─────────────────────────────────────────┘     │
│                                                 │
│ 직무 필수교육                                    │
│ ┌─────────────────────────────────────────┐     │
│ │ PLC-101 PLC 기초과정 | 오프라인 | 16h      │     │
│ │ 대상: S1~S2 | 연결 역량: PLC 프로그래밍     │     │
│ │ 이수 시 레벨 +1 기대                      │     │
│ └─────────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

### Task 3: 법정 의무교육 자동 등록 + 만료 관리

```typescript
async function enrollMandatoryTraining(companyId: string, year: number) {
  const configs = await prisma.mandatoryTrainingConfig.findMany({
    where: { OR: [{ companyId }, { companyId: null }], isActive: true }
  });
  
  for (const config of configs) {
    const employees = await getTargetEmployees(companyId, config.targetGroup);
    
    for (const emp of employees) {
      const existing = await prisma.courseEnrollment.findFirst({
        where: {
          courseId: config.courseId,
          employeeId: emp.id,
          status: 'completed',
          expiresAt: { gt: new Date() }
        }
      });
      
      if (!existing) {
        await prisma.courseEnrollment.create({
          data: {
            courseId: config.courseId,
            employeeId: emp.id,
            source: 'mandatory_auto',
            expiresAt: new Date(year, (config.deadlineMonth || 12) - 1, 31),
          }
        });
      }
    }
  }
}
```

**만료 알림**: 유효기간 30일 전 직원+HR에게 알림

**이수현황 대시보드**:
```
┌─────────────────────────────────────────────────┐
│ 법정교육 이수현황 — 2025년                        │
├─────────────────────────────────────────────────┤
│ 산업안전보건  이수 128/153 (84%)  마감: 12/31     │
│ [████████████████░░░]  ⚠️ 미이수 25명 [독촉]     │
│                                                 │
│ 성희롱예방    이수 145/153 (95%)  마감: 12/31     │
│ [██████████████████░]                            │
│                                                 │
│ 개인정보보호  이수 150/153 (98%)  마감: 12/31     │
│ [███████████████████]                            │
└─────────────────────────────────────────────────┘
```

### Task 4: 스킬 갭 기반 과정 추천

B8-3 스킬 갭 데이터 → 과정 자동 추천.

```typescript
async function recommendCourses(employeeId: string): Promise<CourseRecommendation[]> {
  const gaps = await getSkillGaps(employeeId);
  
  const recommendations = [];
  for (const gap of gaps) {
    const courses = await prisma.course.findMany({
      where: {
        linkedCompetencyIds: { has: gap.competencyId },
        isActive: true
      }
    });
    
    const uncompletedCourses = await filterUncompleted(courses, employeeId);
    
    recommendations.push({
      competency: gap.competencyName,
      gap: gap.expectedLevel - gap.currentLevel,
      courses: uncompletedCourses,
      priority: gap.expectedLevel - gap.currentLevel
    });
  }
  
  return recommendations.sort((a, b) => b.priority - a.priority);
}
```

**직원 뷰** (`/my/training`):
```
┌─────────────────────────────────────────────────┐
│ 나의 교육                                        │
├─────────────────────────────────────────────────┤
│ ⚠️ 필수 미이수 (2건)                             │
│ ├── 산업안전보건교육 — 마감 12/31 [수강 등록]      │
│ └── PLC 기초과정 — 직무 필수 [수강 등록]           │
│                                                 │
│ 💡 추천 과정 (스킬 갭 기반)                        │
│ ├── PLC 기초과정 — PLC 갭 -1 해소 (우선순위 1)     │
│ └── 용접 심화 OJT — 용접 갭 -1 해소               │
│                                                 │
│ 📋 이수 이력                                     │
│ ├── ✅ 성희롱예방교육 (2025.02) 만료: 2026.02     │
│ ├── ✅ 개인정보보호 (2025.01) 만료: 2026.01       │
│ └── ✅ 신입사원 OJT (2024.10)                    │
│                                                 │
│ [전체 과정 카탈로그]                               │
└─────────────────────────────────────────────────┘
```

### Task 5: 이수 등록 + 완료 처리

**수강 등록 플로우**:
1. 직원이 과정 선택 → "수강 등록" 클릭
2. 법정/직무필수: 자동 승인
3. 자기개발: 매니저 승인 (비용이 발생하면)
4. 등록 완료 → status='enrolled'

**이수 완료 처리**:
1. HR/교육담당이 "이수 완료" 처리 (수료증 업로드)
2. 또는 직원이 수료증 업로드 → HR 확인
3. status='completed', completedAt 기록
4. 법정교육: expiresAt 자동 설정 (completedAt + validityMonths)

### Task 6: 시드 데이터

**법정 의무교육 3개**:
- SAF-001: 산업안전보건교육 (전 직원, 매년, 오프라인, 4h)
- HAR-001: 성희롱예방교육 (전 직원, 매년, 온라인, 1h)
- PRI-001: 개인정보보호교육 (전 직원, 매년, 온라인, 2h)

**직무 필수 4~5개**: PLC 기초, 용접 심화, 품질관리 기초, 사출성형 입문, 리더십 워크숍

**자기개발 3~4개**: 비즈니스 영어, 엑셀 고급, 프로젝트 관리, 데이터 분석 기초

### Task 7: 검증

```bash
# 1. 과정 카탈로그 CRUD
# 2. 법정교육 자동 등록 + 만료 관리
# 3. 스킬 갭 기반 추천 (B8-3 데이터 연동)
# 4. 이수 등록 → 완료 처리
# 5. 직원 뷰 (/my/training) 표시

# 6. [A] 트랙과의 충돌 확인
#    - TRACK_A.md 확인하여 겹치는 테이블/라우트 없는지 검증
#    - B3-1(A트랙) competencies 테이블 참조 확인

npx tsc --noEmit
npm run build
# context/TRACK_B.md 업데이트 (SHARED.md, TRACK_A.md 수정 금지)
```

---

## 산출물 체크리스트

- [ ] Prisma 모델 3개 (Course, CourseEnrollment, MandatoryTrainingConfig)
- [ ] 과정 카탈로그 Admin UI
- [ ] 법정 의무교육 자동 등록 + 만료 알림 + 이수현황 대시보드
- [ ] 스킬 갭 기반 과정 추천 로직 + UI
- [ ] 직원용 /my/training (필수 미이수 + 추천 + 이수이력)
- [ ] 이수 등록 + 완료 처리 플로우
- [ ] 시드 (법정3 + 직무필수5 + 자기개발4)
- [ ] `npx tsc --noEmit` = 0 errors, `npm run build` 성공
- [ ] **context/TRACK_B.md 업데이트** (아래 내용 기록)

---

## context/TRACK_B.md 업데이트 내용 (세션 종료 시)

```markdown
## B9-1 완료 (날짜)

### DB 테이블
- courses, course_enrollments, mandatory_training_configs
- migrate 이름: b_b9_lms_lite

### [A] 트랙 참고사항
- courses.linkedCompetencyIds가 B3-1(A트랙) competencies 테이블 참조
- 이 세션의 테이블은 [A] 트랙과 독립적 (충돌 없음)

### 다음 세션 주의사항 (B 트랙)
- B5: 온보딩 체크리스트의 "필수 교육" 항목과 course_enrollments 연동 가능
- B10-1: 교육 이수율 → HR KPI
- B10-2: 법정교육 미이수율 → 컴플라이언스 위젯
- B11: 알림 — 법정교육 마감 임박, 유효기간 만료 30일 전
```

---

## 주의사항

1. **LMS Lite = 이력 관리 + 추천** — 교육 콘텐츠(영상, 퀴즈, SCORM)를 직접 호스팅하지 않습니다. 외부 LMS(고용노동부 사이버교육, 사내 LMS)에서 이수한 결과를 기록합니다.

2. **법정 의무교육은 법인별로 다름** — 한국: 산업안전/성희롱예방/개인정보보호. 미국: OSHA Safety/Sexual Harassment/Data Privacy. `MandatoryTrainingConfig`에 companyId로 법인별 관리.

3. **이수 완료 시 역량 레벨 자동 업데이트는 하지 않음** — 과정 이수가 자동으로 `employee_skill_assessments.finalLevel`을 올리지는 않습니다. 다음 역량 평가 시 매니저가 반영합니다. 단, "이 과정을 이수했으므로 레벨 재평가를 추천합니다" 알림은 가능.

4. **수료증 파일 보안** — `certificatePath`는 Supabase Storage에 저장. 해당 직원 + HR만 접근 가능.

5. **migrate 이름에 `b_` 접두사 필수** — [A] 트랙과의 migrate lock 충돌을 방지합니다. 두 트랙이 동시에 migrate를 돌리면 안 됩니다.
