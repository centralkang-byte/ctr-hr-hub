# Anya v2.1 Phase 2 — macOS LaunchAgent 배포 전환 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 터미널 수동 실행에서 macOS LaunchAgent 자동 관리로 전환하여 Mac 로그인 시 자동 시작, 크래시 시 자동 재시작, `anya.sh` 명령으로 관리 가능하게 한다.

**Architecture:** `deploy/` 디렉토리에 LaunchAgent plist와 관리 셸 스크립트를 생성한다. `telegram_bot.py`는 이미 SIGTERM 핸들러, `self._running` 폴링 루프, RotatingFileHandler가 모두 구현되어 있어 수정 불필요. 주요 작업은 deploy 파일 2개 생성과 CHANGELOG 업데이트.

**Tech Stack:** macOS LaunchAgent (launchctl), bash, Python 3

---

## 사전 조건 확인

- **프로젝트 경로:** `/Users/sangwoo/Documents/Bot/anya-v2.0`
- **plist 설치 위치:** `~/Library/LaunchAgents/com.anya.bot.plist`
- **Python 인터프리터:** 실행 전 `which python3` 로 실제 경로 확인 필요
- **이미 완료된 항목 (수정 불필요):**
  - `telegram_bot.py:182-183` — SIGTERM/SIGINT 핸들러 등록 완료
  - `telegram_bot.py:654` — `while self._running:` 폴링 루프
  - `telegram_bot.py:669` — `scheduler.shutdown(wait=False)` finally 블록
  - `telegram_bot.py:73` — RotatingFileHandler (10MB × 5) 이미 적용

---

### Task 1: Python 인터프리터 경로 확인 및 deploy/ 디렉토리 생성

**Files:**
- Create: `deploy/` (directory)

**Step 1: Python 경로 확인**

```bash
which python3
# 결과 예시: /usr/bin/python3 또는 /opt/homebrew/bin/python3 또는 /usr/local/bin/python3
python3 --version
```

결과를 메모해 둔다. Task 2의 plist `ProgramArguments` 첫 번째 항목에 사용한다.

**Step 2: deploy 디렉토리 생성**

```bash
mkdir -p /Users/sangwoo/Documents/Bot/anya-v2.0/deploy
```

**Step 3: logs 디렉토리 확인 (launchd stdout/stderr 출력용)**

```bash
ls /Users/sangwoo/Documents/Bot/anya-v2.0/logs/
# logs/가 없으면:
mkdir -p /Users/sangwoo/Documents/Bot/anya-v2.0/logs
```

---

### Task 2: LaunchAgent plist 생성

**Files:**
- Create: `deploy/com.anya.bot.plist`

**Step 1: plist 파일 생성**

`deploy/com.anya.bot.plist` 내용 (Python 경로는 Task 1 결과로 교체):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.anya.bot</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>telegram_bot.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/sangwoo/Documents/Bot/anya-v2.0</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>/Users/sangwoo/Documents/Bot/anya-v2.0/logs/launchd_stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/sangwoo/Documents/Bot/anya-v2.0/logs/launchd_stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PYTHONUNBUFFERED</key>
        <string>1</string>
    </dict>
</dict>
</plist>
```

> **주의:** `ProgramArguments` 첫 번째 `<string>`을 Task 1에서 확인한 실제 python3 경로로 교체.
> Python이 가상환경을 사용한다면 가상환경 내 python 경로 (`venv/bin/python3`) 사용.

**Step 2: plist XML 유효성 검사**

```bash
plutil -lint /Users/sangwoo/Documents/Bot/anya-v2.0/deploy/com.anya.bot.plist
# 기대 결과: com.anya.bot.plist: OK
```

---

### Task 3: 관리 스크립트 anya.sh 생성

**Files:**
- Create: `deploy/anya.sh`

**Step 1: anya.sh 생성**

```bash
#!/bin/bash
# Anya Bot 관리 스크립트
PLIST_NAME="com.anya.bot"
PLIST_SRC="$(dirname "$0")/com.anya.bot.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
BOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$BOT_DIR/logs"

case "$1" in
    install)
        mkdir -p "$LOG_DIR"
        mkdir -p "$HOME/Library/LaunchAgents"
        cp "$PLIST_SRC" "$PLIST_DST"
        echo "✅ plist 설치됨: $PLIST_DST"
        echo "시작하려면: $0 start"
        ;;
    start)
        if [ ! -f "$PLIST_DST" ]; then
            echo "먼저 install을 실행하세요: $0 install"
            exit 1
        fi
        launchctl load "$PLIST_DST"
        sleep 2
        launchctl list | grep "$PLIST_NAME" && echo "✅ Anya 시작됨" || echo "❌ 시작 실패"
        ;;
    stop)
        launchctl unload "$PLIST_DST" 2>/dev/null
        rm -f "$BOT_DIR/telegram_bot.lock"
        echo "✅ Anya 중지됨"
        ;;
    restart)
        "$0" stop
        sleep 3
        "$0" start
        ;;
    status)
        if launchctl list | grep -q "$PLIST_NAME"; then
            PID=$(launchctl list | grep "$PLIST_NAME" | awk '{print $1}')
            echo "✅ 실행 중 (PID: $PID)"
        else
            echo "⏹ 중지됨"
        fi
        ;;
    logs)
        tail -f "$LOG_DIR/launchd_stdout.log"
        ;;
    errors)
        tail -f "$LOG_DIR/launchd_stderr.log"
        ;;
    uninstall)
        "$0" stop
        rm -f "$PLIST_DST"
        echo "✅ plist 제거됨"
        ;;
    *)
        echo "Anya Bot 관리"
        echo ""
        echo "사용법: $0 {install|start|stop|restart|status|logs|errors|uninstall}"
        echo ""
        echo "  install    - LaunchAgent 설치 (최초 1회)"
        echo "  start      - 봇 시작"
        echo "  stop       - 봇 중지"
        echo "  restart    - 봇 재시작"
        echo "  status     - 실행 상태 확인"
        echo "  logs       - 실시간 로그 보기"
        echo "  errors     - 에러 로그 보기"
        echo "  uninstall  - LaunchAgent 제거"
        ;;
