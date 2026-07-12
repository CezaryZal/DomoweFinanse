import { useMemo, useState } from 'react'
import { ChevronDown, Plus, Search } from 'lucide-react'
import type { Category, Expense } from '../../types'
import { PageTitle } from '../common/PageTitle'
import { ExpenseList } from './ExpenseList'

const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

export function ExpensesPage({ expenses, categories, onAdd, onDelete, onEdit }: { expenses: Expense[]; categories: Category[]; onAdd: () => void; onDelete: (id: string) => void; onEdit: (expense: Expense) => void }) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const visibleExpenses = useMemo(() => expenses.filter((expense) => {
    const matchesQuery = expense.merchant.toLocaleLowerCase('pl-PL').includes(query.toLocaleLowerCase('pl-PL'))
    return matchesQuery && (!categoryId || expense.categoryId === categoryId)
  }), [categoryId, expenses, query])
  const visibleTotal = visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  return <div className="page"><PageTitle title="Wydatki" subtitle="Wszystkie zapisane wydatki" action={<button className="button primary" onClick={onAdd}><Plus size={17} />Dodaj wydatek</button>} /><div className="toolbar"><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj wydatku lub sklepu" aria-label="Szukaj wydatku lub sklepu" /></label><label className="filter-select"><span className="sr-only">Filtruj po kategorii</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Filtruj po kategorii"><option value="">Wszystkie kategorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><ChevronDown size={16} /></label></div><div className="panel"><div className="panel-header"><strong>{visibleExpenses.length} wydatków</strong><span>Łącznie {money.format(visibleTotal)}</span></div>{visibleExpenses.length ? <ExpenseList expenses={visibleExpenses} categories={categories} onDelete={onDelete} onEdit={onEdit} /> : <div className="list-empty">Brak wydatków spełniających kryteria.</div>}</div></div>
}
