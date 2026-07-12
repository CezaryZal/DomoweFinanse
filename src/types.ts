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
  categoryId: string
  notes?: string | null
  source: 'manual' | 'receipt' | 'bank'
}

export type View = 'dashboard' | 'expenses' | 'receipts' | 'categories'
