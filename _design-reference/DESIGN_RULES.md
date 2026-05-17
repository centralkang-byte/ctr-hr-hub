# CTR HR Hub — 디자인 규칙

Workday 스타일 Korean enterprise HR 시스템의 디자인 컨벤션.

---

## 1. 페이지 구조

모든 페이지는 다음 골격을 따른다:

```
<div className="content">
  <div className="page-h">                    ← 1. 페이지 헤더
    <div>
      <h1>{페이지명}</h1>
      <div className="greet-sub">{부제}</div>
    </div>
    <div className="right">                    ← 액션 (1~3개, 우측 정렬)
      <button className="btn">{보조}</button>
      <button className="btn btn-primary">{주}</button>
    </div>
  </div>

  <div className="wd-stat-strip">             ← 2. 통계 스트립 (정확히 4장)
    {4 ss-card}
  </div>

  <div className="wd-tab-bar">                 ← 3. 탭바 (선택적, count 배지 포함)
    ...
  </div>

  {탭별 콘텐츠}                                 ← 4. 본문
</div>
```

**예외**: 직원 상세·내 프로필은 `wd-worker-banner`를 페이지 헤더 대신 사용.

---

## 2. 페이지 헤더

| 슬롯 | 규칙 |
|---|---|
| **제목** | 26px, `font-weight: 600`, letter-spacing -0.015em |
| **부제** | 13px, `var(--fg-muted)` |
| **액션** | 우측 정렬, 최대 3개 (보조·보조·주 순서) |
| 주 액션 | 항상 `.btn-primary`, 오른쪽 끝 |

---

## 3. 통계 스트립 (Stat Strip) — 신중히 사용

KPI 카드는 **공간을 많이 차지**하는 컴포넌트. 페이지 상단을 점령하므로 꼭 필요할 때만 사용.

### 사용 가이드

| 패턴 | 사용 시점 | 클래스 |
|---|---|---|
| **A. 통계 스트립 (4장)** | 실제 의미있는 숫자 4개가 모두 있는 페이지 | `.wd-stat-strip` |
| **B. 인라인 상태 칩** | 상태/카운트 정보를 페이지 헤더에 가볍게 표시 | `.wd-status-chips` |
| **C. 요약 문장형** | 사이클·진행 상황을 자연어로 설명 | `.wd-summary-lead` |
| **D. 컨텍스트 위젯** | 최근 변경·활동 이력 같은 보조 정보 | 페이지별 디자인 (slide-out 등) |
| **E. 제거** | KPI가 0건/라벨뿐인 페이지 | 헤더만 |

### 페이지별 적용

| 페이지 | 적용 |
|---|---|
| 휴가/근태/온보딩/팀허브(overview)/채용 | **A** 통계 스트립 (실수치 풍부) |
| 나의 업무·팀허브(activity)·성과(goals) | **B** 인라인 칩 (탭별 보조 지표) |
| 성과 사이클(overview)·성과(results) | **C** 요약 문장 + 분포 차트 (서술/분포가 더 적합) |
| 컴플라이언스(overview) | **D** Hero 점수 카드 + 인라인 칩 (점수가 dominant) |
| 설정 | **D** 컨텍스트 위젯 (최근 변경 슬라이드) |
| 조직도 | **B** 인라인 칩 (간단 메타) |

### ⚠️ KPI 스트립을 쓰지 말아야 할 신호

- 4지표 카테고리가 너무 이질적 (점수 + 진행률 + 위험 + 로그 → hero+chips)
- 같은 페이지 다른 탭에 이미 strip 이 있고 또 strip → 중복 헤비
- 분포(%)가 4개 → stacked bar 가 직관적
- 1개 지표만 dominant → hero 카드

### A. 통계 스트립 컬러
- `ss-card` (기본·블루) — 중립 카운트
- `ss-green` — 양호·완료
- `ss-amber` — 주의·임박
- `ss-red` — 위험·연체
- `ss-purple` — 분석·인사이트

