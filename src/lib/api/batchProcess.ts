/**
 * batchProcess — 대용량 배열을 청크 단위로 순차 처리
 * N+1 문제 해결용: 큰 ID 배열을 50개씩 나눠 IN 쿼리 실행
 */
export async function batchProcess<T, R>(
  items: T[],
  fn: (chunk: T[]) => Promise<R[]>,
  batchSize = 50,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize)
    const chunkResults = await fn(chunk)
    results.push(...chunkResults)
  }
  return results
}
