import http from 'k6/http'

/**
 * Authenticate via NextAuth credentials provider and extract session cookie.
 * Call this in setup() to avoid rate-limiting (10 req/min per IP).
 *
 * @param {string} baseUrl - e.g. https://ctr-hr-hub-staging.vercel.app
 * @param {string} email   - e.g. hr@ctr.co.kr
 * @returns {string|null} session cookie value, or null on failure
 */
export function login(baseUrl, email) {
  // 1. GET CSRF token from NextAuth
  const csrfRes = http.get(`${baseUrl}/api/auth/csrf`)
  const csrfToken = csrfRes.json('csrfToken')

  // 2. POST credentials login
  const loginRes = http.post(
    `${baseUrl}/api/auth/callback/credentials`,
    { email, csrfToken, json: 'true' },
    { redirects: 0 }
  )

  // NextAuth returns 302 on success, sets session cookie automatically
  if (loginRes.status !== 200 && loginRes.status !== 302) {
    console.error(`Login failed for ${email}: ${loginRes.status}`)
    return null
  }

  // Extract session cookie from the jar
  const jar = http.cookieJar()
  const cookies = jar.cookiesForURL(baseUrl)
  // Production uses __Secure-next-auth.session-token, dev uses next-auth.session-token
  return cookies['__Secure-next-auth.session-token']?.[0]
    || cookies['next-auth.session-token']?.[0]
    || null
}

/**
 * Set the session cookie for the current VU from a pre-authenticated token.
 * Call this at the start of the default function with token from setup().
 */
export function setSession(baseUrl, token, isSecure) {
  const jar = http.cookieJar()
  const cookieName = isSecure
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'
  jar.set(baseUrl, cookieName, token, { path: '/' })
}
