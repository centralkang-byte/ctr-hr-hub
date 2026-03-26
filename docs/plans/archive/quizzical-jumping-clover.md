# Plan: Anya v2.1 Phase 3 — KTrain 기차표 예약 모듈

## Context

Anya v2.1은 Phase 1(Outlook 제거), Phase 2(macOS LaunchAgent 배포)를 완료했다.
Phase 3는 코레일 기차표 검색/예약/조회/취소 기능을 텔레그램 자연어로 처리하는 모듈을 추가한다.
`letskorail` 라이브러리를 래핑하여 "서울→창원 KTX 특실 예약해줘" → 검색 → 번호선택 → 예약 → 캘린더등록 플로우를 구현한다.

---

## ⚠️ 중요 전제 조건

### letskorail은 PyPI에 없음 (`pip3 install letskorail` 불가)
실제 설치 명령:
```bash
pip3 install git+https://github.com/bsangmin/letskorail.git
```
또는:
```bash
git clone https://github.com/bsangmin/letskorail.git ~/letskorail
pip3 install -e ~/letskorail
```

### 기존 패턴과의 차이 (사양서 수정)
- **핸들러**: 사양서는 `TrainHandler` 클래스를 제안하지만, 기존 코드는 **순수 함수** 방식(`cmd_<name>(bot, data)`). 함수 방식으로 구현함.
- **letskorail 실제 API**: 사양서 코드와 실제 라이브러리 API가 다를 수 있으므로 설치 후 소스 확인 필수:
  - `AdultPassenger` → 실제: `AdultPsg`
  - `reservation.rsv_id` → 실제: `reservation.rsv_no`
  - `korail.cancel(rsv_no)` → 실제: `korail.cancel(reservation_object)` (객체 필요)
  - `reserve(train, passengers=[], option=...)` → 실제: `reserve(train, seat_opt=...)`
  - `Korail.TrainType.KTX` → 실제 enum명 확인 필요
- **pending_train_select**: 메모리 전용 (`_pending_suggest`와 동일 패턴). SQLite 저장 안 함 (bot 재시작 시 초기화됨, 단기 플로우이므로 허용).

---

## 구현 계획

### Step 0: letskorail 설치 및 API 검증
```bash
pip3 install git+https://github.com/bsangmin/letskorail.git
python3 -c "import letskorail; help(letskorail.Korail)"
python3 -c "import inspect, letskorail; print(inspect.getsource(letskorail))"
```
→ Train/Reservation 속성명, enum 값을 확인하고 이후 단계에서 사용

---

### Step 1: `config/config.yaml` — korail 섹션 추가

기존 설정 아래에 추가:
```yaml
korail:
  id: ""
  pw: ""
  is_phone: false
  default_departure: "서울"
  default_seat_class: "특실"
  default_train_type: "KTX"
  auto_calendar: true
```

---

### Step 2: `config/settings.py` — KORAIL 상수 추가

`load_config()`가 아닌 `config.yaml` 로딩 방식을 따름. `settings.py` 파일을 확인해 로딩 패턴 맞춤:
```python
KORAIL_ID = config.get("korail", {}).get("id", "")
KORAIL_PW = config.get("korail", {}).get("pw", "")
KORAIL_IS_PHONE = config.get("korail", {}).get("is_phone", False)
KORAIL_DEFAULT_DEPARTURE = config.get("korail", {}).get("default_departure", "서울")
KORAIL_DEFAULT_SEAT_CLASS = config.get("korail", {}).get("default_seat_class", "특실")
KORAIL_DEFAULT_TRAIN_TYPE = config.get("korail", {}).get("default_train_type", "KTX")
KORAIL_AUTO_CALENDAR = config.get("korail", {}).get("auto_calendar", True)
```

---

### Step 3: `modules/korail_client.py` — 신규 생성

**구조**: `KorailClient` 클래스, letskorail 래퍼
**주의**: 설치 후 실제 속성명으로 수정 필요

```python
@dataclass
class TrainInfo:
    train_no, train_type, dep_station, arr_station
    dep_time, arr_time, dep_date   # "HH:MM", "YYYY-MM-DD"
    first_class, economy_class     # "○" / "×"
    raw_train                       # letskorail Train 객체 (예약용)

@dataclass
class ReservationInfo:
    reservation_no   # rsv_no
    train_no, dep_station, arr_station
    dep_time, arr_time, dep_date
    seat_no, payment_deadline, total_price

class KorailClient:
    def __init__(self, korail_id, korail_pw, is_phone=False)
    def _ensure_login() -> bool  # lazy login
    def search(dep, arr, date_fmt, time_fmt, train_type, seat_class) -> list[TrainInfo]
    def reserve(train_info, seat_class, passengers=1) -> ReservationInfo
    def my_reservations() -> list[ReservationInfo]
    def cancel(reservation_no) -> bool  # 예약 목록 조회 후 rsv_no 매칭
```

