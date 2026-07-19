// Standalone integration harnesses execute server modules outside Next.js.
// Stub only the package marker; do not enable the global react-server condition.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('node:module')

const originalLoad = Module._load
Module._load = function load(request, parent, isMain) {
  if (request === 'server-only') return {}
  const loaded = originalLoad.call(this, request, parent, isMain)
  if (request === 'react' && typeof loaded.cache !== 'function') {
    return { ...loaded, cache: (operation) => operation }
  }
  return loaded
}
