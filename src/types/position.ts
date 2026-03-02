export type PositionWithRelations = {
  id: string
  code: string
  titleKo: string
  titleEn: string
  companyId: string
  departmentId: string | null
  jobId: string | null
  jobGradeId: string | null
  reportsToPositionId: string | null
  dottedLinePositionId: string | null
  isHeadcount: boolean
  isActive: boolean
  job?: { titleKo: string; titleEn: string } | null
  department?: { name: string } | null
  jobGrade?: { name: string; rankOrder: number } | null
  reportsTo?: { id: string; titleKo: string; titleEn: string } | null
  directReports?: PositionWithRelations[]
}

export type PositionTreeNode = PositionWithRelations & {
  children: PositionTreeNode[]
}
