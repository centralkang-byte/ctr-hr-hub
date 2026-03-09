# Phase A1: 사이드바 IA 리팩토링 — Claude Code 세션 프롬프트

## 참조 문서 (세션 시작 시 반드시 읽기)
- `CLAUDE.md` §3 사이드바 IA — 7섹션 구조 + 역할 가시성 매트릭스 + NavSection/NavItem 타입
- `CTR_UI_PATTERNS.md` P13 — 섹션 기반 사이드바 패턴 (펼침/접힘/아코디언/플라이아웃/comingSoon)
- `context.md` — 현재 프로젝트 상태 + 코드베이스 통계

---

## 미션
현재 17개 flat NavGroup 사이드바를 **7섹션 역할 기반 IA**로 재구축한다.
라우팅 구조는 이번 세션에서 변경하지 않는다 (사이드바 + 권한 로직만 변경).

---

## 현재 상태 (AS-IS)

### 사이드바: `src/components/layout/Sidebar.tsx` (493줄)
- 17개 NavGroup (settings 포함), 모듈별 flat 나열
- `canAccessModule(module, 'read')` 기반 필터링
- SUPER_ADMIN 전체 접근, HR_ADMIN settings 접근
- countryFilter로 국가별 메뉴 필터링 (compliance 등)
- 접기/펼치기 지원 (w-16 / w-220px)

### RBAC 상수: `src/lib/constants.ts`
```
ROLE: SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE | EXECUTIVE
MODULE: employees, org, attendance, leave, recruitment, performance, payroll,
        compensation, offboarding, discipline, benefits, analytics, onboarding,
        training, pulse, succession, hr_chatbot, teams, compliance, settings
ACTION: read, create, update, delete, manage, export
```

### DB 스키마
- `roles` (id, code, name, is_system)
- `role_permissions` (role_id, permission_id) — 복합 유니크
- `employee_roles` (employee_id, role_id, company_id, start_date, end_date)

---

## 목표 상태 (TO-BE): 7섹션 구조

### 섹션 정의

```typescript
type SidebarSection = {
  key: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];  // 이 역할들에게 보임
  items: SidebarItem[];
};
```

### 1. 홈 (Home)
- **접근**: 모든 역할
- **내용**: 역할별 대시보드 (라우트: 기존 dashboard 유지)
- **현재 매핑**: 기존 대시보드 페이지

### 2. 나의 공간 (My Space)
- **접근**: EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE, SUPER_ADMIN
- **하위 메뉴**:
  - 내 프로필 → `/employees/[id]` (자기 프로필)
  - 출퇴근/근태 → `/attendance` (개인 뷰)
  - 휴가 → `/leave` (개인 신청/내역)
  - 내 목표/평가 → `/performance` (개인 뷰)
  - 복리후생 → `/benefits` (개인 신청)
  - 1:1/피드백 → `/performance/cfr` (CFR 직원 뷰)
- **현재 NavGroup 재활용**: 없음 (신규 구성, 기존 라우트 재활용)

### 3. 팀 관리 (Team)
- **접근**: MANAGER, EXECUTIVE, HR_ADMIN, SUPER_ADMIN
- **하위 메뉴**:
  - 팀 현황 → `/manager-hub`
  - 승인함 → `/manager-hub/approvals` (또는 신규)
  - 1:1 미팅 → `/performance/cfr` (CFR 매니저 뷰)
  - 팀 성과 → `/performance` (팀 뷰)
  - 팀 근태 → `/attendance` (팀 뷰)
- **현재 NavGroup**: managerHub 확장

### 4. 인사 운영 (HR Operations)
- **접근**: HR_ADMIN, SUPER_ADMIN
- **하위 메뉴**:
  - 직원 관리 → `/employees`
  - 조직 관리 → `/org`
  - 근태 관리 → `/attendance` (관리자 뷰)
  - 휴가 관리 → `/leave` (관리자 뷰)
  - 온보딩 → `/onboarding`
  - 오프보딩 → `/offboarding`
  - 급여 관리 → `/payroll`
  - 징계/포상 → `/discipline`
- **현재 NavGroup**: hrManagement, attendanceManagement, leaveManagement, onboarding, offboarding, payroll, discipline

### 5. 인재 관리 (Talent Management)
- **접근**: HR_ADMIN, SUPER_ADMIN
- **하위 메뉴**:
  - 채용 (ATS) → `/recruitment`
  - 성과 관리 → `/performance` (관리자 뷰)
  - 보상 관리 → `/compensation`
  - 복리후생 관리 → `/benefits` (관리자 뷰)
  - 교육/개발 → `/training`
  - 승계 계획 → `/succession`
  - 서베이 → 신규 또는 `/performance/surveys`
