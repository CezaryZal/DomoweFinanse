import type { Category } from './types'

export const defaultCategories: Omit<Category, 'id'>[] = [
  { name: 'Żywność', color: '#2f91ed', icon: 'basket' },
  { name: 'Dom i rachunki', color: '#f48a3c', icon: 'home' },
  { name: 'Transport', color: '#55bd7a', icon: 'car' },
  { name: 'Zdrowie', color: '#bd6bd4', icon: 'heart' },
  { name: 'Rozrywka', color: '#ed6aa8', icon: 'sparkles' },
]
