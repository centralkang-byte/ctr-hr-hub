# Anya v2.0 아키텍처 리팩토링 + Mac 앱

## Context
기능 4가지(타임존, 스레드 요약, 빈 시간 제안, 반복 일정) 구현 완료. 이제 아키텍처 개선:
- telegram_bot.py 2,604줄 모놀리스 → 모듈 분리
- 인텐트 스키마 검증, Mail 프로토콜, 비동기, 매직넘버 설정화, 비용 추적, 테스트, Mac 앱

## 목표 디렉토리 구조
```
anya-v2.0/
  main.py                          # ~40줄 — 진입점 (lock + run)
  telegram_bot.py                  # ~250줄 — init, run loop, Telegram I/O, 디스패치
  config/
    config.yaml                    # (기존)
    settings.py                    # ~80줄 — 매직넘버 상수화
  core/
    intent_parser.py               # ~280줄 — IntentParser + 스키마 검증
    intent_schemas.py              # ~60줄 — dataclass 스키마
    cost_tracker.py                # ~100줄 — Claude API 비용 추적
  handlers/
    base.py                        # ~30줄 — HandlerContext dataclass
    mail_handler.py                # ~200줄 — mail 명령어 6개
    calendar_handler.py            # ~250줄 — calendar 명령어 5개
    cleanup_handler.py             # ~80줄 — cleanup
    photo_handler.py               # ~120줄 — photo 처리
    report_handler.py              # ~60줄 — unreplied, full_report, help
  jobs/
    scheduler.py                   # ~40줄 — 스케줄러 설정
    morning_briefing.py            # ~100줄
    weekly_report.py               # ~80줄
    meeting_prep.py                # ~120줄
  mail/
    protocol.py                    # ~50줄 — MailClient Protocol
    gmail_client.py                # (기존 이동)
    outlook_client.py              # (기존 이동)
    helpers.py                     # ~60줄 — fetch_all_emails 등
  calendar_pkg/
    calendar_assistant.py          # (기존 이동)
    helpers.py                     # ~80줄 — 이벤트 fetch, recurrence 빌더
  utils/
    text.py                        # ~30줄 — esc, short_from, extract_addr 등
    process.py                     # ~80줄 — lock, kill_other_bots
  modules/                         # (기존: classifier, vip, followup, state_manager)
  tz_helper.py                     # (기존)
  launcher/
    build_app.sh                   # ~30줄 — .app 빌드 스크립트
    Info.plist
    anya_icon.icns                 # (사용자 제공)
  tests/
    test_intent_schemas.py         # ~150줄
    test_calendar_helpers.py       # ~60줄
    test_utils.py                  # ~40줄
    conftest.py                    # ~30줄
```

---

## Phase 1: 유틸리티 & 설정 추출

**목표**: 매직넘버 + 유틸 함수를 모놀리스에서 분리. 동작 변화 없음.

### 새 파일
- **`config/settings.py`** (~80줄): 30+ 매직넘버 상수화
  ```python
  TELEGRAM_MSG_MAX_LEN = 4096
  TELEGRAM_POLL_TIMEOUT = 30
  MESSAGE_AGE_THRESHOLD_SEC = 60
  CLAUDE_DEFAULT_MAX_TOKENS = 500
  EMAIL_DEFAULT_HOURS = 24
  EMAIL_SEARCH_HOURS = 720
  MEETING_PREP_WINDOW = (25, 35)
  INTENT_HISTORY_SIZE = 6
  DEDUP_WINDOW_SEC = 60
  LOG_MAX_BYTES = 10 * 1024 * 1024
  # ... 등
  ```
- **`utils/text.py`** (~30줄): `esc`, `short_from`, `extract_addr`, `clean_event`, `clean_location`
- **`utils/process.py`** (~80줄): `kill_other_bots()`, `acquire_lock()`

### 수정 파일
- `telegram_bot.py`: 인라인 매직넘버 → `from config.settings import *`, 유틸 함수 → `from utils.text import *`

---

## Phase 2: 인텐트 스키마 검증

**목표**: Claude JSON 출력을 dataclass 스키마로 검증. 잘못된 날짜/시간 silent fail 방지.

