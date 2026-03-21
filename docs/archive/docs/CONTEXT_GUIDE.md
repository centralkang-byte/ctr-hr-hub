# 병렬 개발 컨텍스트 운영 가이드

## 디렉토리 구조

```
project-root/
├── context/
│   ├── SHARED.md       ← 공유 인프라 (읽기 전용, 주말 머지)
│   ├── TRACK_A.md      ← [A] 메인 트랙 (A 세션만 쓰기)
│   └── TRACK_B.md      ← [B] 서브 트랙 (B 세션만 쓰기)
```

## 각 세션 프롬프트에 추가할 블록

### [A] 트랙 세션일 때:

```markdown
### 컨텍스트 파일 규칙 (병렬 개발)

# 1. 3개 파일 모두 읽기
cat context/SHARED.md
cat context/TRACK_A.md
cat context/TRACK_B.md

# 2. 쓰기는 TRACK_A.md만
# 세션 종료 시 context/TRACK_A.md 하단에 결과 추가

# 3. Prisma migrate 이름 규칙
# npx prisma migrate dev --name a_{모듈코드}_{설명}
# 예: npx prisma migrate dev --name a_b2_core_hr_ui

# 4. schema.prisma 모델 추가 시
# 파일 내 자기 트랙 영역에만 추가
# // === TRACK A: B2 Core HR === 주석으로 구간 표시
```

### [B] 트랙 세션일 때:

```markdown
### 컨텍스트 파일 규칙 (병렬 개발)

# 1. 3개 파일 모두 읽기
cat context/SHARED.md
cat context/TRACK_A.md
cat context/TRACK_B.md

# 2. 쓰기는 TRACK_B.md만
# 세션 종료 시 context/TRACK_B.md 하단에 결과 추가

# 3. Prisma migrate 이름 규칙
# npx prisma migrate dev --name b_{모듈코드}_{설명}
# 예: npx prisma migrate dev --name b_b4_ats_pipeline

# 4. schema.prisma 모델 추가 시
# 파일 내 자기 트랙 영역에만 추가
# // === TRACK B: B4 ATS === 주석으로 구간 표시
```

## 주말 머지 체크리스트

각 주 양쪽 트랙 완료 후 (당신이 수동으로):

```
1. TRACK_A.md 내용 확인
2. TRACK_B.md 내용 확인
3. 양쪽 내용을 SHARED.md 하단에 추가
   - DB 테이블 목록
   - 공유 컴포넌트/함수 레지스트리 업데이트
   - 법인별 차이 테이블 업데이트 (필요 시)
4. TRACK_A.md의 해당 주차 상태를 ✅로 변경
5. TRACK_B.md의 해당 주차 상태를 ✅로 변경
6. schema.prisma 충돌 없는지 확인
   - npx prisma validate
   - npx prisma migrate dev --name merge_week{N}
```

## Prisma 충돌 방지 팁

### 동시 migrate 방지
```bash
# [A] 트랙 세션에서:
npx prisma migrate dev --name a_b2_core_hr
# 완료 확인 후 [B] 트랙에 알림

# [B] 트랙 세션에서:
npx prisma db pull          # A 트랙 변경사항 가져오기
npx prisma migrate dev --name b_b4_ats
```

### schema.prisma 모델 구간 분리
```prisma
// ========================================
// SHARED (B1 — 수정 금지)
// ========================================
model Company { ... }
model CompanySetting { ... }
model ApprovalFlow { ... }

// ========================================
// TRACK A — 현재: B2
// ========================================
model EmployeeProfileExtension { ... }

// ========================================
// TRACK B — 현재: B4
// ========================================
model Requisition { ... }
model JobPosting { ... }
```

## 트랙 간 의존성 매트릭스

어떤 주차에서 상대 트랙의 테이블을 읽기 참조하는지:

| Week | [A] 세션 | [B] 세션 | A→B 참조 | B→A 참조 |
|------|---------|---------|----------|----------|
| 4 | B2 | B4 | 없음 | A2 employees (기존) |
| 5 | B3-1 | B5 | 없음 | 없음 |
| 6 | B3-2 | B6-1 | 없음 | 없음 |
| 7 | B6-2 | B9-1 | 없음 | B3-1 competencies (A W5) |
| 8 | B7-1a | B8-1 | B6-1 근태 (B W6) | 없음 |
| 9 | B7-1b | B8-2 | 없음 | 없음 |
| 10 | B7-2 | B8-3 | 없음 | B3-1 competencies (A W5) |
| 11 | B9-2 | B10-1 | 없음 | 전체 읽기 |
| 12 | B10-2 | B11 전반 | B10-1 (B W11) | 없음 |
| 13 | B11 후반 (A+B 병합) | — | — | — |

**Week 8 주의**: [A] B7-1a가 [B] B6-1의 근태 데이터를 참조합니다.
→ Week 6 머지에서 B6-1 결과가 SHARED.md에 반영되어야 합니다.

**Week 11 주의**: [B] B10-1이 전체 모듈 데이터를 읽기 참조합니다.
→ Week 10 머지에서 모든 완료 세션이 SHARED.md에 반영되어야 합니다.