### B. 인라인 칩 컬러
- `sc` (기본) — 일반 정보
- `sc accent` — 액션 필요
- `sc warn` — 주의
- `sc danger` — 위험
- `sc success` — 완료
- `sc zero` — 0건/비활성 (자동 약화)

---

## 4. 탭바 (wd-tab-bar)

- 카운트가 있으면 항상 `<span className="count">{n}</span>`을 동반
- 첫 탭은 선택된 상태로 시작
- 라벨에 아이콘 동반 (`<Icons.X size={13} sw={1.8} />`)
- 4~5개 이상이면 가로 스크롤 가능

---

## 5. 워크데이 시그니처 패턴

| 패턴 | 클래스 | 용도 |
|---|---|---|
| **Worker Profile Banner** | `.wd-worker-banner` + `.wd-worker-stats` | 직원 상세, 내 프로필 |
| **Worklet Tile** | `.wd-worklet` + `.wd-tile.t1~t8` | 대시보드 앱 런처 |
| **Inbox Layout** | `.wd-inbox-layout` (좌측 리스트 + 우측 상세) | 알림, 결재 |
| **Hire Card** | `.wd-hire-card` | 온보딩 인물 카드 |
| **Member Tile** | `.wd-member-tile` | 팀 멤버 그리드 |
| **Team Calendar** | `.wd-calendar` | 휴가 캘린더, 일정 |
| **Time Grid** | `.wd-time-grid` | 근태 주간 그리드 |
| **Cycle Stepper** | `.wd-stepper` | 성과 사이클, 다단계 프로세스 |
| **Action Card** | `.wd-action-card` | 처리 대기 큐, 할 일 |
| **Bell Popover** | `.wd-bell-popover` | 상단 알림 미리보기 |
| **Related Menu** | `.wd-related-menu` | ⋯ 버튼 → 컨텍스트 액션 |
| **Bulk Bar** | `.wd-bulk-bar` | 다중 선택 시 sticky 하단 액션 |

---

## 6. 컬러 토큰 (Workday)

### 기본
- `--accent`: 딥 네이비 `oklch(38% 0.08 230)`
- `--wd-orange`: 오렌지 `oklch(68% 0.16 50)` (배지·태그)

### 워클릿 8색 팔레트
`--wt-1` ~ `--wt-8`: 네이비/틸/테라코타/퍼플/포레스트/골드/스틸/코랄

### 상태 컬러
- 정상: `oklch(60% 0.14 145)` (녹색)
- 주의: `oklch(60% 0.14 75)` (앰버)
- 위험: `oklch(60% 0.18 25)` (빨강)
- 정보: `oklch(60% 0.14 230)` (블루)

### 카테고리 컬러
- 채용: `oklch(48% 0.15 35)` (테라코타)
- 근태: `oklch(40% 0.13 180)` (틸)
- 성과: `oklch(45% 0.16 290)` (퍼플)
- 승인: `oklch(45% 0.14 75)` (골드)
- 시스템: `oklch(40% 0.10 270)` (회보라)

### 친근 톤 시
warm cream 배경 + 코랄 액센트. Workday 배너는 자동으로 따뜻한 그라데이션으로 전환.

---

## 7. 인터랙션 컨벤션

### 클릭 동작
- **리스트 행 클릭** → 페이지 이동 또는 인스펙터 슬라이드
- **이름·아바타 클릭** → 직원 상세 페이지
- **⋯ 메뉴** → 컨텍스트 액션 (편집·위임·삭제 등)

### 호버 상태
- 카드: `transform: translateY(-1~2px)` + `box-shadow: var(--shadow-pop)`
- 행: 배경 `var(--bg-sunk)`
- 선택된 행: 배경 `var(--accent-soft)` + 좌측 보더 `--accent`

### 빈 상태 — `<EmptyState />` 컴포넌트 사용

```jsx
<EmptyState title="결과가 없어요" />
<EmptyState icon={Icons.Heart} title="..." sub="추가 설명" />
<EmptyState size="lg" standalone title="..." />          // 카드 밖 단독 사용 (배경·테두리 자동)
<EmptyState title="..." action={<button className="btn btn-primary">시작</button>} />
```

