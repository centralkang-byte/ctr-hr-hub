// Stub for `@/lib/prisma` — prevents DB/server-only imports in unit tests
// Recursive proxy: prisma.employee.findMany() → Promise.resolve(null)
function createRecursiveProxy(): unknown {
  return new Proxy(() => Promise.resolve(null), {
    get: (_target, prop) => {
      if (prop === 'then') return undefined // not a thenable
      return createRecursiveProxy()
    },
  })
}

export const prisma = createRecursiveProxy()
