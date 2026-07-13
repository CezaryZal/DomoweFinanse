import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { defaultCategories } from '../data'
import { createCategory, createExpense, deleteExpense, listCategories, listExpenses, updateCategory, updateExpense } from '../lib/finance'
import type { Category, Expense, Feedback } from '../types'

function getErrorMessage(error: unknown, fallback: string, duplicateMessage = 'Taka wartość już istnieje.'): string {
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
    return duplicateMessage
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
      setError(getErrorMessage(saveError, 'Nie udało się zapisać kategorii.', 'Taka kategoria już istnieje.'))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function editExpense(expenseId: string, expense: Omit<Expense, 'id'>): Promise<boolean> {
    const userId = session?.user.id
    if (!userId) return false

    setSaving(true)
    setError('')
    try {
      const savedExpense = await updateExpense(userId, expenseId, expense)
      setExpenses((current) => current.map((item) => item.id === expenseId ? savedExpense : item))
      setFeedback({ type: 'success', message: 'Wydatek został zaktualizowany.' })
      return true
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Nie udało się zaktualizować wydatku.'))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function editCategory(categoryId: string, category: Omit<Category, 'id'>): Promise<boolean> {
    const userId = session?.user.id
    if (!userId) return false

    setSaving(true)
    setError('')
    try {
      const savedCategory = await updateCategory(userId, categoryId, category)
      setCategories((current) => current.map((item) => item.id === categoryId ? savedCategory : item).sort((a, b) => a.name.localeCompare(b.name)))
      setFeedback({ type: 'success', message: 'Kategoria została zaktualizowana.' })
      return true
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Nie udało się zaktualizować kategorii.', 'Taka kategoria już istnieje.'))
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

  async function refreshExpenses() {
    const userId = session?.user.id
    if (!userId) return

    try {
      setExpenses(await listExpenses(userId))
    } catch (refreshError) {
      setError(getErrorMessage(refreshError, 'Nie udało się odświeżyć wydatków.'))
    }
  }

  function clearMessages() {
    setError('')
    setFeedback(null)
  }

  return { expenses, categories, isLoading, isSaving, error, feedback, addExpense, addCategory, editExpense, editCategory, removeExpense, refreshExpenses, clearMessages }
}