### 새 파일
- **`core/intent_schemas.py`** (~60줄): 18개 인텐트별 dataclass
  ```python
  @dataclass
  class CalendarAddIntent:
      intent: str = "calendar_add"
      date: str = ""
      summary: str = ""
      start_time: Optional[str] = None
      # ... 검증 포함

  def validate_intent(raw: dict) -> dict:
      """스키마 검증 + 기본값 채움. 실패 시 chat fallback."""
  ```
- **`core/intent_parser.py`** (~280줄): telegram_bot.py에서 IntentParser 클래스 이동 + `validate_intent()` 연동

### 수정 파일
- `telegram_bot.py`: IntentParser 클래스(204-433줄) 제거 → `from core.intent_parser import IntentParser`

---

## Phase 3: Mail 프로토콜 + 핸들러 분리 (핵심)

**목표**: 공통 인터페이스 정의 + 2,604줄 모놀리스를 모듈별로 분리.

### 3a. Mail Protocol
- **`mail/protocol.py`** (~50줄): `@runtime_checkable class MailClient(Protocol)` — 8개 공통 메서드 정의
- Gmail/Outlook 이동: 루트 → `mail/` 디렉토리

### 3b. HandlerContext 패턴
- **`handlers/base.py`** (~30줄):
  ```python
  @dataclass
  class HandlerContext:
      config: dict
      send: callable
      intent_parser: IntentParser
      gmail: Optional[MailClient]
      outlook: Optional[OutlookClient]
      calendar: CalendarAssistant
      state: StateManager
      tz: str
      # pending states...
  ```

### 3c. 핸들러 모듈 분리
| 파일 | 포함 함수 | 줄수 |
|------|----------|------|
| `handlers/mail_handler.py` | cmd_mail, cmd_mail_search, cmd_mail_summary, cmd_mail_reply, cmd_mail_send, cmd_mail_send_cancel | ~200 |
| `handlers/calendar_handler.py` | cmd_calendar, cmd_add_event, cmd_delete_event, cmd_edit_event, cmd_suggest_schedule | ~250 |
| `handlers/cleanup_handler.py` | cmd_cleanup | ~80 |
| `handlers/photo_handler.py` | _handle_photo, cmd_photo_register, cmd_photo_cancel | ~120 |
| `handlers/report_handler.py` | cmd_unreplied, cmd_full_report, cmd_help | ~60 |

### 3d. 스케줄 잡 분리
| 파일 | 포함 함수 | 줄수 |
|------|----------|------|
| `jobs/morning_briefing.py` | morning_briefing(ctx) | ~100 |
| `jobs/weekly_report.py` | weekly_report(ctx) | ~80 |
| `jobs/meeting_prep.py` | check_upcoming_meetings(ctx), send_meeting_prep(ctx) | ~120 |

### 수정 결과
- `telegram_bot.py`: 2,604줄 → **~250줄** (init + run loop + 디스패치 테이블 + Telegram I/O)

---

## Phase 4: 비동기 이메일/캘린더 fetch

**목표**: Gmail+Outlook 순차 호출 → 병렬화. `asyncio.to_thread()` 사용 (기존 클라이언트 코드 유지).

### 새 파일
- **`mail/async_helpers.py`** (~40줄):
  ```python
  async def fetch_all_emails_async(ctx, hours=24):
      gmail_task = asyncio.to_thread(ctx.gmail.fetch_emails, hours=hours)
      outlook_task = asyncio.to_thread(ctx.outlook.fetch_emails, hours=hours)
      return await asyncio.gather(gmail_task, outlook_task, return_exceptions=True)
  ```

### 적용 위치 (7곳)
- `_fetch_all_emails()`, `_fetch_all_events_for_date()`, morning briefing, weekly report

### 효과
- 아침 브리핑: ~8-12 순차 API 콜 → ~4-6 병렬 라운드 (3-5배 빠름)

---

## Phase 5: Claude API 비용 추적

### 새 파일
- **`core/cost_tracker.py`** (~100줄): 토큰 사용량 기록, 일일/월간 비용 계산
  ```python
  class CostTracker:
      def record(self, response, purpose: str): ...
      def get_daily_summary(self) -> dict: ...
      def get_monthly_cost(self) -> float: ...
  ```
- "비용" 또는 "cost" 인텐트 추가 → 텔레그램에서 바로 조회 가능

---

## Phase 6: 기본 테스트

