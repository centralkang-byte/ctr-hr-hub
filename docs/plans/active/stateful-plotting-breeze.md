# 키워드 기반 자동 카테고리 분류 기능

## Context
사용자가 할 일 입력 시 텍스트를 분석해 카테고리(업무/개인/공부)를 자동으로 선택해주는 기능 추가.
현재는 사용자가 매번 카테고리 select를 직접 바꿔야 하는 불편함이 있음.

## 수정 파일
- `/Users/sangwoo/Desktop/Study-02/index.html` (단일 파일)

---

## 구현 계획

### 1. 키워드 사전 (`KEYWORDS`) 추가
`const CAT = ...` 바로 아래에 추가.

```js
const KEYWORDS = {
  work:     ['회의','보고서','이메일','발표','기획','제안','미팅','고객','계약','결재',
              '출장','업무','프로젝트','마감','데드라인','팀장','팀원','회사','거래처','협업'],
  personal: ['쇼핑','약속','병원','운동','여행','청소','빨래','요리','가족','친구',
              '취미','영화','밥','점심','저녁','헬스','마트','장보기','산책','휴가'],
  study:    ['공부','학교','숙제','과제','시험','강의','수업','책','독서','논문',
              '학습','인강','강좌','복습','예습','자격증','영어','수학','코딩','알고리즘'],
};
```

### 2. `autoClassify(text)` 함수 추가
데이터 레이어 함수들 아래에 배치. 각 카테고리 키워드 매칭 점수를 계산해 가장 많이 매칭된 카테고리 반환.

```js
function autoClassify(text) {
  const normalized = text.trim();
  if (!normalized) return null;

  let best = null, bestScore = 0;
  Object.entries(KEYWORDS).forEach(([cat, words]) => {
    const score = words.filter(w => normalized.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = cat; }
  });
  return best; // null if no keyword matched
}
```

### 3. 전역 플래그 추가
```js
let userPickedCategory = false; // 사용자가 수동으로 카테고리 변경했는지 여부
```

### 4. 이벤트 리스너 연결 (`DOMContentLoaded` 내부)

#### 4a. `todoInput` → `input` 이벤트
입력할 때마다 `autoClassify`를 호출. 사용자가 수동으로 변경하지 않은 경우에만 select 값 변경.

```js
todoInput.addEventListener('input', () => {
  if (userPickedCategory) return;
  const suggestion = autoClassify(todoInput.value);
  if (suggestion) {
    categorySelect.value = suggestion;
    autoHint.textContent = '자동 분류';
    autoHint.hidden = false;
  } else {
    autoHint.hidden = true;
  }
});
```

#### 4b. `categorySelect` → `change` 이벤트
사용자가 직접 바꾸면 자동 분류 비활성화.

```js
categorySelect.addEventListener('change', () => {
  userPickedCategory = true;
  autoHint.hidden = true;
});
```

#### 4c. `handleAdd` 완료 후 상태 초기화
기존 `handleAdd` 함수 내 `todoInput.value = ''` 뒤에:
```js
userPickedCategory = false;
autoHint.hidden = true;
```

### 5. HTML: 힌트 요소 추가
`<select>` 바로 뒤에 인라인 힌트 뱃지 삽입:

```html
<span class="auto-hint" id="auto-hint" hidden>자동 분류</span>
```

### 6. CSS: `.auto-hint` 스타일
`input-area__select` 관련 CSS 근처에 추가:

```css
.auto-hint {
  font-size: 0.65rem;
  color: #6B7280;
  background: #F3F4F6;
  border-radius: 4px;
  padding: 2px 6px;
  white-space: nowrap;
  align-self: center;
}
```

---

## 동작 흐름

```
사용자 입력 → autoClassify() 호출
  ├─ 매칭 있음 + 수동선택 아님 → select 자동변경 + "자동 분류" 힌트 표시
  ├─ 매칭 없음 → 힌트 숨김, select 유지
  └─ 사용자가 select 직접 변경 → userPickedCategory=true, 이후 자동분류 억제
추가 버튼 클릭 → 태스크 저장 → 플래그 초기화, 힌트 숨김
```

---

## 검증
1. `mcp__Claude_Preview__preview_screenshot` 으로 UI 확인
2. "회의 준비" 입력 → select 자동으로 "업무" 변경 + 힌트 표시 확인
3. "공부 계획" 입력 → "공부" 자동 선택 확인
4. 자동 분류 후 select 수동 변경 → 이후 입력해도 override 안 됨 확인
5. 추가 후 다음 입력 시 자동 분류 재작동 확인
