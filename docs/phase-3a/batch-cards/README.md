# Phase 3a · Batch Cards Index

> Phase 3a audit batch 카드 list. 양식 SSOT = `docs/plans/active/2026-05-18-phase3a-audit.md`.
> Stage 1 우선순위 = `docs/plans/active/2026-05-18-phase3a-audit-stage1.md`.

| Batch | Surface | Status | Commit |
|---|---|---|---|
| 01 | 나의공간 — 휴가 (`/leave`) | done | `6f41d2cf` |
| 02 | 나의공간 — 근태 (`/attendance`) | done | `6632f06b` |
| 03 | 대시보드 (`/home`) | done | `27af20b8` |
| 04 | 직원 (employees) — list/detail/new/directory | done · gate passed | `9a940408` |
| 05 | 조직도 (`/org`) | done · gate passed | `7321f766` |
| 06 | 직원 경력 데이터 (Education/Certification/Activity) | reserved (격상 후보 — N+18 pre-flight) | — |
| 07 | 온보딩/오프보딩 | done · gate pending | (this commit) |

## 격상 후보 근거

- **batch 05 (org)**: 사용자 batch 04 옵션 1 선택 (list+detail+new+directory) 시 `/org` 분리 확정. 별도 batch 카드 작성 미 (TBD).
- **batch 06 (직원 경력 데이터)**: Stage 4 pre-flight (`docs/phase-3a/stage4-preflight/n18-7tab-alignment.md`) 결과 — Prisma 에 `EmployeeEducation` / `EmployeeCertification` / `EmployeeActivity` 모델 0건. N+18 graceful empty(A) 진입 시 별도 풀스택 batch 격상 후보. 진입 시점 = N+18 머지 후 사용자 피드백.

## 진입 순서 (현재 권고)

Stage 4 진입은 PR-5A 머지 (~2026-05-24 02:43 KST) 후. proto only → 코드베이스 포함 순:

1. N+21 (위저드 데모 한계 배너) — proto only
2. N+19 (data.js SSOT 5건) — proto only
3. N+20 (위저드 옵션 SSOT) — proto only
4. N+22 (상태 chip SSOT) — proto only
5. N+23 (proto 탭 a11y) — proto only (Stage 4 pre-flight 결과 코드베이스 작업 0 확정)
6. N+17 (/directory 흡수) — proto + 코드베이스
7. N+18 (7탭 정렬, graceful empty) — proto + 코드베이스

batch 06 = N+18 머지 + 1주 안정화 + 사용자 격상 결정 후 진입.

## 참조

- 양식 SSOT: `../plans/active/2026-05-18-phase3a-audit.md`
- Stage 1: `../plans/active/2026-05-18-phase3a-audit-stage1.md`
- Stage 4 pre-flight: `../stage4-preflight/README.md`
