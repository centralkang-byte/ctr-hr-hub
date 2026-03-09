# B8-2: People Directory + Self-Service

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A + B2(직원 프로필) + B8-1(조직도) 완료.

### DB 접근 규칙 (전 세션 공통)

- 모든 테이블 생성/변경은 `prisma/schema.prisma` → `prisma migrate dev`
- 쿼리는 Prisma Client 사용
- Supabase는 Auth + Storage + Realtime 용도만

---

## 세션 목표

전 직원이 동료를 검색하고 프로필을 조회할 수 있는 **People Directory**와, 직원 본인이 개인 정보를 관리하는 **Self-Service 포털**을 구축합니다.

**핵심**: 이 세션은 **직원 관점의 UI**입니다. B2(HR Admin 관점)와 달리, 접근 권한/공개 범위 설정이 핵심입니다.

---

## ⚠️ 시작 전 필수 확인

### 컨텍스트 파일 규칙 (병렬 개발)

```bash
# 읽기: 3개 파일 모두 읽으세요
cat context/SHARED.md       # 공유 인프라 상태 확인
cat context/TRACK_A.md      # A 트랙 상태 참고
cat context/TRACK_B.md      # 이전 B 트랙 작업 확인 (이 세션은 [B] 트랙)

# 쓰기: TRACK_B.md에만 기록하세요
# 이 세션 결과는 context/TRACK_B.md에 기록하세요
# SHARED.md는 수정하지 마세요
```

### 선행 모듈 확인

```bash
# 1. B2 직원 프로필 구조 확인
# - EmployeeProfilePage 라우트 + 탭 구조
# - 어떤 필드가 있는지 (개인정보, 연락처, 소속 등)

# 3. B8-1 조직도 컴포넌트 확인
# - OrgChart 컴포넌트 import 경로
# - 부서 사이드패널 연동 가능 여부

# 4. 기존 "나의 공간" 라우트 구조 확인
# - /my/ 하위에 어떤 페이지가 있는지
# - B6-2 /my/leave, B4 /my/internal-jobs 등

# 5. 프로필 사진 업로드 기능 유무
# - Supabase Storage 사용 여부
```

---

## 핵심 설계 원칙

### 1. People Directory = 사내 전화번호부 + 소셜 프로필

단순 검색을 넘어 동료의 역할/전문성/소속을 한눈에 파악할 수 있는 인터페이스.

### 2. Self-Service = 직원이 HR 없이 스스로 처리

| 직원이 직접 할 수 있는 것 | HR 승인 필요 |
|------------------------|------------|
| 연락처(개인 전화, 이메일) 변경 | 주소 변경 |
| 비상연락처 변경 | 이름 변경 (법적) |
| 프로필 사진 변경 | 계좌 변경 |
| 자기소개/스킬 태그 편집 | — |
| 급여명세서 조회 | — |
| 휴가 잔여 조회 | — |
| 인사 서류 다운로드 | — |

### 3. 공개 범위 = 필드별 4단계

```
public:   전 직원에게 공개 (이름, 부서, 직급, 업무 연락처)
team:     같은 팀(부서) 직원에게만 공개
manager:  직속 매니저 + HR에게만 공개
private:  HR Admin만 열람 (급여, 주민번호 등)
```

---

## 작업 순서 (7 Tasks)

### Task 1: DB 마이그레이션 — Prisma 모델 추가

`prisma/schema.prisma`에 추가 후 `npx prisma migrate dev --name b_b8_people_directory` 실행.

