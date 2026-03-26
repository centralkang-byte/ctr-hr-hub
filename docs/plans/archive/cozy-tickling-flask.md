# Plan: Anya v2.0 → v2.1 Outlook 완전 제거

## Context
Outlook/MSAL/Microsoft Graph 의존성을 완전히 제거하고, 이메일은 Gmail, 캘린더는 Google Calendar 단일 채널로 통일한다.
- Outlook 관련 코드는 outlook_client.py (~889줄), telegram_bot.py 내 13개 섹션, handlers 4개 파일, jobs 3개 파일에 걸쳐 있음
- **"4번 캘린더(CTR)"** → Google Calendar (`acraf5fte02n30kom9079rfgdq2jnqsa@import.calendar.google.com`) 에 직접 등록으로 대체
- CTR_KEYWORDS 자동 분류는 "4" (CTR Google Calendar) 로 유지

---

## 작업 파일 목록

| 파일 | 작업 |
|------|------|
| `modules/outlook_client.py` | **전체 삭제** |
| `config/config.yaml` | outlook 섹션 삭제, shortcuts["4"] → CTR Google Calendar ID |
| `config/outlook_token.json` | 파일 삭제 |
| `outlook_config_template.yaml` | 파일 삭제 |
| `telegram_bot.py` | Outlook 관련 섹션 제거, CTR 분기를 Google Calendar로 변경, 버전 v2.1 |
| `handlers/calendar_handler.py` | _add_outlook_event() 삭제 → Google Calendar로 대체 |
| `handlers/mail_handler.py` | Outlook 메일 출력 섹션 삭제 |
| `handlers/cleanup_handler.py` | Outlook 정리 블록 삭제 |
| `handlers/report_handler.py` | Outlook 미회신 조회 삭제 |
| `jobs/morning_briefing.py` | Outlook 메일 섹션 삭제 |
| `jobs/meeting_prep.py` | Outlook 일정 아이콘 정리 |
| `jobs/weekly_report.py` | Outlook 통계 제거 |
| `install.sh` | Outlook 설정 제거 |

---

## 단계별 구현

### Step 1: 파일 삭제
```bash
rm modules/outlook_client.py
rm -f config/outlook_token.json
rm -f outlook_config_template.yaml
```

### Step 2: config/config.yaml 수정

**삭제:**
- outlook 블록(client_id, client_secret, tenant_id, token_file, scopes) 전체

**수정:**
```yaml
calendar:
  calendar_ids:
    - "primary"
    - "jungeun.chang@gmail.com"
    - "iqec92h22itdu08haua6ru9e6k@group.calendar.google.com"
    - "acraf5fte02n30kom9079rfgdq2jnqsa@import.calendar.google.com"  # CTR (신규)
  shortcuts:
    "1": "primary"
    "2": "jungeun.chang@gmail.com"
    "3": "iqec92h22itdu08haua6ru9e6k@group.calendar.google.com"
    "4": "acraf5fte02n30kom9079rfgdq2jnqsa@import.calendar.google.com"  # Outlook → Google
  shortcut_names:
    "1": "Sangwoo"
    "2": "Jungeun"
    "3": "Family"
    "4": "CTR"            # 이름 유지
    "outlook": "CTR"      # 유지 (하위 호환)
  readonly_calendars:
    - "jungeun.chang@gmail.com"
    # CTR은 쓰기 가능하므로 readonly 제외
```

### Step 3: telegram_bot.py 수정

**삭제 블록 목록:**

1. **라인 59-61**: `from modules.outlook_client import OutlookClient` try-except 블록 전체
2. **라인 107**: `load_config()` 내 `for section in ("gmail", "outlook")` → `for section in ("gmail",)` 로 변경
3. **라인 168**: `self._outlook = None`
4. **라인 171**: `self._outlook_auth_notified = False`
5. **라인 177**: `self._pending_outlook_event = None`
6. **라인 178**: `self._pending_people_choice = None`  ← Outlook search_people 전용
7. **라인 260-263**: 스케줄러 Outlook keepalive 등록 블록
8. **라인 268-292**: `_outlook_token_keepalive()` 메서드 전체
9. **라인 307-329**: `@property def outlook` 전체
10. **라인 354**: `EXCLUDED_GCAL_SHORTCUTS = {"2", "4"}` → `{"2"}` 로 변경
    - "4" (CTR)는 이제 Google Calendar이므로 제외 목록에서 제거
