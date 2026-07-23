import { supabase } from './supabase'
import type { Category, Expense, ReceiptParserVariant } from '../types'

const receiptParserVariants: ReceiptParserVariant[] = ['rules', 'qwen', 'gemini']

function isReceiptParserVariant(value: string | null | undefined): value is ReceiptParserVariant {
  return value !== undefined && value !== null && receiptParserVariants.includes(value as ReceiptParserVariant)
}

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
  receipts: Array<{ receipt_items: Array<{ category_id: string | null; name: string; total_price: number | string }> | null }> | null
}

function mapCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, color: row.color, icon: row.icon }
}

function mapExpense(row: ExpenseRow): Expense {
  const receiptItems = row.receipts?.[0]?.receipt_items ?? []
  const categoryBreakdown = receiptItems.reduce<NonNullable<Expense['receipt']>['categoryBreakdown']>((groups, item) => {
    const existing = groups.find((group) => group.categoryId === item.category_id)
    if (existing) { existing.itemCount += 1; existing.total += Number(item.total_price); return groups }
    groups.push({ categoryId: item.category_id, itemCount: 1, total: Number(item.total_price) })
    return groups
  }, [])
  return {
    id: row.id,
    merchant: row.merchant,
    amount: Number(row.amount),
    currency: row.currency,
    date: row.spent_at,
    categoryId: row.category_id ?? '',
    notes: row.notes,
    source: row.source,
    receipt: receiptItems.length ? { itemCount: receiptItems.length, categoryBreakdown, productNames: receiptItems.map((item) => item.name) } : undefined,
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
    .select('id, merchant, amount, currency, spent_at, category_id, notes, source, receipts!receipts_expense_id_user_id_fkey(receipt_items(category_id, name, total_price))')
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

export async function getReceiptParserVariant(userId: string): Promise<ReceiptParserVariant> {
  const { data, error } = await supabase.from('user_receipt_settings').select('parser_variant').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return isReceiptParserVariant(data?.parser_variant) ? data.parser_variant : 'rules'
}

export async function saveReceiptParserVariant(userId: string, parserVariant: ReceiptParserVariant): Promise<ReceiptParserVariant> {
  if (!isReceiptParserVariant(parserVariant)) throw new Error('Wybrano nieobsługiwany parser paragonów.')
  const { data, error } = await supabase
    .from('user_receipt_settings')
    .upsert({ user_id: userId, parser_variant: parserVariant, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('parser_variant')
    .single()
  if (error) throw error
  if (!isReceiptParserVariant(data?.parser_variant)) throw new Error('Nie udało się potwierdzić zapisu ustawienia parsera.')
  return data.parser_variant
}
