import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'
import { BASE_URL, PATHS } from './helpers/config.js'

/**
 * Cold start measurement — sequential requests with 5min idle between.
 * Run manually: k6 run tests/load/cold-start.js -e LOAD_TEST_BASE_URL=https://...
 *
 * Each iteration waits for idle timeout then measures first response.
 * k6 runs iterations sequentially (1 VU), so each gets a fresh cold start.
 */

const coldStartDuration = new Trend('cold_start_ms', true)

export const options = {
  vus: 1,
  iterations: 10,
  thresholds: {
    cold_start_ms: ['p(95)<3000'],
  },
}

export default function () {
  // Hit public health endpoint (no auth, minimal overhead) to measure pure function cold start
  // /api/health is in middleware PUBLIC_PATHS; /api/v1/monitoring/health requires auth
  const start = Date.now()
  const res = http.get(`${BASE_URL}/api/health`)
  const elapsed = Date.now() - start

  coldStartDuration.add(elapsed)

  check(res, {
    'health 200': (r) => r.status === 200,
    'cold start < 3s': () => elapsed < 3000,
  })

  console.log(`Iteration ${__ITER + 1}: health=${elapsed}ms (status=${res.status})`)

  // Wait 5 min between iterations to let Vercel function go cold
  // Skip wait on last iteration
  if (__ITER < 9) {
    sleep(300)
  }
}