**핵심 수정 포인트 (vs 사양서)**:
- `reserve()` 호출: `AdultPsg()`, `seat_opt=SeatOption.SPECIAL_FIRST` 방식으로 변경
- `cancel()`: `korail.cancel(reservation_object)` — rsv_no 매칭 후 객체 전달
- 예외: `letskorail` 미설치 시 `ImportError` graceful handling

---

### Step 4: `handlers/train_handler.py` — 신규 생성

**기존 패턴 준수**: 순수 함수, 동기, `cmd_<name>(bot, data=None)` 시그니처

```python
def cmd_train_search(bot, data=None):
    """검색 → 결과 표시 → bot._pending_train_select 설정"""

def cmd_train_reserve(bot, data=None):
    """= cmd_train_search (검색 후 선택 → 예약)"""

def cmd_train_my_reservations(bot, data=None):
    """내 예약 조회"""

def cmd_train_cancel(bot, data=None):
    """예약 취소"""
```

**pending_train_select 플로우 (`_pending_suggest`와 동일 패턴)**:
```python
# cmd_train_search에서:
bot._pending_train_select = {
    "trains": [{"train_no":..., "dep_time":..., ...}],  # 메타데이터 (표시용)
    "raw_trains": [train_obj1, train_obj2, ...],          # Train 객체 (예약용)
    "seat_class": "특실",
    "passengers": 1,
}

# telegram_bot.handle_message()에서 처리 (인라인, 인텐트 파싱 전)
if bot._pending_train_select:
    # 숫자 입력 → 예약
    # "취소" → 초기화
```

**캘린더 등록** (auto_calendar=True 시):
`bot._register_event_silent(data)` 재사용 가능. 직접 호출:
```python
event_data = {
    "date": reservation.dep_date,
    "summary": f"🚄 {dep}→{arr} ({train_no})",
    "start_time": reservation.dep_time,
    "end_time": reservation.arr_time,
    "calendar": "1",  # Sangwoo
}
bot._register_event_silent(event_data)
```

---

### Step 5: `core/intent_schemas.py` — 4개 dataclass 추가

파일 끝 `_SCHEMA_MAP` 위에 추가:
```python
@dataclass
class TrainSearchIntent:
    intent: str = "train_search"
    departure: str = "서울"
    arrival: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    train_type: str = "KTX"
    seat_class: str = "특실"
    passengers: int = 1

@dataclass
class TrainReserveIntent:
    intent: str = "train_reserve"
    departure: str = "서울"
    arrival: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    train_type: str = "KTX"
    seat_class: str = "특실"
    passengers: int = 1

@dataclass
class TrainMyReservationsIntent:
    intent: str = "train_my_reservations"

@dataclass
class TrainCancelIntent:
    intent: str = "train_cancel"
    reservation_no: Optional[str] = None
```

`_SCHEMA_MAP`에 추가:
```python
"train_search": TrainSearchIntent,
"train_reserve": TrainReserveIntent,
"train_my_reservations": TrainMyReservationsIntent,
"train_cancel": TrainCancelIntent,
```

---

### Step 6: `core/intent_parser.py` — 프롬프트에 train 인텐트 추가

기존 19번 `cost` 인텐트 다음(line ~151)에 추가:
```
20. "train_reserve" - 기차 검색/예약 → {"intent":"train_reserve","departure":"서울","arrival":"도착역","date":"YYYY-MM-DD","time":"HH:MM","train_type":"KTX","seat_class":"특실","passengers":1}
   - "기차", "KTX", "SRT", "코레일", "열차" 키워드
   - 출발역 미지정: "서울" 기본값
   - 좌석 미지정: "특실" 기본값
   - "검색만 해줘"도 train_reserve (검색 후 선택하면 예약)
21. "train_my_reservations" - 내 기차 예약 조회 → {"intent":"train_my_reservations"}
22. "train_cancel" - 기차 예약 취소 → {"intent":"train_cancel","reservation_no":"예약번호"|null}
```

캘린더 번호 설명에 train_type 설명 추가 불필요 (별도 필드).

---

### Step 7: `telegram_bot.py` — import, init, 라우팅, pending 처리

**import 추가** (조건부):
```python
try:
    from modules.korail_client import KorailClient
    from handlers.train_handler import (
        cmd_train_search, cmd_train_reserve,
        cmd_train_my_reservations, cmd_train_cancel,
    )
except ImportError:
    KorailClient = None
```

**`__init__`에 추가**:
```python
self._pending_train_select = None  # 기차 선택 대기 (메모리 전용)
self._korail = None  # lazy init
```

