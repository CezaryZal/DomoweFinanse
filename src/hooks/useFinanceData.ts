import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { defaultCategories } from '../data'
import { createCategory, createExpense, deleteExpense, listCategories, listExpenses } from '../lib/finance'
import type { Category, Expense, Feedback } from '../types'

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
    return 'Taka kategoria już istnieje.'
  }

  return error instanceof Error && error.message ? error.message : fallback
}

export function useFinanceData(session: Session | null) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setLoading] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  useEffect(() => {
    const userId = session?.user.id ?? ''
    if (!userId) {
      setExpenses([])
      setCategories([])
      return
    }

    async function loadData() {
      setLoading(true)
      setError('')

      try {
        let loadedCategories = await listCategories(userId)
        if (loadedCategories.length === 0) {
          loadedCategories = await Promise.all(defaultCategories.map((category) => createCategory(userId, category)))
        }

        const loadedExpenses = await listExpenses(userId)
        setCategories(loadedCategories)
        setExpenses(loadedExpenses)
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Nie udało się pobrać danych z bazy.'))
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [session?.user.id])

  async function addExpense(expense: Omit<Expense, 'id'>): Promise<boolean> {
    const userId = session?.user.id
    if (!userId) return false

    setSaving(true)
    setError('')
    try {
      const savedExpense = await createExpense(userId, expense)
      setExpenses((current) => [savedExpense, ...current])
      setFeedback({ type: 'success', message: 'Wydatek został zapisany.' })
      return true
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Nie udało się zapisać wydatku.'))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function addCategory(category: Omit<Category, 'id'>): Promise<boolean> {
    const userId = session?.user.id
    if (!userId) return false

    setSaving(true)
    setError('')
    try {
      const savedCategory = await createCategory(userId, category)
      setCategories((current) => [...current, savedCategory].sort((a, b) => a.name.localeCompare(b.name)))
      setFeedback({ type: 'success', message: 'Kategoria została dodana.' })
      return true
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Nie udało się zapisać kategorii.'))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function removeExpense(expenseId: string) {
    const userId = session?.user.id
    if (!userId) return

    setSaving(true)
    setError('')
    try {
      await deleteExpense(userId, expenseId)
      setExpenses((current) => current.filter((item) => item.id !== expenseId))
      setFeedback({ type: 'success', message: 'Wydatek został usunięty.' })
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Nie udało się usunąć wydatku.'))
    } finally {
      setSaving(false)
    }
  }

  function clearMessages() {
    setError('')
    setFeedback(null)
  }

  return { expenses, categories, isLoading, isSaving, error, feedback, addExpense, addCategory, removeExpense, clearMessages }
}
