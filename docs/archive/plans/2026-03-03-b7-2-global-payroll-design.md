# B7-2 해외 급여 통합 + 글로벌 분석 — 설계 문서

> 작성일: 2026-03-03
> 트랙: A
> 선행: B7-1a (한국법인 급여), B7-1b (연말정산), B1 (exchange_rates 테이블)

---

## 1. 목표

해외 5법인(CN/RU/US/VN/MX)의 급여 데이터를 **엑셀/CSV 업로드 + 항목 매핑**으로 수집하고, 환율 변환하여 **글로벌 급여 대시보드**로 통합 분석. 급여 시뮬레이션 + 이상 탐지 기능 제공.

핵심: 해외 급여는 **계산하지 않고, 결과 데이터를 수집→통합→분석**.

---

## 2. 아키텍처 결정

### 2.1 ExchangeRate 테이블 재활용
- 기존 `exchange_rates` 테이블 스키마 변경 없이 재활용
- `effectiveDate = new Date(year, month-1, 1)` (YYYY-MM-01)로 월별 환율 저장
- `@@unique([fromCurrency, toCurrency, effectiveDate])` 제약 활용

### 2.2 신규 Prisma 모델 3개
- `PayrollImportMapping` — 법인별 컬럼 매핑 설정 (JSON 저장)
- `PayrollImportLog` — 업로드 이력 + 상태 추적
- `PayrollSimulation` — 시뮬레이션 결과 저장

### 2.3 기존 PayrollRun + PayrollItem 재활용
- 해외법인도 동일 구조 사용 (currency 필드 이미 존재)
- 업로드 확정 시: PayrollRun(status=CONFIRMED) + PayrollItem 생성
- 글로벌 대시보드에서 통합 쿼리 가능

---

## 3. 라우트 구조

```
/payroll/import          — 해외 급여 업로드 (3-step wizard)
/payroll/global          — 글로벌 급여 대시보드
/settings/exchange-rates — 환율 관리
```

---

## 4. API 엔드포인트

```
GET/POST   /api/v1/exchange-rates         — 월별 환율 CRUD
GET/POST   /api/v1/payroll/import-mappings — 매핑 설정 CRUD
POST       /api/v1/payroll/import-mappings/[id]/preview — 업로드 미리보기
POST       /api/v1/payroll/import-mappings/[id]/confirm — 업로드 확정
GET        /api/v1/payroll/import-logs    — 업로드 이력
GET        /api/v1/payroll/global         — 글로벌 통합 데이터
GET        /api/v1/payroll/anomalies      — 이상 탐지
GET/POST   /api/v1/payroll/simulations    — 시뮬레이션 CRUD
```

---

## 5. 파일 처리

- xlsx 파싱: `xlsx` npm 패키지 (서버 사이드)
- 파일 업로드: Next.js API Route (`multipart/form-data`)
- 임시 저장: 메모리 처리 후 PayrollItem으로 DB 저장
- (선택) 원본 파일: Supabase Storage 저장

---

## 6. 글로벌 대시보드 차트 (Recharts)

1. 법인별 평균 급여 — 수평 바 차트 (KRW 환산)
2. 직급별 법인 간 비교 — 그룹 바 차트
3. 급여 트렌드 12개월 — 라인 차트
4. 급여 밴드 분포 — 커스텀 범위 차트 (SalaryBand 참조)
5. 인건비 구성비 — 도넛 차트
6. 법인별 총 인건비 비중 — 파이 차트

---

## 7. 이상 탐지 규칙

| 규칙 | 기준 | 심각도 |
|------|------|--------|
| 밴드 이탈 | 급여 > SalaryBand.maxSalary 또는 < minSalary | 🔴 위험 |
| 내부 형평성 | 같은 법인+직급 내 편차 > 30% | 🟠 주의 |
| 글로벌 격차 | 동일 직급 법인 간 환산 급여 격차 > 50% | 🟡 참고 |
| 비정상 변동 | 전월 대비 개인 급여 변동 > 20% | 🟠 주의 |

---

## 8. 급여 시뮬레이션 3종

1. **전출**: 법인 이동 시 현지 세율/보험 적용 후 급여 비교
2. **인상**: 인상률 입력 → 실수령 변동 계산
3. **승진**: 직급 변경 → SalaryBand 내 위치 + 급여 변화

---

## 9. 시드 데이터

- 2025년 1~3월 환율 (5통화 × 3개월 = 15건)
- 해외법인 5개 × 5~10명 PayrollRun + PayrollItem
  - CTR-US: 10명, USD
  - CTR-CN: 10명, CNY
  - CTR-RU: 5명, RUB
  - CTR-VN: 8명, VND
  - CTR-MX: 5명, MXN

---

## 10. 네비게이션 추가

```typescript
// 인사 운영 > 급여 관리 하위
{ key: 'payroll-import', label: '해외 급여 업로드', href: '/payroll/import' }
{ key: 'payroll-global', label: '글로벌 대시보드', href: '/payroll/global' }
// 설정 하위
{ key: 'exchange-rates', label: '환율 관리', href: '/settings/exchange-rates' }
```