**korail property 추가** (gmail 패턴 동일):
```python
@property
def korail(self):
    if not self._korail:
        from config.settings import KORAIL_ID, KORAIL_PW, KORAIL_IS_PHONE
        if KorailClient and KORAIL_ID and KORAIL_PW:
            self._korail = KorailClient(KORAIL_ID, KORAIL_PW, KORAIL_IS_PHONE)
            logger.info("🚄 코레일 클라이언트 초기화")
        else:
            return None
    return self._korail
```

**`handle_message()`에 pending_train_select 처리 추가**
`_pending_suggest` 블록(line 458) 바로 다음:
```python
# ★ Phase 3: 기차 선택 처리 (_pending_suggest와 동일 패턴)
if self._pending_train_select:
    low = text.strip().lower()
    if low in ("취소", "아니", "아니요", "ㄴ", "안해"):
        self._pending_train_select = None
        self.send("알겠어요~ 기차 예약 취소! 🥜")
        return
    if text.strip().isdigit():
        from handlers.train_handler import _handle_train_selection
        _handle_train_selection(self, int(text.strip()))
        return
    # 숫자가 아니면 pending 유지하고 기존 인텐트 파싱으로 넘어감
    # (다른 명령어를 입력했을 가능성)
```

**인텐트 라우팅에 추가** (handler dict):
```python
"train_search":         lambda: cmd_train_search(self, intent_data) if self.korail else self.send("🚄 코레일이 설정되지 않았어요. config.yaml에 korail.id/pw를 입력해주세요."),
"train_reserve":        lambda: cmd_train_reserve(self, intent_data) if self.korail else self.send("🚄 코레일이 설정되지 않았어요. config.yaml에 korail.id/pw를 입력해주세요."),
"train_my_reservations": lambda: cmd_train_my_reservations(self) if self.korail else self.send("🚄 코레일 설정 필요"),
"train_cancel":         lambda: cmd_train_cancel(self, intent_data) if self.korail else self.send("🚄 코레일 설정 필요"),
```

**버전 주석 업데이트** (telegram_bot.py 상단):
```python
# v2.1 Phase 3 — KTrain 기차표 예약:
#   ★ 자연어 기차표 검색/예약: "서울→창원 KTX 특실 예약해줘"
#   ★ 텔레그램 번호 선택 → 예약 → 캘린더 자동 등록
#   ★ 내 예약 조회 / 예약 취소
#   ★ letskorail 라이브러리 기반
```

---

### Step 8: `changelog.md` 업데이트

v2.1 Phase 3 섹션 추가

---

## 수정 파일 목록

| 파일 | 작업 |
|------|------|
| `config/config.yaml` | korail 섹션 추가 |
| `config/settings.py` | KORAIL_* 상수 추가 |
| `core/intent_schemas.py` | 4개 dataclass + _SCHEMA_MAP 추가 |
| `core/intent_parser.py` | 프롬프트에 train 인텐트 3개 추가 |
| `telegram_bot.py` | import, __init__, korail property, pending 처리, 라우팅, 버전 |
| `modules/korail_client.py` | **신규** |
| `handlers/train_handler.py` | **신규** |
| `changelog.md` | Phase 3 기록 |

---

## 검증 방법

### 1. 구문 검사
```bash
find /Users/sangwoo/Documents/Bot/anya-v2.0 -name "*.py" | xargs python3 -m py_compile
```

### 2. Import 테스트
```bash
cd /Users/sangwoo/Documents/Bot/anya-v2.0
python3 -c "from modules.korail_client import KorailClient; print('✅ korail_client')"
python3 -c "from handlers.train_handler import cmd_train_search; print('✅ train_handler')"
python3 -c "from letskorail import Korail; print('✅ letskorail')"
```

### 3. 비활성화 동작 테스트 (config.yaml의 korail.id가 비어있을 때)
봇 실행 후 "기차 예약해줘" → "코레일이 설정되지 않았어요" 메시지 확인

### 4. 활성화 후 동작 테스트 (config.yaml에 id/pw 입력 후)
```
"서울→창원중앙 KTX 내일 오후 6시" → 검색 결과 + 번호 선택 프롬프트
"1" → 예약 진행 → 예약 완료 메시지 + 캘린더 등록
"내 기차 예약 보여줘" → 예약 목록
```

---

## 주의사항

1. **letskorail API 검증 필수**: 설치 후 `help(Korail)`, `help(Train)`, `help(Reservation)` 실행하여 실제 속성명 확인. `rsv_no`, `AdultPsg`, `SeatOption` enum값 등을 확인하고 `korail_client.py` 수정.
2. **기존 19개 인텐트 동작 변경 금지**
3. **쓰기 API(@api_retry 금지)**: `reserve()`, `cancel()`에 재시도 없음
4. **_register_event_silent 재사용**: 신규 코드 불필요, 기존 메서드 호출
