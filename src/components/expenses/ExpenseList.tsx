import { Pencil, Trash2 } from 'lucide-react'
import { getCategoryIcon } from '../icons'
import type { Category, Expense } from '../../types'

const dateFormatter = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' })
const moneyFormatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

export function ExpenseList({ expenses, categories, compact = false, onDelete, onEdit }: { expenses: Expense[]; categories: Category[]; compact?: boolean; onDelete?: (id: string) => void; onEdit?: (expense: Expense) => void }) {
  function requestDelete(expense: Expense) {
    if (onDelete && window.confirm(`Czy na pewno usunąć wydatek „${expense.merchant}”?`)) onDelete(expense.id)
  }

  return <div className={`expense-list ${compact ? 'compact' : ''}`}>
    {expenses.map((expense) => {
      const category = categories.find((item) => item.id === expense.categoryId)
      const Icon = getCategoryIcon(category?.icon)
      return <div className="expense-row" key={expense.id}><span className="expense-icon" style={{ color: category?.color, background: category ? `${category.color}18` : '#eef1f4' }}><Icon size={17} /></span><div className="expense-info"><strong>{expense.merchant}</strong><span>{dateFormatter.format(new Date(`${expense.date}T12:00:00`))} · {category?.name ?? 'Bez kategorii'}</span></div><strong className="expense-amount">−{moneyFormatter.format(expense.amount)}</strong>{compact ? onEdit ? <button className="details-button" type="button" onClick={() => onEdit(expense)} aria-label={`Edytuj wydatek ${expense.merchant}`}>Szczegóły</button> : null : <>{onEdit && <button className="edit-button" type="button" onClick={() => onEdit(expense)} aria-label={`Edytuj wydatek ${expense.merchant}`}><Pencil size={16} /></button>}{onDelete && <button className="delete-button" type="button" onClick={() => requestDelete(expense)} aria-label={`Usuń wydatek ${expense.merchant}`}><Trash2 size={16} /></button>}</>}</div>
    })}
  </div>
}
