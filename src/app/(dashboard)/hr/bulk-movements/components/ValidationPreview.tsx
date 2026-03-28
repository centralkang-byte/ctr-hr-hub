'use client'

// ═══════════════════════════════════════════════════════════
// ValidationPreview — 검증 결과 요약 + 에러/미리보기 테이블
// ═══════════════════════════════════════════════════════════

import { cn } from '@/lib/utils'
import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ValidateResponse } from '@/lib/bulk-movement/types'

interface ValidationPreviewProps {
  result: ValidateResponse
}

export function ValidationPreview({ result }: ValidationPreviewProps) {
  const errorCount = result.errors.filter((e) => e.severity === 'error').length
  const warningCount = result.errors.filter((e) => e.severity === 'warning').length

  return (
    <div className="space-y-4">
      {/* 요약 배너 */}
      <Card
        className={cn(
          'border-l-4',
          result.valid ? 'border-l-green-500' : 'border-l-destructive'
        )}
      >
        <CardContent className="flex items-center gap-3 p-4">
          {result.valid ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          )}
          <div className="text-sm">
            <p className="font-medium">
              {result.valid
                ? `검증 완료: ${result.validRows}/${result.totalRows}건 처리 가능`
                : `검증 실패: ${errorCount}건의 오류가 발견되었습니다`}
            </p>
            {warningCount > 0 && (
              <p className="text-muted-foreground mt-0.5">
                경고 {warningCount}건
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 에러 목록 테이블 */}
      {result.errors.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              오류 및 경고 목록
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">행</TableHead>
                  <TableHead className="w-24">컬럼</TableHead>
                  <TableHead>메시지</TableHead>
                  <TableHead className="w-20">구분</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.errors.map((err, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm">{err.row}</TableCell>
                    <TableCell className="text-sm font-mono tabular-nums">
                      {err.column}
                    </TableCell>
                    <TableCell className="text-sm">{err.message}</TableCell>
                    <TableCell>
                      {err.severity === 'error' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" />
                          오류
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          경고
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 미리보기 테이블 */}
      {result.preview.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              데이터 미리보기
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-24">사번</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>현재 값</TableHead>
                  <TableHead>변경 값</TableHead>
                  <TableHead className="w-16">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.preview.map((row) => (
                  <TableRow key={row.rowNum}>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.rowNum}
                    </TableCell>
                    <TableCell className="text-sm font-mono tabular-nums">
                      {row.employeeNo}
                    </TableCell>
                    <TableCell className="text-sm">{row.employeeName}</TableCell>
                    <TableCell className="text-sm">{row.currentValue}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {row.newValue}
                    </TableCell>
                    <TableCell>
                      {row.status === 'valid' && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {row.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      {row.status === 'warning' && (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