```prisma
// ── 직원 프로필 확장 필드 (Self-Service 관리) ──

model EmployeeProfileExtension {
  id              String   @id @default(uuid()) @db.Uuid
  employeeId      String   @unique @db.Uuid
  bio             String?  @db.Text               // 자기소개
  skills          String[] @default([])            // 스킬 태그 ["React", "품질관리", "용접"]
  languages       Json?                            // [{ language: "영어", level: "비즈니스" }]
  certifications  Json?                            // [{ name: "PMP", issuer: "PMI", date: "2024-01" }]
  socialLinks     Json?                            // { linkedin: "...", github: "..." }
  pronouns        String?  @db.VarChar(30)         // "he/him", "she/her"
  timezone        String?  @db.VarChar(50)         // "Asia/Seoul"
  avatarPath      String?  @db.VarChar(500)        // Supabase Storage 경로
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("employee_profile_extensions")
}

// ── 비상연락처 ──

model EmergencyContact {
  id              String   @id @default(uuid()) @db.Uuid
  employeeId      String   @db.Uuid
  name            String   @db.VarChar(50)
  relationship    String   @db.VarChar(30)         // '배우자', '부모', '형제', '기타'
  phone           String   @db.VarChar(20)
  isPrimary       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("emergency_contacts")
}

// ── 필드별 공개 범위 설정 ──

model ProfileVisibility {
  id              String   @id @default(uuid()) @db.Uuid
  employeeId      String   @unique @db.Uuid
  personalPhone   String   @default("manager") @db.VarChar(10)  // 'public' | 'team' | 'manager' | 'private'
  personalEmail   String   @default("team") @db.VarChar(10)
  birthDate       String   @default("team") @db.VarChar(10)
  address         String   @default("private") @db.VarChar(10)
  emergencyContact String  @default("manager") @db.VarChar(10)
  bio             String   @default("public") @db.VarChar(10)
  skills          String   @default("public") @db.VarChar(10)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("profile_visibilities")
}

// ── 개인정보 변경 요청 (HR 승인 필요 항목) ──

model ProfileChangeRequest {
  id              String   @id @default(uuid()) @db.Uuid
  employeeId      String   @db.Uuid
  fieldName       String   @db.VarChar(50)         // 'address' | 'legal_name' | 'bank_account'
  currentValue    String?  @db.Text
  newValue        String   @db.Text
  reason          String?  @db.Text
  documentPath    String?  @db.VarChar(500)        // 증빙 서류 경로
  status          String   @default("pending") @db.VarChar(20) // 'pending' | 'approved' | 'rejected'
  reviewedBy      String?  @db.Uuid
  reviewedAt      DateTime?
  reviewComment   String?  @db.Text
  createdAt       DateTime @default(now())

  @@map("profile_change_requests")
}
```

### Task 2: People Directory UI

**라우트**: `/directory` (메인 메뉴 "조직" 섹션)

**검색 + 필터 헤더**:
```
┌─────────────────────────────────────────────────────┐
│ People Directory               [카드뷰] [리스트뷰]    │
│ 🔍 [이름, 부서, 스킬로 검색...                     ]  │
│ 필터: [법인 ▼] [부서 ▼] [직급 ▼] [스킬 ▼]            │
└─────────────────────────────────────────────────────┘
```

**카드 뷰**:
```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  👤      │ │  👤      │ │  👤      │ │  👤      │
│ 김과장    │ │ Jane Doe │ │ 이대리    │ │ 박사원    │
│ 개발팀    │ │ QA Team  │ │ 인사팀    │ │ 생산1팀  │
│ CTR-KR   │ │ CTR-US   │ │ CTR-KR   │ │ CTR-KR   │
│ S3 과장   │ │ S3 Senior│ │ S2 대리   │ │ S1 사원  │
│ React    │ │ Selenium │ │ HR법무    │ │ 용접     │
│ [프로필]  │ │ [프로필]  │ │ [프로필]  │ │ [프로필]  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

**리스트 뷰**: 테이블 형태 (이름/부서/직급/연락처/스킬)

**프로필 카드 클릭 → 상세 뷰** (사이드패널 또는 페이지):
```
┌────────────────────────────────────┐
│ 👤 김과장                          │
│ 개발팀 · S3 과장 · CTR-KR          │
│ "풀스택 개발자입니다. 클라우드      │
│  마이그레이션에 관심이 많습니다."   │
│                                    │
│ 📧 kim@ctr.co.kr                  │ ← public
│ 📱 010-1234-5678                  │ ← 공개범위에 따라 표시/숨김
│                                    │
│ 🏷 스킬: React, Node.js, AWS      │ ← public
│ 🗣 언어: 한국어(원어민), 영어(비즈) │
│ 📜 자격: PMP, AWS SA              │
│                                    │
│ 📊 조직                           │
│ 매니저: 박부장                     │
│ 팀원: 이대리, 최사원, 한사원        │
│                                    │
│ [Teams 채팅] [이메일 보내기]        │
└────────────────────────────────────┘
```

**공개 범위 적용 로직**:
```typescript
function filterByVisibility(
  profile: EmployeeProfile,
  visibility: ProfileVisibility,
  viewer: { id: string; departmentId: string; role: string; managedEmployeeIds: string[] }
): VisibleProfile {
  const canSee = (level: string) => {
    if (viewer.role === 'hr_admin') return true;
    switch (level) {
      case 'public': return true;
      case 'team': return viewer.departmentId === profile.departmentId;
      case 'manager': return viewer.managedEmployeeIds.includes(profile.id);
      case 'private': return false;
    }
  };
  
  return {
    ...profile,
    personalPhone: canSee(visibility.personalPhone) ? profile.personalPhone : null,
    personalEmail: canSee(visibility.personalEmail) ? profile.personalEmail : null,
    birthDate: canSee(visibility.birthDate) ? profile.birthDate : null,
    // ...
  };
}
```

### Task 3: Self-Service 포털 — 나의 정보

**라우트**: `/my/profile` (나의 공간)

```
┌─────────────────────────────────────────────────┐
│ 나의 정보                               [편집]   │
├─────────────────────────────────────────────────┤
│ [기본 정보]  [연락처]  [비상연락처]  [공개 설정]   │
├─────────────────────────────────────────────────┤

