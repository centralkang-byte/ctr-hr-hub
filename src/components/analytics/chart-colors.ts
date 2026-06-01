// @deprecated Phase 2 P2b-chart 에서 차트 카테고리색을 `@/lib/styles/chart`
// 단일 SSOT로 통합. 본 파일은 소비처 무변경 호환 shim — 신규 코드는
// `import { CHART_COLORS } from '@/lib/styles/chart'` 사용.
// Phase 3 페이지 마이그레이션 트랙에서 소비처 import 경로 정리하며 자연 제거.
// (CHART_COLORS_DARK 는 소비처 0 = 죽은 코드라 P2b에서 제거됨.)

export { CHART_COLORS } from '@/lib/styles/chart'
