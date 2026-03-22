# Anya 비서 봇 v1.9.2 버그 수정 계획

## Context
사용자가 보고한 두 가지 버그와 코드 리뷰에서 발견한 추가 버그를 수정한다.

---

## 발견된 버그 목록

### [Critical-1] Outlook 토큰 갱신 시 refresh_token 유실
**파일:** `outlook_client.py:195-202` (`_save_token`)
**증상:** Outlook 인증 갱신이 지속되지 않음 — 한번 갱신 후 다음 갱신 시 실패
**원인:**
- `_refresh_token()`이 성공하면 서버 응답을 `_save_token(token_data)`에 전달
- `_save_token()`은 `self._token_data`를 서버 응답으로 **전체 교체**
- Microsoft 토큰 서버는 refresh 시 새 `refresh_token`을 **반환하지 않을 수 있음** (OAuth2 표준)
- 기존 `refresh_token`이 유실되어, 다음 access_token 만료 시 `refresh_token` 없음 → `auth_failed = True`

**수정:**
```python
# outlook_client.py: _save_token()
def _save_token(self, token_data: dict):
    # 새 응답에 refresh_token이 없으면 기존 것 보존
    if "refresh_token" not in token_data and self._token_data:
        token_data["refresh_token"] = self._token_data.get("refresh_token", "")
    token_data["expires_at"] = datetime.now().timestamp() + token_data.get("expires_in", 3600)
    self._token_data = token_data
    self.access_token = token_data["access_token"]
    ...
```

---

### [Critical-2] Outlook/Gmail 쓰기 API에 @api_retry → 이중 실행
**파일:** `outlook_client.py:234-270` (`_graph_post`, `_graph_patch`, `_graph_delete`)
**파일:** `gmail_client.py:201-253` (`archive_email`, `trash_email`, `send_reply`, `send_email`)
**증상:** 텔레그램 봇이 답변/작동을 2번씩 함 (일정 이중 등록, 메일 이중 답장)
**원인:**
- v1.8에서 Telegram `_send_raw()`의 `@telegram_retry`를 제거한 것과 **동일한 패턴**의 버그
- 쓰기 API(`POST`, `PATCH`, `DELETE`)에 `@api_retry` 데코레이터가 적용됨
- 서버에서 처리 완료했지만 응답이 느리면 → Timeout → tenacity가 재시도 → **같은 요청이 2번 실행**
- 메일 전송, 일정 생성, 메일 삭제 등 모든 쓰기 작업에 영향

**수정 — outlook_client.py:**
- `_graph_get`: `@api_retry` 유지 (읽기 = 재시도 안전)
- `_graph_post`, `_graph_patch`, `_graph_delete`: `@api_retry` **제거**
- 401 재시도(토큰 갱신)는 내부 로직으로 이미 처리되므로 안전

**수정 — gmail_client.py:**
- `fetch_emails`, `fetch_sent_emails`, `get_thread`, `download_attachment`: `@api_retry` 유지 (읽기)
- `send_reply`, `send_email`: `@api_retry` **제거** (쓰기)
- `archive_email`, `trash_email`: `@api_retry` **제거** (쓰기)

---

### [Bug-3] 비재시도 HTTP 에러(400, 403, 404)도 재시도됨
**파일:** `outlook_client.py:228-232, 241-245, 254-258, 267-270`
**파일:** `gmail_client.py:31, 42-48`
**원인 — Outlook:**
- `_graph_get` 등에서 429/5xx 외 4xx도 `resp.raise_for_status()` → `HTTPError` 발생
- `HTTPError`가 `RETRYABLE_EXCEPTIONS`에 포함 → 400 Bad Request도 3회 재시도
- 의도: 429/5xx만 재시도, 기타 4xx는 즉시 실패

**원인 — Gmail:**
- `_is_retryable_http_error()` 함수가 정의되어 있으나 **사용되지 않음**
- `api_retry`는 `retry_if_exception_type(RETRYABLE_EXCEPTIONS)`로 모든 `HttpError`를 재시도

**수정 — Outlook:**
- `RETRYABLE_EXCEPTIONS`에서 `requests.exceptions.HTTPError` 제거
- `_graph_get`에서 retryable status(429/5xx)에만 HTTPError를 발생시키고, 나머지 4xx는 별도 처리

**수정 — Gmail:**
- `retry_if_exception_type` → 커스텀 `retry_if_exception` 콜백으로 변경
- `_is_retryable_http_error()` 함수를 실제로 retry 조건에 연결

---

### [Bug-4] getUpdates의 @telegram_retry 무효화
**파일:** `telegram_bot.py:953-963`
**원인:**
- `get_updates()` 내부에서 `requests.exceptions.Timeout`과 `Exception`을 모두 catch → `[]` 반환
- `@telegram_retry` 데코레이터가 예외를 볼 수 없어 재시도 불가
- 네트워크 에러 시 빈 결과를 조용히 반환

**수정:**
- `requests.exceptions.Timeout`만 내부 catch (롱 폴링 타임아웃은 정상)
- `ConnectionError`, `OSError` 등은 데코레이터로 전파시켜 재시도 허용

---

### [Minor-5] `_processing` 플래그 미사용
**파일:** `telegram_bot.py:441`
**원인:** `self._processing = False` 선언만 있고 어디서도 사용하지 않음 (dead code)
**수정:** 제거

---

## 수정 대상 파일

