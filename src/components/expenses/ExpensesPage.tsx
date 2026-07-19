import { useMemo, useState } from 'react'
import { ChevronDown, Plus, Search } from 'lucide-react'
import type { Category, Expense } from '../../types'
import { PageTitle } from '../common/PageTitle'
import { ExpenseList } from './ExpenseList'

const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

export function ExpensesPage({ expenses, categories, expandedReceiptId, onOpenReceipt, onAdd, onDelete, onEdit }: { expenses: Expense[]; categories: Category[]; expandedReceiptId: string | null; onOpenReceipt: (id: string | null) => void; onAdd: () => void; onDelete: (id: string) => void; onEdit: (expense: Expense) => void }) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const visibleExpenses = useMemo(() => expenses.filter((expense) => {
    const normalisedQuery = query.toLocaleLowerCase('pl-PL')
    const matchesQuery = expense.merchant.toLocaleLowerCase('pl-PL').includes(normalisedQuery) || expense.receipt?.productNames.some((name) => name.toLocaleLowerCase('pl-PL').includes(normalisedQuery))
    const matchesCategory = !categoryId || expense.categoryId === categoryId || expense.receipt?.categoryBreakdown.some((group) => group.categoryId === categoryId)
    return matchesQuery && matchesCategory
  }), [categoryId, expenses, query])
  const visibleTotal = visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  return <div className="page"><PageTitle title="Wydatki" subtitle="Transakcje ręczne i paragony pogrupowane według sklepu" action={<button className="button primary" onClick={onAdd}><Plus size={17} />Dodaj wydatek</button>} /><div className="toolbar"><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj wydatku, sklepu lub produktu" aria-label="Szukaj wydatku, sklepu lub produktu" /></label><label className="filter-select"><span className="sr-only">Filtruj po kategorii</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Filtruj po kategorii"><option value="">Wszystkie kategorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><ChevronDown size={16} /></label></div><div className="panel"><div className="panel-header"><strong>{visibleExpenses.length} transakcji</strong><span>Łącznie {money.format(visibleTotal)}</span></div>{visibleExpenses.length ? <ExpenseList expenses={visibleExpenses} categories={categories} expandedReceiptId={expandedReceiptId} onReceiptOpen={(expense) => onOpenReceipt(expandedReceiptId === expense.id ? null : expense.id)} onDelete={onDelete} onEdit={onEdit} /> : <div className="list-empty">Brak wydatków spełniających kryteria.</div>}</div></div>
}
