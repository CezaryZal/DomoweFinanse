import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowLeft, ArrowRight, BarChart3, Bell, Bike, CalendarDays, Camera, CarFront, Check,
  ChevronDown, CircleHelp, CreditCard, FileText, Home, LayoutDashboard, Menu, Plus,
  ReceiptText, Search, Settings, ShoppingBasket, Sparkles, Tag, Trash2, Utensils, X,
} from 'lucide-react'
import { initialCategories, initialExpenses } from './data'
import type { Category, Expense, View } from './types'

const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })
const date = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' })

const iconMap = { basket: ShoppingBasket, home: Home, car: CarFront, heart: CircleHelp, sparkles: Sparkles }

function App() {
  const [view, setView] = useState<View>('dashboard')
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [isExpenseOpen, setExpenseOpen] = useState(false)
  const [isCategoryOpen, setCategoryOpen] = useState(false)

  const total = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses])
  const categoryTotals = useMemo(() => categories.map((category) => ({
    ...category,
    total: expenses.filter((expense) => expense.categoryId === category.id).reduce((sum, expense) => sum + expense.amount, 0),
  })).sort((a, b) => b.total - a.total), [categories, expenses])

  function addExpense(expense: Omit<Expense, 'id'>) {
    setExpenses((current) => [{ ...expense, id: crypto.randomUUID() }, ...current])
    setExpenseOpen(false)
    setView('expenses')
  }

  function addCategory(category: Omit<Category, 'id'>) {
    setCategories((current) => [...current, { ...category, id: crypto.randomUUID() }])
    setCategoryOpen(false)
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={view} onNavigate={setView} />
      <main className="main-content">
        <Topbar onAddExpense={() => setExpenseOpen(true)} onOpenReceipt={() => setView('receipts')} onMenu={() => setView('dashboard')} />
        {view === 'dashboard' && <Dashboard expenses={expenses} categories={categories} total={total} categoryTotals={categoryTotals} onNavigate={setView} />}
        {view === 'expenses' && <ExpensesPage expenses={expenses} categories={categories} onAdd={() => setExpenseOpen(true)} onDelete={(id) => setExpenses((current) => current.filter((item) => item.id !== id))} />}
        {view === 'categories' && <CategoriesPage categories={categories} categoryTotals={categoryTotals} onAdd={() => setCategoryOpen(true)} />}
        {view === 'receipts' && <ReceiptsPage onAdd={() => setView('receipts')} />}
        {view === 'login' && <LoginPage />}
      </main>
      {isExpenseOpen && <ExpenseModal categories={categories} onClose={() => setExpenseOpen(false)} onSubmit={addExpense} />}
      {isCategoryOpen && <CategoryModal onClose={() => setCategoryOpen(false)} onSubmit={addCategory} />}
      <button className="mobile-add" onClick={() => setExpenseOpen(true)} aria-label="Dodaj wydatek"><Plus size={22} /></button>
    </div>
  )
}

function Sidebar({ activeView, onNavigate }: { activeView: View; onNavigate: (view: View) => void }) {
  const items: { view: View; label: string; icon: typeof LayoutDashboard }[] = [
    { view: 'dashboard', label: 'Pulpit', icon: LayoutDashboard }, { view: 'expenses', label: 'Wydatki', icon: FileText },
    { view: 'receipts', label: 'Paragony', icon: ReceiptText }, { view: 'categories', label: 'Kategorie', icon: Tag },
  ]
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark"><BarChart3 size={18} /></span><span>Domowe<br /><strong>Finanse</strong></span></div>
    <nav>{items.map(({ view, label, icon: Icon }) => <button key={view} className={activeView === view ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate(view)}><Icon size={17} />{label}</button>)}</nav>
    <div className="sidebar-bottom"><button className="nav-item" onClick={() => onNavigate('login')}><Settings size={17} />Ustawienia</button><div className="household"><span className="avatar">K</span><div><small>Gospodarstwo</small><strong>Rodzina Kowalskich</strong><span>3 domowników</span></div></div></div>
  </aside>
}

function Topbar({ onAddExpense, onOpenReceipt, onMenu }: { onAddExpense: () => void; onOpenReceipt: () => void; onMenu: () => void }) {
  return <header className="topbar"><button className="mobile-menu" onClick={onMenu}><Menu size={21} /></button><div className="greeting"><span>Sobota, 11 lipca 2026</span><h1>Dzień dobry, Cezary</h1></div><div className="top-actions"><button className="button secondary" onClick={onAddExpense}><Plus size={17} />Dodaj wydatek</button><button className="button primary" onClick={onOpenReceipt}><Camera size={16} />Skanuj paragon</button><button className="icon-button" aria-label="Powiadomienia"><Bell size={19} /></button></div></header>
}

