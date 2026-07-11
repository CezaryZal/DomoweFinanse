import type { Category, Expense } from './types'

export const initialCategories: Category[] = [
  { id: 'food', name: 'Żywność', color: '#2f91ed', icon: 'basket' },
  { id: 'home', name: 'Dom i rachunki', color: '#f48a3c', icon: 'home' },
  { id: 'transport', name: 'Transport', color: '#55bd7a', icon: 'car' },
  { id: 'health', name: 'Zdrowie', color: '#bd6bd4', icon: 'heart' },
  { id: 'entertainment', name: 'Rozrywka', color: '#ed6aa8', icon: 'sparkles' },
]

export const initialExpenses: Expense[] = [
  { id: '1', merchant: 'Biedronka', amount: 184.72, date: '2026-07-11', categoryId: 'food' },
  { id: '2', merchant: 'Orlen', amount: 286.4, date: '2026-07-10', categoryId: 'transport' },
  { id: '3', merchant: 'Apteka Gemini', amount: 73.18, date: '2026-07-09', categoryId: 'health' },
  { id: '4', merchant: 'Czynsz i media', amount: 913.25, date: '2026-07-06', categoryId: 'home' },
  { id: '5', merchant: 'Lidl', amount: 96.34, date: '2026-07-04', categoryId: 'food' },
]
