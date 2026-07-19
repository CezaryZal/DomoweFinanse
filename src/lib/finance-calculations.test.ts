import { describe, expect, it } from 'vitest'
import { buildSpendingPoints, calculateCategoryTotals, calculateTotal, getAverageExpense, getCategoryShare } from './finance-calculations'
import type { Category, Expense } from '../types'

const categories: Category[] = [
  { id: 'food', name: 'Żywność', color: '#2f91ed', icon: 'basket' },
  { id: 'home', name: 'Dom', color: '#f48a3c', icon: 'home' },
]

const expenses: Expense[] = [
  { id: '1', merchant: 'Sklep', amount: 20, currency: 'PLN', date: '2026-07-01', categoryId: 'food', source: 'manual' },
  { id: '2', merchant: 'Sklep', amount: 30, currency: 'PLN', date: '2026-07-02', categoryId: 'home', source: 'manual' },
]

describe('finance calculations', () => {
  it('returns safe values for an empty expense list', () => {
    expect(calculateTotal([])).toBe(0)
    expect(getAverageExpense(0, 0)).toBeNull()
    expect(getCategoryShare(0, 0)).toBe(0)
    expect(buildSpendingPoints([])).toBe('')
  })

  it('calculates totals and category shares from stored expenses', () => {
    expect(calculateTotal(expenses)).toBe(50)
    expect(calculateCategoryTotals(categories, expenses).map((category) => category.total)).toEqual([30, 20])
    expect(getCategoryShare(20, 50)).toBe(40)
    expect(getAverageExpense(50, 2)).toBe(25)
  })

  it('uses receipt item categories without counting the receipt total twice', () => {
    const receiptExpense: Expense = {
      id: '3', merchant: 'Sklep', amount: 50, currency: 'PLN', date: '2026-07-03', categoryId: null, source: 'receipt',
      receipt: { itemCount: 2, productNames: ['Chleb', 'Płyn'], categoryBreakdown: [{ categoryId: 'food', itemCount: 1, total: 20 }, { categoryId: 'home', itemCount: 1, total: 30 }] },
    }

    expect(calculateCategoryTotals(categories, [receiptExpense]).map((category) => category.total)).toEqual([30, 20])
  })

  it('builds cumulative chart points from expense dates', () => {
    expect(buildSpendingPoints(expenses)).toBe('0,76 420,10')
  })
})
