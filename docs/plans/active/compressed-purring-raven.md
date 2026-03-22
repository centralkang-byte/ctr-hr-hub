# QuizMaster Phase A-C-D 구현 계획

## Context

Phase 1~3(솔로 플레이, 리더보드, 실시간 대전)이 완료됐다. 이제 콘텐츠 강화 → 완성도 향상 → 배포 순서로 프로덕션 수준을 갖춘다.

**실행 순서**: A → C → D (순차)

---

## 프로젝트 구조 요약

```
/Users/sangwoo/Documents/VibeCoding/Study-03/
├── docker-compose.yml
├── docs/plans/2026-02-23-content-quality-deploy.md   ← 상세 계획서
├── quiz-master/                   (React 19 + Vite + Zustand + TailwindCSS)
│   ├── src/
│   │   ├── pages/     (10개: Home, QuizPage, LiveSetupPage, LiveQuizPage, ...)
│   │   ├── store/     (gameStore.ts, liveBattleStore.ts)
│   │   ├── data/      (questions.ts — 20문제, 4카테고리×5문제)
│   │   ├── lib/       (api.ts BASE='/api', socket.ts — URL 없음/proxy 의존)
│   │   └── types/     (Question 인터페이스에 difficulty 없음)
│   └── vite.config.ts (proxy /api, /socket.io → localhost:3000)
└── server/                        (Express + Socket.io + Prisma + PostgreSQL)
    ├── src/
    │   ├── routes/    (games, groups, leaderboard, questions)
    │   ├── lib/       (claude.ts, socketManager.ts, scoreCalc.ts)
    │   └── data/      (fallbackQuestions.ts — 20문제, roomStore.ts — in-memory Map)
    ├── prisma/schema.prisma
    │   Models: Group, Player, Game, QuestionCache
    │   QuestionCache: category, question, choices, answer, explanation, usedCount
    │   (difficulty 컬럼 없음, 현재 0건)
    └── src/index.ts   (CORS: 'http://localhost:5173' 하드코딩)
```

**Git 상태**: `main` 브랜치, 클린(Phase 3까지 커밋 완료)

---

## Phase A: 콘텐츠 강화

### Task A1: `difficulty` 필드 추가 (schema + types + 데이터)

**수정 파일:**
- `quiz-master/src/types/index.ts` — `Difficulty` 타입 + `Question.difficulty` 필드
- `quiz-master/src/data/questions.ts` — 20문제에 difficulty 분류
- `server/src/data/fallbackQuestions.ts` — 동일 분류
- `server/prisma/schema.prisma` — `QuestionCache`에 `difficulty String @default("normal")`
- `server/src/lib/claude.ts` — `GeneratedQuestion` 인터페이스 + 프롬프트 + createMany

**단계:**

1. `types/index.ts`: `export type Difficulty = 'easy' | 'normal' | 'hard';` 추가, `Question` 인터페이스에 `difficulty: Difficulty` 추가

2. `questions.ts`: 20문제 각각에 `difficulty` 필드 추가
   - easy: h1(조선건국), h3(임진왜란), s1~기초과학, g1~g2(상식쉬운것), n1~n2
   - hard: h4(피라미드), s4, g5, n5
   - normal: 나머지

3. `fallbackQuestions.ts`: 동일하게 difficulty 추가 (FallbackQuestion 인터페이스도 포함)

4. `schema.prisma` — QuestionCache 모델에 추가:
   ```prisma
   difficulty  String   @default("normal")
   ```

5. 마이그레이션:
   ```bash
   cd /Users/sangwoo/Documents/VibeCoding/Study-03/server
   npx prisma migrate dev --name add-difficulty
   ```

6. `claude.ts` 수정:
   - `GeneratedQuestion`에 `difficulty: 'easy' | 'normal' | 'hard'`
   - `validateQuestion`에 `VALID_DIFFICULTIES.has(obj.difficulty)` 검증
   - systemPrompt에 "난이도(easy/normal/hard) 균형 배분" 추가
   - userPrompt JSON 형식에 `"difficulty":"easy|normal|hard"` 추가
   - `createMany` data에 `difficulty: q.difficulty` 추가

7. 빌드 검증:
   ```bash
   cd /Users/sangwoo/Documents/VibeCoding/Study-03/server && npm run build
   cd /Users/sangwoo/Documents/VibeCoding/Study-03/quiz-master && npm run build
   ```

8. Commit: `feat(A1): add difficulty field to questions, schema, and Claude generation`

---

### Task A2: QuizPage 난이도 필터 UI

**수정 파일:** `quiz-master/src/pages/QuizPage.tsx`

**단계:**

1. `QuizPage.tsx` 읽기 (현재 구조 파악)

2. state 추가:
   ```tsx
   const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | 'easy' | 'normal' | 'hard'>('all');
   ```

3. 필터링 로직:
   ```tsx
   const filteredQuestions = selectedDifficulty === 'all'
     ? allQuestions
     : allQuestions.filter((q) => q.difficulty === selectedDifficulty);
   ```