- **현재 NavGroup**: recruitmentManagement, performanceManagement, compensationSalary, benefitsWelfare, trainingManagement, successionPlanning

### 6. 인사이트 (Insights)
- **접근**: HR_ADMIN, SUPER_ADMIN (전체) / MANAGER, EXECUTIVE (일부)
- **하위 메뉴**:
  - HR 애널리틱스 → `/analytics`
  - AI 에이전트 → `/analytics/ai-chatbot` 또는 신규
  - People Directory → 신규 또는 `/employees/directory`
  - 컴플라이언스 → `/compliance` (국가별 필터 유지)
- **현재 NavGroup**: analyticsSection, compliance

### 7. 설정 (Settings)
- **접근**: HR_ADMIN, SUPER_ADMIN
- **내용**: 기존 settings 유지
- **현재 NavGroup**: systemSettings (30+ 하위 항목)

---

## 구현 명세

### 작업 범위 (이번 세션)
1. ✅ 사이드바 컴포넌트 재구축 (`Sidebar.tsx`)
2. ✅ 섹션 기반 네비게이션 config 파일 생성
3. ✅ 역할 기반 섹션 가시성 로직
4. ❌ 라우팅 구조 변경 (다음 세션)
5. ❌ 페이지 컴포넌트 수정 (다음 세션)

### 파일 변경 계획

#### 신규 생성
```
src/config/navigation.ts          — 7섹션 메뉴 구조 정의
src/hooks/useNavigation.ts        — 역할 기반 필터링 훅
```

#### 수정
```
src/components/layout/Sidebar.tsx  — 전면 재구축
```

#### 참조 (읽기만)
```
src/lib/constants.ts               — ROLE, MODULE 상수
src/types/index.ts                 — 타입 정의
```

### 핵심 구현 사항

#### 1. navigation.ts 구조
```typescript
// src/config/navigation.ts
import { 
  Home, User, Users, Building2, UserCheck, 
  BarChart3, Settings, /* ... */ 
} from 'lucide-react';

export type NavSection = {
  key: string;
  labelKey: string;           // i18n 키
  label: string;              // 폴백 레이블
  icon: React.ComponentType;
  visibleTo: string[];        // ROLE 코드 배열
  items: NavItem[];
};

export type NavItem = {
  key: string;
  labelKey: string;
  label: string;
  href: string;               // 기존 라우트 경로 유지
  icon?: React.ComponentType;
  module: string;             // canAccessModule 체크용
  badge?: 'new' | 'beta';
  comingSoon?: boolean;
  children?: NavItem[];       // 2depth 지원
  countryFilter?: string[];   // 국가별 필터 (compliance 등)
};

export const NAVIGATION: NavSection[] = [
  {
    key: 'home',
    labelKey: 'nav.home',
    label: '홈',
    icon: Home,
    visibleTo: ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE', 'SUPER_ADMIN'],
    items: [/* 대시보드 단일 항목 */],
  },
  {
    key: 'my-space',
    labelKey: 'nav.mySpace',
    label: '나의 공간',
    visibleTo: ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE', 'SUPER_ADMIN'],
    icon: User,
    items: [
      { key: 'my-profile', label: '내 프로필', href: '/employees/me', module: 'employees' },
      { key: 'my-attendance', label: '출퇴근', href: '/attendance/my', module: 'attendance' },
      { key: 'my-leave', label: '휴가', href: '/leave/my', module: 'leave' },
      { key: 'my-goals', label: '내 목표/평가', href: '/performance/my', module: 'performance' },
      { key: 'my-benefits', label: '복리후생', href: '/benefits/my', module: 'benefits' },
      { key: 'my-feedback', label: '1:1/피드백', href: '/performance/cfr/my', module: 'performance' },
    ],
  },
  // ... 나머지 5개 섹션
];
```

#### 2. 역할 기반 필터링 로직
```typescript
// src/hooks/useNavigation.ts
export function useNavigation() {
  const { user, permissions } = useAuth(); // 기존 인증 훅
  const userRole = user?.role || 'EMPLOYEE';
  
  const filteredSections = useMemo(() => {
    return NAVIGATION
      .filter(section => {
        // SUPER_ADMIN은 모든 섹션 접근
        if (userRole === 'SUPER_ADMIN') return true;
        return section.visibleTo.includes(userRole);
      })
      .map(section => ({
        ...section,
        items: section.items.filter(item => {
          // 기존 canAccessModule 로직 재활용
          return canAccessModule(item.module, 'read', permissions);
        }),
      }))
      .filter(section => section.items.length > 0);
  }, [userRole, permissions]);
  
  return { sections: filteredSections };
}
```