function Dashboard({ expenses, categories, total, categoryTotals, onNavigate }: { expenses: Expense[]; categories: Category[]; total: number; categoryTotals: (Category & { total: number })[]; onNavigate: (view: View) => void }) {
  const largest = categoryTotals[0]
  return <div className="page dashboard"><section className="page-heading"><div><span className="eyebrow">Wspólne wydatki gospodarstwa</span><h2>Przegląd finansów</h2></div><div className="month-selector"><ArrowLeft size={15} /><strong>Lipiec 2026</strong><ArrowRight size={15} /></div></section><section className="summary-grid"><SummaryCard label="Wydatki" value={money.format(total)} note="8% mniej niż w czerwcu" icon={<CreditCard />} /><SummaryCard label="Transakcje" value={String(expenses.length)} note={`Średnio ${money.format(total / expenses.length)}`} icon={<ArrowRight />} /><SummaryCard label="Największa kategoria" value={largest?.name ?? '—'} note={largest ? `${money.format(largest.total)} · ${Math.round(largest.total / total * 100)}%` : ''} icon={<ShoppingBasket />} /></section><section className="charts-grid"><SpendingChart total={total} /><CategoryChart categories={categoryTotals} total={total} /></section><section className="review-banner"><span className="review-icon"><Sparkles size={19} /></span><div><strong>3 paragony wymagają sprawdzenia</strong><span>AI oznaczyło tylko niepewne pozycje</span></div><button className="button secondary" onClick={() => onNavigate('receipts')}>Zobacz</button></section><section className="recent-section"><div className="section-header"><div><h3>Ostatnie wydatki</h3><span>najnowsze wpisy gospodarstwa</span></div><button className="text-button" onClick={() => onNavigate('expenses')}>Wszystkie wydatki <ArrowRight size={15} /></button></div><ExpenseList expenses={expenses.slice(0, 4)} categories={categories} compact /></section></div>
}

function SummaryCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: ReactNode }) { return <article className="summary-card"><div className="card-label"><span>{label}</span><span className="card-icon">{icon}</span></div><strong className="summary-value">{value}</strong><div className="summary-note">{note}</div><button className="details-button">Szczegóły</button></article> }

function SpendingChart({ total }: { total: number }) { const points = '0,112 42,103 84,99 126,83 168,79 210,65 252,55 294,45 336,28 378,20 420,8'; return <article className="chart-card"><div className="section-header"><div><h3>Wydatki w czasie</h3><span>Suma narastająco</span></div><span className="chart-pill">{money.format(total)}</span></div><div className="line-chart"><svg viewBox="0 0 430 135" role="img" aria-label="Wykres wydatków w czasie"><path d={`M${points} L420,130 L0,130 Z`} className="chart-area" /><polyline points={points} className="chart-line" />{points.split(' ').map((point) => { const [x, y] = point.split(','); return <circle key={point} cx={x} cy={y} r="3" className="chart-dot" /> })}</svg><div className="chart-labels"><span>1 lip</span><span>15 lip</span><span>31 lip</span></div></div><div className="chart-legend"><span>1–10</span><span>11–20</span><span>21–31</span></div></article> }

function CategoryChart({ categories, total }: { categories: (Category & { total: number })[]; total: number }) { const colors = categories.slice(0, 4).map((item) => item.color); const gradient = colors.length ? `conic-gradient(${colors.map((color, index) => `${color} ${index * 25}% ${(index + 1) * 25}%`).join(', ')})` : '#e5e7eb'; return <article className="category-chart"><div className="section-header"><div><h3>Kategorie</h3><span>Udział w wydatkach</span></div></div><div className="donut" style={{ background: gradient }}><div><strong>{money.format(total)}</strong><span>łącznie</span></div></div><div className="category-legend">{categories.slice(0, 4).map((category) => <span key={category.id}><i style={{ background: category.color }} />{category.name} {Math.round(category.total / total * 100)}%</span>)}</div></article> }

function ExpenseList({ expenses, categories, compact = false, onDelete }: { expenses: Expense[]; categories: Category[]; compact?: boolean; onDelete?: (id: string) => void }) { return <div className={`expense-list ${compact ? 'compact' : ''}`}>{expenses.map((expense) => { const category = categories.find((item) => item.id === expense.categoryId); const Icon = iconMap[category?.icon as keyof typeof iconMap] ?? Tag; return <div className="expense-row" key={expense.id}><span className="expense-icon" style={{ color: category?.color, background: `${category?.color}18` }}><Icon size={17} /></span><div className="expense-info"><strong>{expense.merchant}</strong><span>{date.format(new Date(`${expense.date}T12:00:00`))} · {category?.name ?? 'Bez kategorii'}</span></div><strong className="expense-amount">−{money.format(expense.amount)}</strong>{compact ? <button className="details-button">Szczegóły</button> : onDelete ? <button className="delete-button" onClick={() => onDelete(expense.id)} aria-label={`Usuń wydatek ${expense.merchant}`}><Trash2 size={16} /></button> : null}</div> })}</div> }