esac
```

**Step 2: 실행 권한 부여**

```bash
chmod +x /Users/sangwoo/Documents/Bot/anya-v2.0/deploy/anya.sh
ls -la /Users/sangwoo/Documents/Bot/anya-v2.0/deploy/
# 기대: anya.sh에 -rwxr-xr-x 권한
```

---

### Task 4: CHANGELOG.md 업데이트

**Files:**
- Modify: `CHANGELOG.md`

**Step 1: Phase 2 항목 추가**

`CHANGELOG.md` 상단(기존 v2.1 섹션 위)에 추가:

```markdown
## v2.1 Phase 2 — macOS LaunchAgent 배포 (2026-03-01)

★ `deploy/com.anya.bot.plist` — LaunchAgent 설정 (로그인 시 자동 시작, 크래시 시 10초 후 재시작)
★ `deploy/anya.sh` — install/start/stop/restart/status/logs/errors/uninstall 관리 스크립트
★ 기존 telegram_bot.py 수정 없음 (SIGTERM 핸들러·RotatingFileHandler 이미 완료)

### 초기 설정 (최초 1회)
```bash
deploy/anya.sh install   # ~/Library/LaunchAgents/ 에 plist 복사
deploy/anya.sh start     # 봇 시작
```

### 일상 관리
```bash
deploy/anya.sh status    # 실행 상태
deploy/anya.sh logs      # 실시간 로그
deploy/anya.sh restart   # 재시작
```
```

---

### Task 5: 구문 및 파일 검증

**Step 1: plist 재검증**

```bash
plutil -lint /Users/sangwoo/Documents/Bot/anya-v2.0/deploy/com.anya.bot.plist
# 기대: OK
```

**Step 2: 셸 스크립트 구문 검사**

```bash
bash -n /Users/sangwoo/Documents/Bot/anya-v2.0/deploy/anya.sh
# 기대: 출력 없음 (에러 없음)
```

**Step 3: Python 파일 구문 검사**

```bash
cd /Users/sangwoo/Documents/Bot/anya-v2.0
python3 -m py_compile telegram_bot.py && echo "✅ telegram_bot.py OK"
```

**Step 4: 최종 파일 목록 확인**

```bash
ls -la /Users/sangwoo/Documents/Bot/anya-v2.0/deploy/
# 기대:
# -rw-r--r--  com.anya.bot.plist
# -rwxr-xr-x  anya.sh
```

---

## 검증 (End-to-End)

LaunchAgent 전체 사이클 테스트:

```bash
cd /Users/sangwoo/Documents/Bot/anya-v2.0

# 1. 설치
deploy/anya.sh install

# 2. 기존 수동 실행 봇 중지 (있다면)
pkill -f telegram_bot.py || true

# 3. LaunchAgent로 시작
deploy/anya.sh start
# 기대: "✅ Anya 시작됨" + PID 표시

# 4. 상태 확인
deploy/anya.sh status
# 기대: "✅ 실행 중 (PID: XXXX)"

# 5. 로그 확인 (텔레그램 봇이 polling 중인지)
deploy/anya.sh logs
# Ctrl+C로 종료

# 6. 중지 테스트
deploy/anya.sh stop
deploy/anya.sh status
# 기대: "⏹ 중지됨"

# 7. 재시작 테스트
deploy/anya.sh restart
deploy/anya.sh status
```

**크래시 재시작 검증:**

```bash
# 봇 프로세스를 강제 kill
PID=$(launchctl list | grep com.anya.bot | awk '{print $1}')
kill -9 $PID
sleep 15  # ThrottleInterval(10초) 대기
deploy/anya.sh status
# 기대: LaunchAgent가 자동으로 재시작하여 "✅ 실행 중"
```

---

## 주의사항

- `KeepAlive.SuccessfulExit: false` = 정상 종료(exit 0) 시 재시작 안 함. `deploy/anya.sh stop` → SIGTERM → `_signal_handler` → `self._running=False` → 루프 종료 → exit 0 → 재시작 없음 ✓
- `ThrottleInterval: 10` = 크래시 루프 방지 (연속 크래시 시 10초 쿨다운)
- Python 경로가 `/usr/bin/python3` 이 아닌 경우 plist 수정 필요 (Homebrew: `/opt/homebrew/bin/python3`)
- 기존 `telegram_bot.lock` 파일이 남아있으면 `anya.sh stop` 이 자동으로 제거함
