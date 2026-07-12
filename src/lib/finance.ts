import { supabase } from './supabase'
import type { Category, Expense } from '../types'

type CategoryRow = { id: string; name: string; color: string; icon: string }
type ExpenseRow = {
  id: string
  merchant: string
  amount: number | string
  currency: string
  spent_at: string
  category_id: string | null
  notes: string | null
  source: Expense['source']
}

function mapCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, color: row.color, icon: row.icon }
}

function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    merchant: row.merchant,
    amount: Number(row.amount),
    currency: row.currency,
    date: row.spent_at,
    categoryId: row.category_id ?? '',
    notes: row.notes,
    source: row.source,
  }
}

export async function listCategories(userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, color, icon')
    .eq('user_id', userId)
    .order('name')

  if (error) throw error
  return (data as CategoryRow[]).map(mapCategory)
}

export async function listExpenses(userId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, merchant, amount, currency, spent_at, category_id, notes, source')
    .eq('user_id', userId)
    .order('spent_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as ExpenseRow[]).map(mapExpense)
}

export async function createCategory(userId: string, category: Omit<Category, 'id'>) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, name: category.name, color: category.color, icon: category.icon })
    .select('id, name, color, icon')
    .single()

  if (error) throw error
  return mapCategory(data as CategoryRow)
}

export async function updateCategory(userId: string, categoryId: string, category: Omit<Category, 'id'>) {
  const { data, error } = await supabase
    .from('categories')
    .update({ name: category.name, color: category.color, icon: category.icon, updated_at: new Date().toISOString() })
    .eq('id', categoryId)
    .eq('user_id', userId)
    .select('id, name, color, icon')
    .single()

  if (error) throw error
  return mapCategory(data as CategoryRow)
}

export async function createExpense(userId: string, expense: Omit<Expense, 'id'>) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: userId,
      merchant: expense.merchant,
      amount: expense.amount,
      currency: expense.currency,
      spent_at: expense.date,
      category_id: expense.categoryId || null,
      notes: expense.notes ?? null,
      source: expense.source,
    })
    .select('id, merchant, amount, currency, spent_at, category_id, notes, source')
    .single()

  if (error) throw error
  return mapExpense(data as ExpenseRow)
}

export async function updateExpense(userId: string, expenseId: string, expense: Omit<Expense, 'id'>) {
  const { data, error } = await supabase
    .from('expenses')
    .update({
      merchant: expense.merchant,
      amount: expense.amount,
      currency: expense.currency,
      spent_at: expense.date,
      category_id: expense.categoryId || null,
      notes: expense.notes ?? null,
      source: expense.source,
      updated_at: new Date().toISOString(),
    })
    .eq('id', expenseId)
    .eq('user_id', userId)
    .select('id, merchant, amount, currency, spent_at, category_id, notes, source')
    .single()

  if (error) throw error
  return mapExpense(data as ExpenseRow)
}

export async function deleteExpense(userId: string, expenseId: string) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('user_id', userId)

  if (error) throw error
}