| 파일 | 수정 항목 |
|------|-----------|
| `outlook_client.py` | [Critical-1] refresh_token 보존, [Critical-2] 쓰기 retry 제거, [Bug-3] 비재시도 에러 분리 |
| `gmail_client.py` | [Critical-2] 쓰기 retry 제거, [Bug-3] retry 조건 수정 |
| `telegram_bot.py` | [Bug-4] getUpdates retry 정상화, [Minor-5] dead code 제거 |

---

## 구현 상세

### 1. outlook_client.py

**_save_token (line 195):** refresh_token 보존 로직 추가
```python
def _save_token(self, token_data: dict):
    if "refresh_token" not in token_data and self._token_data:
        token_data["refresh_token"] = self._token_data.get("refresh_token", "")
    token_data["expires_at"] = datetime.now().timestamp() + token_data.get("expires_in", 3600)
    ...
```

**RETRYABLE_EXCEPTIONS (line 39):** HTTPError 제거
```python
RETRYABLE_EXCEPTIONS = (
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
    # requests.exceptions.HTTPError 제거
    ConnectionError,
    TimeoutError,
    OSError,
)
```

**_graph_get (line 216):** retryable status만 에러 발생
```python
@api_retry
def _graph_get(self, endpoint, params=None, extra_headers=None):
    ...
    if _is_retryable_status(resp):
        resp.raise_for_status()   # → ConnectionError 계열이 아니므로 raise만 하되, 별도 처리
    elif resp.status_code >= 400:
        resp.raise_for_status()   # 즉시 실패 (재시도 안됨)
    ...
```

사실 HTTPError를 RETRYABLE_EXCEPTIONS에서 제거하면, `resp.raise_for_status()`가 HTTPError를 발생시켜도 tenacity가 재시도하지 않는다. 다만 429/5xx일 때는 재시도해야 하므로:

```python
# 재시도용 래퍼 예외 추가
class RetryableAPIError(Exception):
    pass

RETRYABLE_EXCEPTIONS = (
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
    RetryableAPIError,
    ConnectionError,
    TimeoutError,
    OSError,
)
```

`_graph_get`에서:
```python
if _is_retryable_status(resp):
    raise RetryableAPIError(f"HTTP {resp.status_code}: {resp.text[:200]}")
elif resp.status_code >= 400:
    resp.raise_for_status()  # HTTPError → 재시도 안됨
```

**_graph_post, _graph_patch, _graph_delete:** `@api_retry` 제거
```python
# @api_retry 제거
def _graph_post(self, endpoint, json_data=None):
    ...
```

### 2. gmail_client.py

**api_retry:** 커스텀 retry 조건 사용
```python
from tenacity import retry_if_exception

def _should_retry(exc):
    if isinstance(exc, HttpError):
        return exc.resp.status in (429, 500, 502, 503, 504)
    return isinstance(exc, (ConnectionError, TimeoutError, OSError))

api_retry = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception(_should_retry),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
```

**쓰기 메서드:** `@api_retry` 제거
- `send_reply` (line 217)
- `send_email` (line 241)
- `archive_email` (line 201)
- `trash_email` (line 210)

### 3. telegram_bot.py

**get_updates (line 954):** retry가 동작하도록 수정
```python
@telegram_retry
def get_updates(self):
    try:
        resp = requests.get(
            f"{self.base_url}/getUpdates",
            params={"offset": self.offset, "timeout": 30},
            timeout=35)
        if resp.status_code == 200:
            return resp.json().get("result", [])
        return []
    except requests.exceptions.Timeout:
        # 롱 폴링 타임아웃은 정상 → 재시도 불필요
        return []
    # ConnectionError, OSError 등은 catch하지 않아 telegram_retry가 재시도
```

**_processing 제거 (line 441):** dead code 삭제

---

## 추가 수정: config.yaml API 키 줄바꿈 제거

`config/config.yaml` 11-12번 줄에서 Claude API 키의 닫는 따옴표가 다음 줄에 있어
키 값에 개행문자(`\n`)가 포함됨 → `APIConnectionError` 발생.

**수정:** API 키를 한 줄로 합침.

---

## 검증 방법

1. **Outlook 토큰 갱신 테스트:**
   - `config/outlook_token.json`의 `expires_at`을 과거값으로 수정 → 봇 재시작
   - 토큰 갱신 후 `outlook_token.json`에 `refresh_token` 존재 확인
   - 다시 `expires_at`을 과거값으로 수정 → 2차 갱신 성공 확인

2. **이중 실행 테스트:**
   - 일정 등록 명령 → 캘린더에 1건만 생성되는지 확인
   - 메일 답장 → 실제 1통만 전송되는지 확인
   - 로그에서 `@api_retry`에 의한 재시도 로그가 쓰기 작업에서 나오지 않는지 확인

3. **에러 처리 테스트:**
   - 잘못된 이벤트 데이터로 일정 생성 시도 → 400 에러 1회만 발생 (3회 재시도 없음)
   - 존재하지 않는 메일 ID로 reply 시도 → 404 에러 1회만 발생

4. **전반적 기능 테스트:**
   - 메일 확인/검색 (읽기 — retry 정상 작동 확인)
   - 일정 조회 (읽기 — retry 정상 작동 확인)
   - 일정 등록/삭제/수정 (쓰기 — retry 없이 1회 실행)
   - 메일 답장/전송 (쓰기 — retry 없이 1회 실행)