11. **라인 356-377**: `_fetch_all_emails()` → Outlook futures 블록 제거, Gmail만:
    ```python
    def _fetch_all_emails(self, hours: int = 24) -> tuple:
        """Gmail 메일 조회"""
        gmail_mails = []
        try:
            if self.gmail:
                gmail_mails = self.gmail.fetch_emails(hours=hours)
                for m in gmail_mails:
                    m["source"] = "gmail"
        except Exception as e:
            logger.warning(f"Gmail 조회 실패: {e}")
        return gmail_mails, []  # 하위 호환: (gmail_mails, outlook_mails)
    ```
12. **라인 394-416**: `_fetch_all_events_for_date()` → Outlook futures 블록 제거
    - `ThreadPoolExecutor` 불필요 (단일 소스), 단순 호출로 변경
13. **라인 442-444**: `_get_mail_client_for_source()` → "outlook" 분기 제거
14. **라인 545-575**: `_pending_people_choice` 처리 블록 전체 제거
15. **라인 577-609**: `_pending_outlook_event` 처리 블록 전체 제거
16. **라인 636-642**: "아웃룩 인증" 명령 처리 제거

**수정 블록:**

17. **라인 732-738**: `_auto_calendar()` — "outlook" → "4" 로 변경
    ```python
    def _auto_calendar(self, summary):
        summary_lower = summary.lower()
        if any(kw in summary_lower for kw in CTR_KEYWORDS):
            return "4"   # Outlook 대신 CTR Google Calendar
        if any(kw in summary_lower for kw in FAMILY_KEYWORDS):
            return "3"
        return "1"
    ```
    - `CTR_KEYWORDS` 리스트 자체는 **유지** (자동 분류 기능 유지)

18. **라인 750-756**: `_register_event_silent()` → Outlook 분기를 Google Calendar로
    ```python
    if cal_num == "outlook" or cal_num == "4":
        cal_id = self.config["calendar"]["shortcuts"].get("4")
        if cal_id and self.calendar:
            self.calendar.add_event(
                summary=summary, date_str=date_str,
                start_time=start_time, end_time=end_time,
                all_day=all_day or not start_time,
                calendar_id=cal_id)
            return
    ```

19. **버전 주석**: v2.0 → v2.1 변경
    ```python
    """
    🥜 Anya 비서 봇 v2.1 (SPY×FAMILY)

    v2.1 — Outlook 완전 제거, Gmail + Google Calendar 단일 채널:
      ★ modules/outlook_client.py 삭제 (MSAL/Microsoft Graph 전면 제거)
      ★ 이메일: Gmail 단일 채널
      ★ 캘린더: Google Calendar 단일 채널
      ★ "4번(CTR)" 캘린더 → Google Calendar (acraf5fte...@import.calendar.google.com)
      ★ CTR_KEYWORDS 자동 분류 → "4" (CTR Google Calendar) 유지

    v2.0 — ...기존 주석 유지
    """
    ```

### Step 4: handlers/calendar_handler.py 수정

**삭제 대상:**
- `_add_outlook_event()` 함수 전체 (라인 172-302)
- Outlook import 관련 코드
- Outlook 일정 삭제/수정/조회 분기 (라인 368, 388, 453-486)

**"4번에 등록해줘" 처리 (수정):**
- 일정 추가 분기: `if cal_num == "4" or cal_num == "outlook"` → Google Calendar API 호출
  ```python
  if cal_num == "4" or cal_num == "outlook":
      cal_id = bot.config["calendar"]["shortcuts"].get("4")
      # Google Calendar에 직접 등록 (기존 calendar_assistant.add_event 사용)
      bot.calendar.add_event(
          summary=data.get("summary"), date_str=data.get("date"),
          start_time=data.get("start_time"), end_time=data.get("end_time"),
          all_day=data.get("all_day", False),
          location=data.get("location"),
          calendar_id=cal_id,
          recurrence=data.get("recurrence"),
      )
      bot.send(f"✅ CTR 캘린더에 등록했어요! 🥜")
      return
  ```
  - 기존 Google Calendar `add_event()` 시그니처 확인 후 맞춤 (calendar_assistant.py 수정 없음)