#### 3. Sidebar.tsx 재구축 핵심
- 기존 16개 NavGroup 제거 → `NAVIGATION` config 기반 렌더링
- 섹션 헤더 + 아코디언 (섹션별 접기/펼치기)
- 접힌 상태(w-16)에서는 섹션 아이콘만 표시, 호버 시 tooltip
- 펼친 상태(w-220px)에서 섹션 레이블 + 하위 항목 표시
- 현재 활성 섹션/항목 하이라이트 유지
- countryFilter 로직 유지 (compliance 메뉴)

---

## 디자인 가이드라인

### FLEX/Workday 참조 패턴
- 사이드바 섹션은 **시각적 구분선**으로 그룹핑 (배경색 차이 아님)
- 활성 항목: `bg-[#00C853] text-white rounded-lg`
- 섹션 헤더: `text-[11px] font-semibold text-[#888] uppercase tracking-wider`
- 호버 상태: `bg-[#222]`
- 섹션 구분선: `border-t border-[#333] mx-3`
- 아이콘: 18px, `text-[#CCC]` (활성 시 `text-white`)

### 접기 상태 UX
- 접힌 상태에서 섹션 아이콘 클릭 시 → 해당 섹션의 첫 번째 항목으로 이동
- 또는 플라이아웃 메뉴로 하위 항목 표시 (FLEX 스타일)

---

## 실행 순서

```
1. src/config/navigation.ts 생성 (7섹션 전체 정의)
2. src/hooks/useNavigation.ts 생성 (필터링 로직)
3. src/components/layout/Sidebar.tsx 재구축
4. 빌드 검증 (npm run build)
5. 역할별 메뉴 표시 테스트:
   - EMPLOYEE로 로그인 → 홈 + 나의 공간만 보이는지
   - MANAGER → + 팀 관리 + 인사이트(일부)
   - HR_ADMIN → + 인사 운영 + 인재 관리 + 인사이트(전체) + 설정
   - SUPER_ADMIN → 전체
```

---

## 주의사항

1. **라우트 경로 유지**: `/my` 접미사 라우트가 아직 없으므로, 기존 경로 그대로 사용하고 주석으로 `// TODO: Phase A2에서 라우트 리팩토링` 표시
2. **기존 canAccessModule 함수 재활용**: 새로 만들지 말고 기존 권한 체크 함수 임포트
3. **i18n 키 구조**: `nav.{sectionKey}.{itemKey}` 패턴. 실제 번역은 나중에 추가
4. **comingSoon 표시**: 미구현 메뉴는 `comingSoon: true`로 마킹, UI에서 회색 + 잠금 아이콘
5. **settings 하위 30개 항목**: 기존 구조 그대로 가져옴 (이번에 리팩토링 안 함)
6. **접기/펼치기 상태**: localStorage 저장 기존 로직 유지

---

## 완료 기준

- [ ] 7섹션 사이드바 렌더링 정상
- [ ] EMPLOYEE 로그인 시 홈 + 나의 공간만 노출
- [ ] MANAGER 로그인 시 + 팀 관리 노출
- [ ] HR_ADMIN 로그인 시 전체 노출 (설정 포함)
- [ ] 접기/펼치기 동작 정상
- [ ] 국가 필터 동작 정상 (compliance)
- [ ] `npm run build` 에러 없음
- [ ] 기존 페이지 접근 경로 깨지지 않음
- [ ] context.md 업데이트 완료

---

## 세션 마무리 (반드시 실행)

### context.md 업데이트
세션 완료 후 `context.md`에 아래 내용을 반영한다:

1. **리팩토링 마스터플랜 진행 현황** — A1 상태를 `✅ 완료`로 변경
2. **A1 작업 결과 섹션 추가:**
   - 변경/생성된 파일 목록 + 줄 수
   - 빌드 검증 결과 (`tsc`, `npm run build`)
   - 역할별 테스트 결과
   - 발견된 이슈 / 다음 세션(A2)에 전달할 사항
3. **다음 작업** — A2 상태를 `🔄 다음 실행 대기`로 변경
4. **코드베이스 통계** — 페이지 수 등 변경 사항 반영