4. 난이도 선택 버튼 UI (카테고리 선택 UI 아래):
   - 4개 버튼: 전체 / 🟢 쉬움 / 🟡 보통 / 🔴 어려움
   - 선택 시 `bg-yellow-400 text-gray-900`, 미선택 시 `bg-white/10 text-white/60`

5. 게임 시작 시 `allQuestions` → `filteredQuestions` 사용, 0개일 때 경고 표시

6. 빌드 검증: `npm run build`

7. Commit: `feat(A2): add difficulty filter UI to solo QuizPage`

---

### Task A3: QuestionCache DB 시드 스크립트

**생성 파일:** `server/prisma/seed.ts`
**수정 파일:** `server/package.json`

**단계:**

1. `server/prisma/seed.ts` 생성:
   ```typescript
   import { PrismaClient } from '@prisma/client';
   import { fallbackQuestions } from '../src/data/fallbackQuestions.js';
   const prisma = new PrismaClient();
   async function main() {
     const result = await prisma.questionCache.createMany({
       data: fallbackQuestions.map((q) => ({
         category: q.category, difficulty: q.difficulty,
         question: q.question, choices: q.choices,
         answer: q.answer, explanation: q.explanation,
       })),
       skipDuplicates: true,
     });
     console.log(`✅ Seeded ${result.count} questions`);
   }
   main().catch(console.error).finally(() => prisma.$disconnect());
   ```

2. `server/package.json`에 prisma.seed 추가:
   ```json
   "prisma": { "seed": "tsx prisma/seed.ts" }
   ```

3. tsx 확인 후 시드 실행:
   ```bash
   cd /Users/sangwoo/Documents/VibeCoding/Study-03/server
   npx prisma db seed
   ```
   Expected: "✅ Seeded 20 questions"

4. Commit: `feat(A3): add prisma seed script for QuestionCache initial population`

---

## Phase C: 완성도 향상

### Task C1: 모바일 반응형 최적화

**수정 파일:**
- `quiz-master/index.html`
- `quiz-master/src/index.css`
- 주요 페이지들 (HomePage, LiveSetupPage, WaitingRoomPage, QuizPage, ResultPage, RoomEntryPage)

**단계:**

1. `index.html` viewport 수정:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
   ```

2. `index.css` 추가:
   ```css
   :root { --safe-top: env(safe-area-inset-top, 0px); --safe-bottom: env(safe-area-inset-bottom, 0px); }
   body { padding-top: var(--safe-top); padding-bottom: var(--safe-bottom); -webkit-tap-highlight-color: transparent; }
   button { min-height: 44px; }
   ```

3. 각 페이지 container: `max-w-md` → `max-w-md sm:max-w-lg` (태블릿에서 더 넓게)

4. LiveQuizPage 답 버튼 최소 높이 확인 (`py-3` 이상인지)

5. 빌드 검증: `npm run build`

6. Commit: `feat(C1): improve mobile responsiveness and iOS safe area support`

---

### Task C2: 서버 재시작 시 방 복구 (PostgreSQL 기반)

**수정 파일:**
- `server/prisma/schema.prisma` — `ActiveRoom` 모델 추가
- `server/src/data/roomStore.ts` — `persistRoom`, `restoreRoomFromDB`, `deleteRoomFromDB` 추가
- `server/src/lib/socketManager.ts` — `room:rejoin`에서 DB 복구, `room:create`/`room:start`에서 persist 호출

**단계:**

1. `schema.prisma`에 `ActiveRoom` 모델 추가:
   ```prisma
   model ActiveRoom {
     roomCode     String   @id
     status       String   @default("waiting")
     hostNickname String
     groupCode    String?
     settings     Json
     players      Json
     questions    Json
     currentIndex Int      @default(0)
     createdAt    DateTime @default(now())
     updatedAt    DateTime @updatedAt
     expiresAt    DateTime
   }
   ```

2. 마이그레이션:
   ```bash
   npx prisma migrate dev --name add-active-room
   ```

3. `roomStore.ts`에 PrismaClient import + 3개 함수 추가:
   - `persistRoom(room)`: upsert ActiveRoom (status, players, questions, currentIndex)
   - `restoreRoomFromDB(roomCode)`: DB에서 복구 후 메모리 Map에 등록. TTL 초과 시 삭제 후 null
   - `deleteRoomFromDB(roomCode)`: 조용히 삭제

4. `socketManager.ts` 수정:
   - `room:rejoin` 핸들러: `getRoom()` → null이면 `await restoreRoomFromDB()` 시도
   - `room:create` 핸들러 끝: `void persistRoom(room)`
   - game start(문제 로드 후): `void persistRoom(room)` (questions 포함)
   - 방 삭제 시: `void deleteRoomFromDB(roomCode)`

5. 서버 빌드 검증: `npm run build`

6. Commit: `feat(C2): persist room state to PostgreSQL for server restart recovery`

---

## Phase D: 배포

### Task D1: 환경변수 분리

**수정 파일:**
- `quiz-master/src/lib/socket.ts` — `VITE_SOCKET_URL` env var
- `quiz-master/src/lib/api.ts` — `VITE_API_URL` env var
- `server/src/index.ts` — `CORS_ORIGIN` env var
- 생성: `quiz-master/.env.example`, `quiz-master/src/vite-env.d.ts` 타입

**단계:**

1. `socket.ts`: `io(import.meta.env.VITE_SOCKET_URL ?? '', { autoConnect: false, ... })`

2. `api.ts`: `const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'`

