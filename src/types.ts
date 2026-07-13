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
}

export type View = 'dashboard' | 'expenses' | 'receipts' | 'categories'

export type Feedback = {
  type: 'error' | 'success'
  message: string
}

export type ReceiptStatus = 'uploading' | 'queued' | 'processing' | 'needs_review' | 'approved' | 'failed'

export type ReceiptItem = {
  id: string
  lineNumber: number
  name: string
  quantity: number | null
  unitPrice: number | null
  totalPrice: number
  confidence: number | null
  sourceText: string | null
}

export type Receipt = {
  id: string
  expenseId: string | null
  status: ReceiptStatus
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
}
