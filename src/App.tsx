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
  const { expenses, categories, isLoading, isSaving, error, feedback, addExpense, addCategory, removeExpense, clearMessages } = useFinanceData(session)

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
      <Topbar onAddExpense={() => setExpenseOpen(true)} onOpenReceipt={() => setView('receipts')} onMenu={() => setView('dashboard')} userEmail={session.user.email ?? ''} onSignOut={() => void signOut()} />
      {view === 'dashboard' && <Dashboard expenses={expenses} categories={categories} total={total} categoryTotals={categoryTotals} onNavigate={setView} onAddExpense={() => setExpenseOpen(true)} />}
      {view === 'expenses' && <ExpensesPage expenses={expenses} categories={categories} onAdd={() => setExpenseOpen(true)} onDelete={(id) => void removeExpense(id)} />}
      {view === 'categories' && <CategoriesPage categories={categories} categoryTotals={categoryTotals} onAdd={() => setCategoryOpen(true)} />}
      {view === 'receipts' && <ReceiptsPage />}
    </main>
    {isExpenseOpen && <ExpenseModal categories={categories} isSaving={isSaving} onClose={() => setExpenseOpen(false)} onSubmit={(expense) => void submitExpense(expense)} />}
    {isCategoryOpen && <CategoryModal isSaving={isSaving} onClose={() => setCategoryOpen(false)} onSubmit={(category) => void submitCategory(category)} />}
    <button className="mobile-add" onClick={() => setExpenseOpen(true)} aria-label="Dodaj wydatek"><Plus size={22} /></button>
  </div>

  async function submitExpense(expense: Omit<Expense, 'id'>) {
    if (await addExpense(expense)) {
      setExpenseOpen(false)
      setView('expenses')
    }
  }

  async function submitCategory(category: Omit<Category, 'id'>) {
    if (await addCategory(category)) setCategoryOpen(false)
  }
}

export default App
