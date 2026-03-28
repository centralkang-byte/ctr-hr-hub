---
paths: ["src/app/**/*Client.tsx", "src/hooks/**"]
---

# Data Fetching 규칙

표준 원본: `src/lib/api.ts` (apiClient)

## Client-side 표준 패턴

```tsx
const [data, setData] = useState<T | null>(null)
const [loading, setLoading] = useState(true)

const fetchData = useCallback(async () => {
  try {
    setLoading(true)
    const res = await apiClient.get<T>('/api/v1/xxx')
    setData(res.data)
  } catch (err) {
    toast({
      title: '데이터 로드 실패',
      description: err instanceof Error ? err.message : '다시 시도해 주세요.',
      variant: 'destructive',
    })
  } finally {
    setLoading(false)
  }
}, [/* dependencies */])

useEffect(() => { fetchData() }, [fetchData])
```

## apiClient 메서드

| 메서드 | 용도 |
|--------|------|
| `apiClient.get<T>(url, params?)` | 단건 조회 |
| `apiClient.getList<T>(url, params?)` | 목록 (페이지네이션) |
| `apiClient.post<T>(url, body?)` | 생성 |
| `apiClient.put<T>(url, body?)` | 전체 수정 |
| `apiClient.patch<T>(url, body?)` | 부분 수정 |
| `apiClient.delete<T>(url)` | 삭제 |

## Server-side (API Route)

모든 API route는 `withPermission` 래퍼:

```tsx
export const GET = withPermission(
  async (req, _context, user) => {
    const { searchParams } = new URL(req.url)
    const companyId = resolveCompanyId(user, searchParams)
    // ... query
    return apiSuccess(data)
  },
  perm(MODULE.XXX, ACTION.VIEW)
)
```

## 금지

- raw `fetch()` 직접 사용 → `apiClient` 사용
- SWR, React Query, TanStack Query 도입 (기존 패턴 일관성)
- loading 상태 없이 데이터 렌더링
- try 없이 apiClient 호출 (에러 처리 필수)
