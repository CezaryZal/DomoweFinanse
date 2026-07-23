export type Category = {
  id: string
  name: string
  color: string
  icon: string
}

export type Expense = {
  id: string
  merchant: string
  amount: number
  currency: string
  date: string
  categoryId: string | null
  notes?: string | null
  source: 'manual' | 'receipt' | 'bank'
  receipt?: { itemCount: number; categoryBreakdown: Array<{ categoryId: string | null; itemCount: number; total: number }>; productNames: string[] }
}

export type View = 'dashboard' | 'expenses' | 'receipts' | 'categories' | 'settings'

export type Feedback = {
  type: 'error' | 'success'
  message: string
}

export type ReceiptParserVariant = 'rules' | 'qwen' | 'gemini'

export type ReceiptAnalysisMethod = 'ocr' | 'gemini'

export type ReceiptStatus = 'uploading' | 'ready_for_analysis' | 'queued' | 'processing' | 'needs_review' | 'approved' | 'failed'

export type ReceiptItem = {
  id: string
  categoryId: string | null
  lineNumber: number
  name: string
  quantity: number | null
  unitPrice: number | null
  totalPrice: number
  confidence: number | null
  sourceText: string | null
}

export type ReceiptItemDraft = {
  name: string
  categoryId: string | null
  quantity: number | null
  unitPrice: number | null
  totalPrice: number
}

export type Receipt = {
  id: string
  expenseId: string | null
  categoryId: string | null
  status: ReceiptStatus
  analysisMethod: ReceiptAnalysisMethod
  storagePath: string
  originalFilename: string
  merchant: string | null
  purchasedAt: string | null
  totalAmount: number | null
  currency: string
  confidence: number | null
  validationErrors: string[]
  parserVersion: string | null
  createdAt: string
  items: ReceiptItem[]
  jobStatus: 'pending' | 'processing' | 'completed' | 'failed' | null
  processingError: string | null
}

export type ReceiptReview = {
  merchant: string
  purchasedAt: string
  totalAmount: number
  categoryId: string | null
  items: ReceiptItemDraft[]
}