3. `server/src/index.ts`:
   ```typescript
   const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
   // io cors + app.use(cors()) 둘 다 CORS_ORIGIN 사용
   ```

4. `.env.example` 생성:
   ```
   VITE_API_URL=https://your-server.railway.app
   VITE_SOCKET_URL=https://your-server.railway.app
   ```

5. `vite-env.d.ts` 타입 확장 (VITE_API_URL, VITE_SOCKET_URL)

6. 빌드 검증 (양쪽): `npm run build`

7. Commit: `feat(D1): externalize API/socket URLs and CORS origin to env vars`

---

### Task D2: Vercel 프론트엔드 배포

**생성 파일:** `quiz-master/vercel.json`

**단계:**

1. `vercel.json` 생성:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```

2. Vercel CLI 확인: `npx vercel --version`

3. 로그인: `npx vercel login`

4. quiz-master 폴더에서 배포: `npx vercel`

5. 환경 변수 설정 (서버 URL은 D3 후 업데이트):
   ```bash
   npx vercel env add VITE_API_URL production
   npx vercel env add VITE_SOCKET_URL production
   ```

6. 프로덕션 배포: `npx vercel --prod`

7. Commit: `feat(D2): add vercel.json for SPA routing`

---

### Task D3: Railway 서버 배포

**수정 파일:** `server/package.json` (start 스크립트 + migrate)

**단계:**

1. `server/package.json` start 스크립트 추가/수정:
   ```json
   "start": "npx prisma migrate deploy && node dist/index.js"
   ```

2. Railway CLI 설치 + 로그인:
   ```bash
   npm install -g @railway/cli && railway login
   ```

3. server 폴더에서 Railway 프로젝트 초기화: `railway init`

4. PostgreSQL 서비스 추가 (Railway 대시보드 또는 CLI)

5. 환경 변수 설정:
   ```bash
   railway variables set ANTHROPIC_API_KEY=...
   railway variables set CORS_ORIGIN=https://your-app.vercel.app
   railway variables set NODE_ENV=production
   ```

6. 배포: `railway up`

7. Health check: `curl https://your-server.railway.app/health`

8. Vercel 환경 변수 업데이트 (실제 Railway URL로) + 재배포

9. Commit: `feat(D3): configure Railway deployment with production settings`

---

## 검증 체크리스트

### Phase A
- [ ] `npx prisma migrate dev --name add-difficulty` 성공
- [ ] `npm run build` (quiz-master + server) 에러 없음
- [ ] QuizPage에서 난이도 필터 버튼 4개 표시 + 필터링 동작
- [ ] `npx prisma db seed` → "✅ Seeded 20 questions"

### Phase C
- [ ] `npm run build` 에러 없음
- [ ] `npx prisma migrate dev --name add-active-room` 성공
- [ ] iOS Safari에서 안전 영역 패딩 적용
- [ ] 서버 재시작 후 `room:rejoin` → DB 복구 (수동 테스트)

### Phase D
- [ ] `https://<vercel-url>` 접속 → 앱 로딩
- [ ] `https://<vercel-url>/live/setup` 직접 접속 → 404 없음
- [ ] `curl https://<railway-url>/health` → `{"status":"ok",...}`
- [ ] 프로덕션 실시간 대전 게임 완주
- [ ] CORS 에러 없음

---

## 파일 변경 요약

| 파일 | 변경 |
|------|------|
| `quiz-master/src/types/index.ts` | Difficulty 타입 + Question.difficulty |
| `quiz-master/src/data/questions.ts` | difficulty 분류 |
| `quiz-master/src/pages/QuizPage.tsx` | 난이도 필터 UI |
| `quiz-master/src/lib/socket.ts` | VITE_SOCKET_URL env var |
| `quiz-master/src/lib/api.ts` | VITE_API_URL env var |
| `quiz-master/index.html` | viewport-fit=cover |
| `quiz-master/src/index.css` | safe area + touch targets |
| `quiz-master/vercel.json` | SPA routing rewrite (NEW) |
| `quiz-master/.env.example` | env var 템플릿 (NEW) |
| `server/prisma/schema.prisma` | difficulty + ActiveRoom 모델 |
| `server/prisma/seed.ts` | QuestionCache 시드 (NEW) |
| `server/src/lib/claude.ts` | difficulty in interface + prompt |
| `server/src/data/fallbackQuestions.ts` | difficulty 필드 |
| `server/src/data/roomStore.ts` | persist/restore/delete DB 함수 |
| `server/src/lib/socketManager.ts` | room:rejoin DB 복구 |
| `server/src/index.ts` | CORS_ORIGIN env var |
| `server/package.json` | seed script + start with migrate |
