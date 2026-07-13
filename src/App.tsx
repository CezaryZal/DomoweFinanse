import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Plus } from 'lucide-react'
import { AuthScreen } from './auth/AuthScreen'
import { CategoryModal, ExpenseModal } from './components/common/ModalForms'
import { FeedbackBanner } from './components/common/FeedbackBanner'
import { CategoriesPage } from './components/categories/CategoriesPage'
import { Dashboard } from './components/dashboard/Dashboard'
import { Sidebar, Topbar } from './components/layout/AppChrome'
import { ExpensesPage } from './components/expenses/ExpensesPage'
import { ReceiptsPage } from './components/receipts/ReceiptsPage'
import { calculateCategoryTotals, calculateTotal } from './lib/finance-calculations'
import { supabase } from './lib/supabase'
import { useFinanceData } from './hooks/useFinanceData'
import type { Category, Expense, View } from './types'

function App() {
  const [view, setView] = useState<View>('dashboard')
  const [session, setSession] = useState<Session | null>(null)
  const [isAuthReady, setAuthReady] = useState(false)
  const [isExpenseOpen, setExpenseOpen] = useState(false)
  const [isCategoryOpen, setCategoryOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const { expenses, categories, isLoading, isSaving, error, feedback, addExpense, addCategory, editExpense, editCategory, removeExpense, refreshExpenses, clearMessages } = useFinanceData(session)

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setAuthReady(true)
    }

    void loadSession()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const total = useMemo(() => calculateTotal(expenses), [expenses])
  const categoryTotals = useMemo(() => calculateCategoryTotals(categories, expenses), [categories, expenses])

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (!isAuthReady) return <main className="auth-page"><div className="auth-loading">Sprawdzanie sesji…</div></main>
  if (!session) return <AuthScreen />
  if (isLoading) return <main className="auth-page"><div className="auth-loading">Pobieranie danych…</div></main>

  return <div className="app-shell">
    <Sidebar activeView={view} onNavigate={setView} onSignOut={() => void signOut()} />
    <main className="main-content">
      <FeedbackBanner feedback={feedback} error={error} onDismiss={clearMessages} />
      <Topbar onAddExpense={openNewExpense} onOpenReceipt={() => setView('receipts')} onMenu={() => setView('dashboard')} userEmail={session.user.email ?? ''} onSignOut={() => void signOut()} />
      {view === 'dashboard' && <Dashboard expenses={expenses} categories={categories} total={total} categoryTotals={categoryTotals} onNavigate={setView} onAddExpense={openNewExpense} />}
      {view === 'expenses' && <ExpensesPage expenses={expenses} categories={categories} onAdd={openNewExpense} onDelete={(id) => void removeExpense(id)} onEdit={openExpenseEditor} />}
      {view === 'categories' && <CategoriesPage categories={categories} categoryTotals={categoryTotals} onAdd={openNewCategory} onEdit={openCategoryEditor} />}
      {view === 'receipts' && <ReceiptsPage userId={session.user.id} categories={categories} onExpenseCreated={() => void refreshExpenses()} />}
    </main>
    {isExpenseOpen && <ExpenseModal key={editingExpense?.id ?? 'new-expense'} categories={categories} initialExpense={editingExpense} isSaving={isSaving} onClose={closeExpenseModal} onSubmit={(expense) => void submitExpense(expense)} />}
    {isCategoryOpen && <CategoryModal key={editingCategory?.id ?? 'new-category'} initialCategory={editingCategory} isSaving={isSaving} onClose={closeCategoryModal} onSubmit={(category) => void submitCategory(category)} />}
    <button className="mobile-add" onClick={openNewExpense} aria-label="Dodaj wydatek"><Plus size={22} /></button>
  </div>

  function openNewExpense() {
    setEditingExpense(null)
    setExpenseOpen(true)
  }

  function openExpenseEditor(expense: Expense) {
    setEditingExpense(expense)
    setExpenseOpen(true)
  }

  function closeExpenseModal() {
    setEditingExpense(null)
    setExpenseOpen(false)
  }

  async function submitExpense(expense: Omit<Expense, 'id'>) {
    const saved = editingExpense ? await editExpense(editingExpense.id, expense) : await addExpense(expense)
    if (saved) {
      closeExpenseModal()
      setView('expenses')
    }
  }

  function openNewCategory() {
    setEditingCategory(null)
    setCategoryOpen(true)
  }

  function openCategoryEditor(category: Category) {
    setEditingCategory(category)
    setCategoryOpen(true)
  }

  function closeCategoryModal() {
    setEditingCategory(null)
    setCategoryOpen(false)
  }

  async function submitCategory(category: Omit<Category, 'id'>) {
    const saved = editingCategory ? await editCategory(editingCategory.id, category) : await addCategory(category)
    if (saved) closeCategoryModal()
  }
}

export default App
