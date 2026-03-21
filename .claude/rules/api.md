---
paths: ["src/app/api/**"]
---

# API Conventions

- Response helpers: `apiSuccess()`, `apiPaginated()`, `apiError()`
- Error class: `AppError` with factory functions (`notFound()`, `forbidden()`, etc.)
- Error messages in Korean
- Binary responses (file downloads): Use `new Response()` directly, not `NextResponse.json()`
