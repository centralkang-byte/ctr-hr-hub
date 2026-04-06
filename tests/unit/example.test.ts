import { describe, it, expect } from 'vitest'

describe('Vitest smoke test', () => {
  it('should pass basic arithmetic', () => {
    expect(1 + 1).toBe(2)
  })

  it('should resolve @/ alias (compile check)', async () => {
    // Verifies vitest.config.ts alias works
    // This import will fail if @ alias is misconfigured
    const mod = await import('@/lib/constants')
    expect(mod).toBeDefined()
  })
})