**props**:
- `icon` — 아이콘 컴포넌트 (default: `Icons.EmptyBox`)
- `title` — 제목 (required)
- `sub` — 보조 설명 (선택)
- `action` — CTA 버튼 슬롯 (선택)
- `size` — `"sm"` / `"md"`(default) / `"lg"`
- `standalone` — `true` 면 배경·테두리 부여 (카드 외부에서 단독 사용 시)

기존 `<div className="empty">` 직접 사용도 호환 — 내부의 `.em-title`·`.em-sub`·`.em-action` 슬롯과 `.empty.standalone`·`.empty.lg`·`.empty.sm` 변형 클래스 사용 가능.

---

## 8. 컴포넌트 사이즈

| 종류 | 사이즈 |
|---|---|
| **본문 글자** | 14px |
| **테이블 셀** | 13px |
| **칩** | 11px |
| **메타/부제** | 12~12.5px |
| **카드 라디우스** | 12~14px |
| **버튼 라디우스** | 8px (sm: 6px) |
| **칩 라디우스** | 999px (알약형) |

---

## 9. 워클릿 인라인 데이터

각 워클릿 타일은 정적 부제(`sub`) 외에 **인라인 정보 1~3줄**을 표시한다:

```js
{
  inline: [
    { tone: "danger", text: <>박지훈 · 연차 3일 <b>D+5 연체</b></> },
    { tone: "", text: <>정유진 · 반차 · 권하은 외 5명</> },
  ],
}
```

`tone`: `""`(중립) / `warn`(앰버) / `danger`(빨강).
도트로 상태를 시각화하여 사용자가 워클릿 진입 전 핵심 액션을 파악할 수 있게 함.

---

## 10. 카피라이팅 톤

- **친근 톤**: 반말체 X, "~예요/돼요" 부드러운 종결
- **표준 톤**: "~입니다/됩니다" 격식체 (사용자 직접 입력 mock 등 한정)
- 숫자에는 항상 단위 (`6명`, `7건`, `D-12`)
- 영문 약어는 그대로 (`MBO`, `OT`, `LOA`)

### 주 액션 (Primary) 버튼 라벨 컨벤션

| 패턴 | 사용 시점 | 예시 |
|---|---|---|
| **새 X** | HR/관리자가 엔티티 생성 | `새 공고`, `새 사이클`, `새 정책`, `새 프로세스`, `새 업무`, `새 위임` |
| **X 등록** | 직원·법인 등 큰 단위 등록 | `직원 등록`, `공고 등록` |
| **X 신청** | 자가서비스 — 직원이 요청 | `휴가 신청`, `휴직 신청`, `복리후생 신청`, `증명서 신청` |
| **X 보내기** | 메시지/액션 발송 | `칭찬 보내기`, `자료 안내 발송` |
| **X 예약** | 일정 잡기 | `1:1 예약` |

**금지**: 같은 액션에 페이지마다 다른 길이의 라벨 (`신규 직원 등록` vs `직원 등록` 같은 불일치).

---

## 11. 데이터 소스

- **모든 mock 데이터는 `window.HR_DATA` 통해 주입** (data.js)
- 페이지 컴포넌트는 `data` props로만 데이터 접근
- 알림은 `data.notifications`, 결재는 `data.approvalQueue`, 직원은 `data.directory`
- 하드코딩 금지 (활동 피드 사례 참고 — 모두 data.js로 이전 완료)

---

## 12. 다음 단계 체크리스트

- [ ] ⌘K 글로벌 검색 모달
- [ ] Slide-out 인스펙터 패널 (페이지 이동 없이 상세 미리보기)
- [ ] 호버 시 직원 미니카드 (이름 hover → 카드)
- [ ] 9-box 캘리브레이션 그리드 (성과 페이지)
- [ ] Time Off 캘린더 인터랙티브 (셀 클릭 → 휴가 신청)
- [ ] 워클릿 순서 드래그 재배치
- [ ] 인사이트 페이지들 + 채용/설정/나의공간/팀관리 Workday 통일
