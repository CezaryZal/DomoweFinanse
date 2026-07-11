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
  date: string
  categoryId: string
}

export type View = 'dashboard' | 'expenses' | 'receipts' | 'categories' | 'login'
