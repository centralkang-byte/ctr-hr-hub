'use client'

import { useEffect, useState } from 'react'
import { Loader2, FolderTree, ChevronRight } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Dept {
  id: string
  code: string
  name: string
  nameEn?: string
  level: number
  parentId?: string | null
  _count?: { children?: number; employees?: number }
}

interface Props { companyId: string | null }

export function DepartmentsTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [depts, setDepts] = useState<Dept[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/org/departments?limit=200')
      .then((res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = (res as any)?.data ?? res ?? []
        setDepts(Array.isArray(list) ? list : [])
      })
      .catch(() => setDepts([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1C1D21]">{t('department_keab5acec')}</h3>
        <p className="text-sm text-[#8181A5]">등록된 부서 {depts.length}개</p>
      </div>

      {depts.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full">
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{t('kr_kecbd94eb')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('department_persons')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_kec9881eb')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_keba088eb')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_ked9598ec_department')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_kec868cec_kec9db8ec')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F3]">
              {depts.map((d) => (
                <tr key={d.id} className="hover:bg-[#F5F5FA] transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-[#5E81F4]">{d.code}</td>
                  <td className={TABLE_STYLES.cell}>
                    <span style={{ paddingLeft: `${(d.level - 1) * 16}px` }} className="flex items-center gap-1">
                      {d.level > 1 && <ChevronRight className="h-3 w-3 text-[#8181A5]" />}
                      {d.name}
                    </span>
                  </td>
                  <td className={TABLE_STYLES.cellMuted}>{d.nameEn ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-sm text-[#8181A5]">L{d.level}</td>
                  <td className="px-4 py-3 text-center text-sm text-[#8181A5]">{d._count?.children ?? 0}</td>
                  <td className="px-4 py-3 text-center text-sm text-[#8181A5]">{d._count?.employees ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#F0F0F3] py-12 text-center">
          <FolderTree className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" />
          <p className="text-sm font-medium text-[#1C1D21]">{t('register_keb909c_kebb680ec_kec9786ec')}</p>
        </div>
      )}
    </div>
  )
}