### 새 파일
- **`tests/test_intent_schemas.py`** (~150줄): 스키마 검증 테스트
- **`tests/test_calendar_helpers.py`** (~60줄): RRULE 빌더, 날짜 계산
- **`tests/test_utils.py`** (~40줄): esc, extract_addr 등

### 실행
```bash
pip install pytest && pytest tests/ -v
```

---

## Phase 7: Mac .app 런처

### 새 파일
- **`launcher/build_app.sh`** (~30줄): .app 번들 생성
  - `~/Applications/Anya.app` 생성
  - 사용자 제공 이미지 → `sips` 명령으로 `.icns` 변환
  - 더블 클릭 → 봇 실행 + 터미널에 로그 표시
- **`launcher/Info.plist`**: 앱 메타데이터 (이름, 아이콘, 실행 파일)
- 아이콘: 사용자가 업로드한 아냐 이미지 → `.icns` 포맷 변환

---

## 구현 순서

```
Phase 1 (유틸/설정) → Phase 2 (스키마) → Phase 3 (모놀리스 분리) → Phase 4 (비동기) → Phase 5 (비용) → Phase 6 (테스트) → Phase 7 (Mac 앱)
```

Phase 7 (Mac 앱)은 아이콘 이미지 수신 후 독립적으로 진행 가능.

## 검증
- 각 Phase 후 `python3 -c "import py_compile; py_compile.compile('telegram_bot.py')"` 문법 검증
- 각 Phase 후 봇 재시작하여 "메일 확인", "일정 확인", "일정 등록" 테스트
- Phase 6 이후 `pytest tests/ -v` 실행

---

## Phase 8: Outlook 토큰 갱신 근본 수정

### Context
매 1시간마다 Outlook 재인증을 요구하는 문제. 원인: `_refresh_token()`이 실패하여 access token 만료 시마다 Device Code 재인증 필요.

### 근본 원인 2가지

**원인 1 — Scope 불일치 (주범)**
```
토큰에 부여된 스코프: Calendars.ReadWrite, Mail.Read, Mail.ReadWrite, Mail.Send, User.Read  (5개)
갱신 시 요청하는 스코프: 위 5개 + User.ReadBasic.All, People.Read, Schedule.Read.All  (8개)
```
→ 동의하지 않은 스코프를 갱신 요청에 포함하면 Microsoft가 **거부**함

**원인 2 — client_secret 충돌 (부범)**
- 토큰의 `appidacr: "0"` = Public Client로 발급됨
- config.yaml에 `client_secret`이 설정되어 있어 갱신 시 전송됨
- Public Client에 client_secret 보내면 **AADSTS700025** 에러 가능

### 수정 계획

#### 8a. `outlook_client.py` — `_refresh_token()` scope 수정
```python
# Before (DEFAULT_SCOPES 8개 전부 요청):
"scope": " ".join(f"https://graph.microsoft.com/{s}" for s in self.scopes) + " offline_access",

# After (scope 파라미터 제거 — Microsoft가 기존 동의 스코프 자동 사용):
# scope 필드를 data dict에서 제거
```
- Microsoft 공식 문서: refresh 요청 시 scope를 생략하면 원래 동의한 스코프로 갱신
- 파일: `outlook_client.py` line 131-134

#### 8b. `config/config.yaml` — client_secret 처리
- Public Client(Device Code Flow)이므로 `client_secret` 빈 문자열로 변경
- 또는: 코드에서 Device Code Flow 사용 시 자동으로 client_secret 무시하도록 개선

#### 8c. 기존 v2.0.1 변경사항 유지 (안전망)
- 30분 keep-alive 스케줄러 → 토큰 만료 전 선제 갱신
- 자동 재인증 → refresh 실패 시 Telegram으로 Device Code 전송
- "아웃룩 인증" 수동 명령
→ 근본 원인 수정 후에도 안전망으로 유지 (90일 만료, 비밀번호 변경, 관리자 정책 대응)

### 검증
1. `python3 -m py_compile outlook_client.py` 문법 확인
2. `pytest tests/ -v` 기존 85개 테스트 통과 확인
3. 봇 재시작 → 1시간+ 방치 → 재인증 요구 없이 "메일 확인" 정상 동작 확인
4. 로그에서 "Outlook 토큰 갱신 완료" 메시지 확인