── 기본 정보 탭 ──
│ 👤 프로필 사진 [변경]                            │
│                                                 │
│ 이름:     김과장                   🔒 변경 요청   │
│ 사번:     KR-001                  🔒 변경 불가   │
│ 부서:     개발팀                   🔒 발령으로만  │
│ 직급:     과장 (S3)               🔒 발령으로만   │
│                                                 │
│ 자기소개: [편집 가능]                             │
│ [풀스택 개발자입니다. 클라우드 마이그레이션에...]   │
│                                                 │
│ 스킬 태그: [편집 가능]                            │
│ [React ×] [Node.js ×] [AWS ×] [+ 추가]          │
│                                                 │
│ 자격증: [편집 가능]                               │
│ PMP (PMI, 2024.01) | AWS SA (Amazon, 2023.06)   │
│ [+ 자격증 추가]                                   │

── 연락처 탭 ──
│ 업무 이메일: kim@ctr.co.kr         🔒            │
│ 업무 전화:   02-1234-5678         🔒            │
│ 개인 전화:   010-1234-5678        ✏️ [편집]      │
│ 개인 이메일: kim.private@gmail.com ✏️ [편집]      │
│ 주소:        서울시 강남구...       📝 변경 요청   │
│ 급여 계좌:   국민은행 ****5678     📝 변경 요청   │

── 공개 설정 탭 ──
│ 다른 직원에게 내 정보가 어디까지 공개되는지 설정    │
│                                                 │
│ 개인 전화:   [전체 공개 ▼] → [매니저만 ▼]         │
│ 개인 이메일: [같은 팀 ▼]                          │
│ 생년월일:    [같은 팀 ▼]                          │
│ 주소:        [비공개 ▼]                           │
│ 자기소개:    [전체 공개 ▼]                        │
│ 스킬:        [전체 공개 ▼]                        │
└─────────────────────────────────────────────────┘
```

### Task 4: 프로필 사진 업로드

```typescript
// Supabase Storage 사용
const uploadAvatar = async (file: File, employeeId: string) => {
  const ext = file.name.split('.').pop();
  const path = `avatars/${employeeId}.${ext}`;
  
  // 크기 제한: 2MB
  if (file.size > 2 * 1024 * 1024) throw new Error('파일 크기 2MB 초과');
  
  // 이미지 리사이즈 (선택): 400x400으로 리사이즈
  
  const { data, error } = await supabase.storage
    .from('profiles')
    .upload(path, file, { upsert: true });
  
  await prisma.employeeProfileExtension.upsert({
    where: { employeeId },
    update: { avatarPath: path },
    create: { employeeId, avatarPath: path }
  });
};
```

### Task 5: 개인정보 변경 요청 (HR 승인 플로우)

주소/이름/계좌 변경 시 HR 승인 필요.

**직원 뷰**:
```
┌─────────────────────────────────────────────────┐
│ 주소 변경 요청                                    │
├─────────────────────────────────────────────────┤
│ 현재 주소: 서울시 강남구 테헤란로 123              │
│ 변경 주소: [서울시 서초구 반포대로 456          ]  │
│ 변경 사유: [이사                              ]   │
│ 증빙 서류: [📁 등본.pdf]                         │
│                                                 │
│ [요청 제출]                                      │
└─────────────────────────────────────────────────┘
```

**HR 승인함** (기존 승인함에 통합 또는 별도 탭):
```
개인정보 변경 요청 (3건)
├── 김과장: 주소 변경 (서울 강남→서초) [승인][반려]
├── 이대리: 급여계좌 변경 (국민→신한) [승인][반려]
└── 박사원: 법적 이름 변경 (증빙 첨부) [승인][반려]
```

승인 시 → 실제 프로필 데이터 업데이트 (자동)

### Task 6: 나의 공간 통합 대시보드

**라우트**: `/my` (나의 공간 홈)

기존 /my/leave, /my/internal-jobs와 통합하여 한 곳에서 주요 정보를 확인.

```
┌─────────────────────────────────────────────────┐
│ 안녕하세요, 김과장님 👋              [프로필 편집]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📋 나의 현황                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ 연차 잔여  │ │ 이번 주   │ │ 진행 중   │         │
│ │ 12/15일   │ │ 근무 36h  │ │ 목표 3개  │         │
│ └──────────┘ └──────────┘ └──────────┘         │
│                                                 │
│ 📌 할 일                                         │
│ ├── ⏳ 온보딩: "필수 안전교육" 미완료 (D+3)        │
│ ├── 📝 평가: 상반기 자기평가 제출 마감 3일 전       │
│ └── ✅ 승인됨: 연차 3/15~3/16                    │
│                                                 │
│ 🔗 바로가기                                      │
│ [휴가 신청] [근태 현황] [급여명세서] [사내 공석]    │
│ [팀원 목록] [조직도]                              │
│                                                 │
│ 📅 다가오는 일정                                  │
│ ├── 03/10: 팀 미팅 (10:00)                       │
│ ├── 03/12: 1-on-1 with 박부장 (14:00)            │
│ └── 03/15~16: 연차                               │
└─────────────────────────────────────────────────┘
```

**위젯 구성**:
- 연차 잔여 (B6-2 LeaveBalance)
- 주간 근무시간 (B6-1 근태)
- 진행 중 목표 (STEP 6A MBO)
- 할 일 / 알림
- 바로가기 링크
- 다가오는 일정 (있으면)

### Task 7: 검증

```bash
# 1. People Directory
#    - 검색: 이름/부서/스킬 검색 동작
#    - 카드뷰 ↔ 리스트뷰 전환
#    - 프로필 상세 표시 + 공개 범위 적용