- Outlook 일정 삭제(`delete_event`)/수정 분기 → Google Calendar `delete_event`/`update_event` 로 변경

**표시 정리:**
- 🏢 Outlook 아이콘 → 🏢 CTR 아이콘 유지 (또는 📅 로 통일 — 기존 코드에서 자연히 정리됨)

### Step 5: handlers/mail_handler.py 수정

```python
# 변경 전
gmail_mails, outlook_mails = bot._fetch_all_emails(hours=24)
# (Outlook 출력 블록 36~51줄)

# 변경 후
gmail_mails, _ = bot._fetch_all_emails(hours=24)
# Outlook 출력 블록 삭제
```
- 모든 함수(cmd_mail, cmd_unreplied_mails 등)에서 동일 패턴 적용
- "🏢 Outlook" 출처 레이블 제거

### Step 6: handlers/cleanup_handler.py 수정
- Outlook fetch_emails → _cleanup_emails 블록(라인 35-42) 삭제
- Gmail만 정리

### Step 7: handlers/report_handler.py 수정
- 미회신 조회에서 Outlook 분기 삭제
- 헬프 텍스트에서 "Outlook", "회사메일" 언급 정리

### Step 8: jobs/morning_briefing.py 수정
- `gmail_mails, _ = bot._fetch_all_emails()` 로 변경
- Outlook 메일 분류/출력 섹션 삭제

### Step 9: jobs/meeting_prep.py 수정
- 🏢 Outlook 아이콘 → 📅 또는 제거

### Step 10: jobs/weekly_report.py 수정
- Outlook 통계 섹션 삭제

### Step 11: install.sh 수정
- Outlook 관련 설정 확인/복사 코드 삭제

---

## 주의사항

- `_pending_people_choice`: Outlook `search_people` 전용 → 삭제
- `_pending_suggest`: Google Calendar 빈 시간 제안 → **유지**
- `_pending_reply`, `_pending_photo`: Gmail/사진 → **유지**
- `EXCLUDED_GCAL_SHORTCUTS = {"2"}`: Jungeun은 읽기전용 유지, "4" 제거
- CTR_KEYWORDS 리스트 자체는 유지 (자동 분류 → "4" Google Calendar)
- `calendar_assistant.py`, `gmail_client.py` → **수정 없음**
- `tz_helper.py` → Outlook 응답 파싱 여부 확인 후 범용 함수면 유지

---

## 검증 방법

```bash
# 1. Outlook 잔재 확인 (결과 0건)
grep -rn "outlook\|Outlook\|OutlookClient\|msal\|MSAL\|graph\.microsoft" --include="*.py" .

# 2. 전체 파일 구문 검사
for f in telegram_bot.py handlers/*.py jobs/*.py core/*.py modules/*.py; do
    python3 -m py_compile "$f" && echo "✅ $f" || echo "❌ $f"
done

# 3. Import 체인 확인
python3 -c "from handlers.calendar_handler import cmd_calendar; print('✅ calendar import OK')"
python3 -c "from handlers.mail_handler import cmd_mail; print('✅ mail import OK')"

# 4. config 확인
python3 -c "
import yaml
cfg = yaml.safe_load(open('config/config.yaml'))
assert 'outlook' not in cfg, 'outlook 섹션 발견!'
assert cfg['calendar']['shortcuts']['4'] == 'acraf5fte02n30kom9079rfgdq2jnqsa@import.calendar.google.com'
print('✅ config.yaml 정상')
"

# 5. 봇 실제 기동 후 텔레그램 기능 테스트
# - "메일 확인해줘" → Gmail 리포트만
# - "오늘 일정" → Google Calendar만 (CTR 포함)
# - "4번에 미팅 잡아줘" → CTR Google Calendar에 등록
# - "회의 일정 추가" → CTR Google Calendar(4번) 자동 분류
# - "메일 정리해" → Gmail만 정리
```
