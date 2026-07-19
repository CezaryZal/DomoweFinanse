import { ChevronDown, ChevronUp, Pencil, ReceiptText, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { getCategoryIcon } from '../icons'
import type { Category, Expense } from '../../types'

const dateFormatter = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' })
const moneyFormatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

export function ExpenseList({ expenses, categories, compact = false, onDelete, onEdit, expandedReceiptId: requestedExpandedReceiptId, onReceiptOpen }: { expenses: Expense[]; categories: Category[]; compact?: boolean; onDelete?: (id: string) => void; onEdit?: (expense: Expense) => void; expandedReceiptId?: string | null; onReceiptOpen?: (expense: Expense) => void }) {
  const [localExpandedReceiptId, setLocalExpandedReceiptId] = useState<string | null>(null)
  const expandedReceiptId = requestedExpandedReceiptId ?? localExpandedReceiptId

  function toggleReceipt(expense: Expense) {
    if (onReceiptOpen) onReceiptOpen(expense)
    else setLocalExpandedReceiptId((current) => current === expense.id ? null : expense.id)
  }

  function requestDelete(expense: Expense) {
    if (onDelete && window.confirm(`Czy na pewno usunąć wydatek „${expense.merchant}”?`)) onDelete(expense.id)
  }

  return <div className={`expense-list ${compact ? 'compact' : ''}`}>{expenses.map((expense) => {
    const category = categories.find((item) => item.id === expense.categoryId)
    const Icon = getCategoryIcon(category?.icon)
    const isReceipt = Boolean(expense.receipt)
    const isExpanded = expandedReceiptId === expense.id

    return <div className={isReceipt ? 'expense-entry receipt-entry' : 'expense-entry'} key={expense.id}>
      <div className="expense-row" onClick={() => isReceipt && !compact && toggleReceipt(expense)}>
        {isReceipt ? <button className="expense-icon receipt-row-trigger" type="button" aria-label={`Pokaż szczegóły paragonu ${expense.merchant}`}><ReceiptText size={17} /></button> : <span className="expense-icon" style={{ color: category?.color, background: category ? `${category.color}18` : '#eef1f4' }}><Icon size={17} /></span>}
        <div className="expense-info"><strong>{expense.merchant}</strong><span>{dateFormatter.format(new Date(`${expense.date}T12:00:00`))} · {isReceipt ? `Paragon · ${expense.receipt?.itemCount} produktów` : 'Wydatek ręczny'}</span></div>
        <CategoryChips expense={expense} categories={categories} />
        <strong className="expense-amount">−{moneyFormatter.format(expense.amount)}</strong>
        {isReceipt && !compact ? <button className="text-button receipt-toggle" type="button" onClick={(event) => { event.stopPropagation(); toggleReceipt(expense) }}>{isExpanded ? <>Zwiń <ChevronUp size={15} /></> : <>Szczegóły <ChevronDown size={15} /></>}</button> : compact ? onEdit ? <button className="details-button" type="button" onClick={() => onEdit(expense)} aria-label={`Edytuj wydatek ${expense.merchant}`}>Szczegóły</button> : null : <>{onEdit && <button className="edit-button" type="button" onClick={() => onEdit(expense)} aria-label={`Edytuj wydatek ${expense.merchant}`}><Pencil size={16} /></button>}{onDelete && <button className="delete-button" type="button" onClick={() => requestDelete(expense)} aria-label={`Usuń wydatek ${expense.merchant}`}><Trash2 size={16} /></button>}</>}
      </div>
      {isReceipt && isExpanded && <div className="receipt-breakdown"><strong>Podział paragonu według kategorii</strong>{expense.receipt?.categoryBreakdown.map((group) => <div key={group.categoryId ?? 'none'}><span>{categories.find((item) => item.id === group.categoryId)?.name ?? 'Bez kategorii'}</span><span>{group.itemCount} produktów</span><b>{moneyFormatter.format(group.total)}</b></div>)}</div>}
    </div>
  })}</div>
}

function CategoryChips({ expense, categories }: { expense: Expense; categories: Category[] }) {
  const categoryIds = expense.receipt ? [...new Set(expense.receipt.categoryBreakdown.map((group) => group.categoryId))] : [expense.categoryId]
  return <div className="expense-category-chips" aria-label="Kategorie wydatku">{categoryIds.map((categoryId) => {
    const category = categories.find((item) => item.id === categoryId)
    return <span key={categoryId ?? 'none'} style={category ? { backgroundColor: `${category.color}20`, color: category.color } : undefined}>{category?.name ?? 'Bez kategorii'}</span>
  })}</div>
}