function ExpensesPage({ expenses, categories, onAdd, onDelete }: { expenses: Expense[]; categories: Category[]; onAdd: () => void; onDelete: (id: string) => void }) { return <div className="page"><PageTitle title="Wydatki" subtitle="Wszystkie wpisy gospodarstwa domowego" action={<button className="button primary" onClick={onAdd}><Plus size={17} />Dodaj wydatek</button>} /><div className="toolbar"><label className="search-field"><Search size={17} /><input placeholder="Szukaj wydatku lub sklepu" /></label><button className="filter-button">Wszystkie kategorie <ChevronDown size={16} /></button><button className="filter-button"><CalendarDays size={16} /> Lipiec 2026</button></div><div className="panel"><div className="panel-header"><strong>{expenses.length} wydatków</strong><span>Łącznie {money.format(expenses.reduce((sum, item) => sum + item.amount, 0))}</span></div><ExpenseList expenses={expenses} categories={categories} onDelete={onDelete} /></div></div> }

function CategoriesPage({ categories, categoryTotals, onAdd }: { categories: Category[]; categoryTotals: (Category & { total: number })[]; onAdd: () => void }) { return <div className="page"><PageTitle title="Kategorie" subtitle="Porządkuj wydatki według własnych zasad" action={<button className="button primary" onClick={onAdd}><Plus size={17} />Nowa kategoria</button>} /><div className="category-grid">{categories.map((category) => { const item = categoryTotals.find((entry) => entry.id === category.id); const Icon = iconMap[category.icon as keyof typeof iconMap] ?? Tag; return <article className="category-card" key={category.id}><span className="category-large-icon" style={{ background: `${category.color}18`, color: category.color }}><Icon size={22} /></span><div><strong>{category.name}</strong><span>{item?.total ? money.format(item.total) : 'Brak wydatków'}</span></div><small>{item ? `${Math.round(item.total / (categoryTotals.reduce((sum, entry) => sum + entry.total, 0) || 1) * 100)}% wszystkich wydatków` : 'Nowa kategoria'}</small></article> })}</div></div> }

function ReceiptsPage({ onAdd }: { onAdd: () => void }) { return <div className="page"><PageTitle title="Paragony" subtitle="Weryfikuj dane rozpoznane ze zdjęć" /><div className="receipt-empty"><span className="empty-icon"><Camera size={30} /></span><h3>Moduł skanowania paragonów</h3><p>W kolejnym etapie dodamy przesyłanie zdjęć, kolejkę przetwarzania oraz ekran korekty wyników OCR.</p><button className="button primary" onClick={onAdd}><Camera size={17} />Dodaj zdjęcie paragonu</button><small>To jest wersja demonstracyjna — zdjęcie nie zostanie jeszcze wysłane.</small></div></div> }

function LoginPage() { return <div className="login-page"><div className="login-card"><span className="brand-mark large"><BarChart3 size={23} /></span><h2>Witaj ponownie</h2><p>Zaloguj się, aby zobaczyć finanse swojego gospodarstwa.</p><label>Email<input type="email" placeholder="ty@example.com" /></label><label>Hasło<input type="password" placeholder="••••••••" /></label><button className="button primary full" onClick={(event) => event.preventDefault()}>Zaloguj się</button><span className="login-note">Integracja z Supabase Auth zostanie dodana w kolejnym etapie.</span></div></div> }

function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) { return <div className="page-title"><div><h2>{title}</h2><span>{subtitle}</span></div>{action}</div> }

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><h3>{title}</h3><button className="icon-button" onClick={onClose} aria-label="Zamknij"><X size={19} /></button></div>{children}</div></div> }

function ExpenseModal({ categories, onClose, onSubmit }: { categories: Category[]; onClose: () => void; onSubmit: (expense: Omit<Expense, 'id'>) => void }) { const [merchant, setMerchant] = useState(''); const [amount, setAmount] = useState(''); const [categoryId, setCategoryId] = useState(categories[0]?.id ?? ''); const [formError, setFormError] = useState(''); function submit(event: FormEvent) { event.preventDefault(); const parsedAmount = Number(amount.replace(',', '.')); if (!merchant.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) { setFormError('Podaj nazwę sklepu i kwotę większą od zera.'); return } onSubmit({ merchant: merchant.trim(), amount: parsedAmount, categoryId, date: new Date().toISOString().slice(0, 10) }) } return <ModalShell title="Dodaj wydatek" onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Sklep lub opis<input value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="np. Biedronka" autoFocus /></label><label>Kwota (PLN)<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></label><label>Kategoria<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>{formError && <div className="form-error">{formError}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Anuluj</button><button className="button primary" type="submit"><Check size={17} />Zapisz wydatek</button></div></form></ModalShell> }

function CategoryModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (category: Omit<Category, 'id'>) => void }) { const [name, setName] = useState(''); const [formError, setFormError] = useState(''); function submit(event: FormEvent) { event.preventDefault(); if (!name.trim()) { setFormError('Podaj nazwę kategorii.'); return } onSubmit({ name: name.trim(), color: '#7d72ea', icon: 'tag' }) } return <ModalShell title="Nowa kategoria" onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Nazwa kategorii<input value={name} onChange={(event) => setName(event.target.value)} placeholder="np. Zwierzęta" autoFocus /></label>{formError && <div className="form-error">{formError}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Anuluj</button><button className="button primary" type="submit"><Check size={17} />Dodaj kategorię</button></div></form></ModalShell> }

export default App