# 2. 공개 범위
#    - 같은 팀 직원: team 필드 보임
#    - 다른 팀 직원: team 필드 안 보임
#    - HR Admin: 전체 보임

# 3. Self-Service
#    - 프로필 사진 업로드 + 표시
#    - 자기소개/스킬 태그 편집
#    - 연락처(개인) 직접 변경
#    - 주소/계좌 변경 요청 → HR 승인함

# 4. 나의 공간 대시보드
#    - 위젯 데이터 표시 (연차, 근무시간, 목표)
#    - 바로가기 링크 동작

# 5. 비상연락처 CRUD

npx tsc --noEmit
npm run build
# context/TRACK_B.md 업데이트
```

---

## 산출물 체크리스트

- [ ] Prisma 모델 4개 (EmployeeProfileExtension, EmergencyContact, ProfileVisibility, ProfileChangeRequest)
- [ ] People Directory: 검색 + 카드/리스트 뷰 + 프로필 상세
- [ ] 공개 범위 4단계 필터링 로직
- [ ] Self-Service 포털: 프로필 편집 + 사진 업로드 + 공개 설정
- [ ] 개인정보 변경 요청 + HR 승인
- [ ] 나의 공간 통합 대시보드 (/my)
- [ ] 비상연락처 CRUD
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] context/TRACK_B.md 업데이트

---

## context/TRACK_B.md 업데이트 내용 (세션 종료 시)

```markdown
## B8-2 완료 (날짜) — [B] 트랙

### DB 테이블
- employee_profile_extensions, emergency_contacts
- profile_visibilities, profile_change_requests

### 주요 라우트
- /directory — People Directory
- /my/profile — Self-Service 프로필
- /my — 나의 공간 통합 대시보드

### 다음 세션 주의사항
- B8-3: employee_profile_extensions.skills → 스킬 매트릭스 초기 데이터
- B9-1: 복리후생 신청 시 /my 대시보드에 바로가기 추가
- B10-2: HR KPI에 프로필 완성률 위젯 가능
- B11: People Directory 검색 → i18n (다국어 이름 검색)
```

---

## 주의사항

1. **스킬 태그는 자유 입력 + 자동완성** — B3-1의 `competencies` 테이블에서 기존 역량명을 자동완성 후보로 제공하되, 직원이 새 스킬을 자유롭게 입력할 수도 있어야 합니다. B8-3 스킬 매트릭스에서 이 데이터를 활용합니다.

2. **개인정보 변경 요청 이력 보관** — `ProfileChangeRequest`는 승인/반려 후에도 삭제하지 마세요. 감사(audit) 목적으로 이력을 보관합니다.

3. **People Directory 성능** — 전체 직원(1000~3000명)을 한 번에 로드하지 마세요. 페이지네이션 또는 무한 스크롤 + 서버사이드 검색(Prisma `where` 조건)으로 처리.

4. **프로필 사진 기본 이미지** — 사진 미업로드 시 이니셜 아바타(이름 첫 글자) 표시. 성별/인종 관련 기본 아이콘은 사용하지 마세요.

5. **나의 공간 대시보드 위젯은 조건부 표시** — 각 위젯의 데이터 소스(B6-2 LeaveBalance, B6-1 근태 등)가 해당 세션 완료 후에만 실데이터가 있습니다. 데이터 없으면 위젯을 빈 상태로 표시하거나 숨기세요.
