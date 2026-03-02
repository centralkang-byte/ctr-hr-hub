// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bank Transfer Integration (Mock)
// ═══════════════════════════════════════════════════════════

// ─── Korean Bank Codes ───────────────────────────────────

export const BANK_CODES = {
  SHINHAN: { code: 'SHINHAN', name: '신한은행' },
  KOOKMIN: { code: 'KOOKMIN', name: '국민은행' },
  WOORI: { code: 'WOORI', name: '우리은행' },
  HANA: { code: 'HANA', name: '하나은행' },
  NH: { code: 'NH', name: '농협은행' },
  IBK: { code: 'IBK', name: '기업은행' },
  KEBHANA: { code: 'KEBHANA', name: 'KEB하나은행' },
  SC: { code: 'SC', name: 'SC제일은행' },
} as const

export type BankCode = keyof typeof BANK_CODES

// ─── Types ───────────────────────────────────────────────

export interface TransferItem {
  seq: number
  employeeName: string
  accountNumber: string
  amount: number
  accountHolder: string
}

export interface GenerateTransferFileParams {
  batchId: string
  bankCode: string
  format: 'CSV' | 'XML' | 'EBCDIC'
  items: TransferItem[]
}

export interface TransferResult {
  employeeId: string
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED'
  errorMessage?: string | null
  transferredAt?: string
}

// ─── Generate Transfer File (Mock) ───────────────────────

export function generateTransferFile(params: GenerateTransferFileParams): Buffer {
  const { bankCode, format, items } = params

  if (format === 'CSV') {
    const header = 'seq,employeeName,accountNumber,amount,accountHolder'
    const rows = items.map(
      (item) =>
        `${item.seq},${item.employeeName},${item.accountNumber},${item.amount},${item.accountHolder}`,
    )
    const csv = [header, ...rows].join('\n')
    return Buffer.from(csv, 'utf-8')
  }

  if (format === 'XML') {
    const xmlItems = items
      .map(
        (item) =>
          `  <transfer>
    <seq>${item.seq}</seq>
    <employeeName>${item.employeeName}</employeeName>
    <accountNumber>${item.accountNumber}</accountNumber>
    <amount>${item.amount}</amount>
    <accountHolder>${item.accountHolder}</accountHolder>
  </transfer>`,
      )
      .join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bankTransfer bankCode="${bankCode}">
${xmlItems}
</bankTransfer>`
    return Buffer.from(xml, 'utf-8')
  }

  // EBCDIC: return CSV as fallback for mock
  const header = 'seq,employeeName,accountNumber,amount,accountHolder'
  const rows = items.map(
    (item) =>
      `${item.seq},${item.employeeName},${item.accountNumber},${item.amount},${item.accountHolder}`,
  )
  return Buffer.from([header, ...rows].join('\n'), 'utf-8')
}

// ─── Parse Result File (Mock) ────────────────────────────

export function parseResultFile(
  _file: Buffer,
  _bankCode: string,
): TransferResult[] {
  // Mock implementation: in production this would parse the bank's result file
  // and return actual transfer results per employee.
  // For now, returns an empty array — callers should use the API body instead.
  return []
}
