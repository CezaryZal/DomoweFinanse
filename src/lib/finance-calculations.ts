import type { Category, Expense } from '../types'

export type CategoryTotal = Category & { total: number }

export function calculateTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0)
}

export function calculateCategoryTotals(categories: Category[], expenses: Expense[]): CategoryTotal[] {
  return categories
    .map((category) => ({
      ...category,
      total: expenses
        .filter((expense) => expense.categoryId === category.id)
        .reduce((sum, expense) => sum + expense.amount, 0),
    }))
    .sort((a, b) => b.total - a.total)
}

export function getLargestCategory(categoryTotals: CategoryTotal[]): CategoryTotal | undefined {
  return categoryTotals.find((category) => category.total > 0)
}

export function getCategoryShare(amount: number, total: number): number {
  if (total <= 0 || amount <= 0) return 0
  return Math.round((amount / total) * 100)
}

export function getAverageExpense(total: number, count: number): number | null {
  if (count <= 0) return null
  return total / count
}

export function buildSpendingPoints(expenses: Expense[]): string {
  if (expenses.length === 0) return ''

  const dailyTotals = new Map<string, number>()
  expenses.forEach((expense) => {
    dailyTotals.set(expense.date, (dailyTotals.get(expense.date) ?? 0) + expense.amount)
  })

  const values = [...dailyTotals.entries()]
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .slice(-11)
  let accumulated = 0
  const accumulatedValues = values.map(([, amount]) => {
    accumulated += amount
    return accumulated
  })
  const maximum = accumulatedValues.at(-1) ?? 0
  if (maximum <= 0) return ''

  return accumulatedValues
    .map((value, index) => {
      const x = values.length === 1 ? 0 : Math.round((index / (values.length - 1)) * 420)
      const y = Math.round(120 - (value / maximum) * 110)
      return `${x},${y}`
    })
    .join(' ')
}
