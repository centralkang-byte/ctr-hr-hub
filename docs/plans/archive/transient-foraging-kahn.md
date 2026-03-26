# U7: Bulk Export (CSV/Excel)

## Context

6개 데이터 테이블 페이지에 내보내기 기능이 없음. 감사/보고서 작성 시 데이터를 수동 복사해야 하는 불편함. `xlsx` 패키지가 이미 설치되어 있어 추가 의존성 불필요.

**목표**: 현재 필터가 적용된 테이블 데이터를 CSV 또는 Excel로 내보내는 공유 유틸리티 + UI 버튼 제공.

---

## 아키텍처

### 1. 공유 유틸리티 — `src/lib/export.ts`

클라이언트 사이드 export 함수. xlsx 패키지 사용.

```ts
export function exportToFile(
  data: Record<string, unknown>[],
  columns: { key: string; header: string }[],
  filename: string,
  format: 'csv' | 'xlsx' = 'xlsx',
): void
```

- `data`: 행 배열 (API 응답 그대로 또는 flatten된 객체)
- `columns`: 표시할 컬럼 정의 (key=데이터키, header=한국어 헤더)
- `filename`: 확장자 제외 파일명 (예: `이상거래_2026-03-15`)
- `format`: CSV 또는 XLSX
- xlsx 워크시트에 헤더 행 + 데이터 행 구성, 자동 컬럼 너비 조정

### 2. ExportButton 컴포넌트 — `src/components/ui/export-button.tsx`

```tsx
<ExportButton
  onExport={(format) => handleExport(format)}
  loading={exporting}
/>
```

- 드롭다운으로 CSV/Excel 선택
- lucide `Download` 아이콘
- 로딩 상태 (스피너)
- T 디자인 토큰 사용

### 3. 페이지별 통합

각 페이지에서:
1. ExportButton을 PageHeader의 `actions` prop에 배치
2. 클릭 시 현재 필터로 전체 데이터를 fetch (페이지네이션 순회)
3. 컬럼 정의 + exportToFile 호출

---

## 대상 페이지별 컬럼 정의

### Findings (이상거래)
| 헤더 | 키 |
|------|-----|
| 케이스 번호 | case_number |
| 가맹점 | merchant_name |
| 금액 | amount |
| 위반유형 | violation_type |
| 위험등급 | risk_score + risk_level |
| 상태 | status |
| 사용자 | user_name |
| 부서 | dept_name |
| 발생일 | created_at |

### Transactions (거래내역)
| 헤더 | 키 |
|------|-----|
| 거래일 | transaction_date |
| 가맹점 | merchant_name |
| 금액 | amount |
| 소스 | data_source |
| 사용자 | user_name |
| 부서 | dept_name |
| 카드번호 | card_number_masked |
| MCC | mcc_category |
| 이상거래 | finding_status |

### Budget (예산)
| 헤더 | 키 |
|------|-----|
| 부서명 | name |
| 예산 | budget_amount |
| 집행 | spent_amount |
| 잔여 | remaining |
| 소진율 | utilization_rate |

### Cards (카드)
| 헤더 | 키 |
|------|-----|
| 카드번호 | card_number_masked |
| 사용자 | user_name |
| 등급 | grade |
| 한도 | limit |
| 사용액 | monthUsed |
| 소진율 | utilization |
| 이상거래 | findings |

### Logs (감사로그)
| 헤더 | 키 |
|------|-----|
| 시간 | time |
| 사용자 | user |
| 작업 | action |
| 상세 | detail |
| 수준 | level |

### Users (사용자)
| 헤더 | 키 |
|------|-----|
| 이름 | name |
| 이메일 | email |
| 역할 | role_label |
| 법인 | company_name |
| 부서 | department_name |
| 상태 | status |
| 마지막 로그인 | last_sign_in_at |

---

## 페이지네이션 순회 전략

per_page가 100으로 제한된 엔드포인트 (Findings, Transactions, Logs, Users):
- `fetchAllPages()` 유틸 함수: page=1부터 시작, 응답의 total과 비교하여 모든 페이지 fetch
- 현재 필터 파라미터를 그대로 전달
- 진행률 표시 (optional): 대용량 데이터 시 UX 개선

Budget/Cards는 페이지네이션 없으므로 단일 API 호출.

---

## 주요 파일

| 파일 | 변경 |
|------|------|
| `src/lib/export.ts` | 신규 — exportToFile + fetchAllPages |
| `src/components/ui/export-button.tsx` | 신규 — ExportButton 컴포넌트 |
| `src/components/findings/FindingsWorkbench.tsx` | 수정 — ExportButton 추가 |
| `src/app/(dashboard)/transactions/TransactionsClient.tsx` | 수정 — ExportButton 추가 |
| `src/app/(dashboard)/budget/page.tsx` | 수정 — ExportButton 추가 |
| `src/app/(dashboard)/cards/CardsClient.tsx` | 수정 — ExportButton 추가 |
| `src/app/(dashboard)/settings/logs/LogsClient.tsx` | 수정 — ExportButton 추가 |
| `src/app/(dashboard)/settings/users/UsersClient.tsx` | 수정 — ExportButton 추가 |

---

## 검증 방법

1. `npm run build` 통과
2. 개발 서버에서 각 페이지 방문
3. ExportButton 클릭 → CSV/Excel 선택 → 파일 다운로드 확인
4. 다운로드 파일 열어서 한국어 헤더 + 데이터 정상 표시 확인
5. 필터 적용 후 내보내기 → 필터된 결과만 포함 확인
