import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExpenseList } from './ExpenseList'
import type { Category, Expense } from '../../types'

const categories: Category[] = [{ id: 'food', name: 'Żywność', color: '#2f91ed', icon: 'basket' }, { id: 'transport', name: 'Transport', color: '#37b86b', icon: 'car' }]

const expense: Expense = {
  id: 'expense-1',
  merchant: 'Biedronka',
  amount: 42,
  currency: 'PLN',
  date: '2026-07-12',
  categoryId: null,
  source: 'manual',
}

describe('ExpenseList', () => {
  it('shows a color-coded tag for manual expenses and receipt categories', () => {
    const receipt: Expense = { ...expense, id: 'receipt-1', source: 'receipt', receipt: { itemCount: 2, productNames: ['Chleb', 'Bilet'], categoryBreakdown: [{ categoryId: 'food', itemCount: 1, total: 12 }, { categoryId: 'transport', itemCount: 1, total: 30 }] } }
    render(<ExpenseList expenses={[{ ...expense, categoryId: 'food' }, receipt]} categories={categories} />)

    expect(screen.getAllByText('Żywność')).toHaveLength(2)
    expect(screen.getByText('Transport')).toHaveStyle({ color: '#37b86b' })
  })

  it('does not delete an expense without confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onDelete = vi.fn()
    render(<ExpenseList expenses={[expense]} categories={[]} onDelete={onDelete} />)

    fireEvent.click(screen.getByRole('button', { name: 'Usuń wydatek Biedronka' }))

    expect(confirm).toHaveBeenCalledOnce()
    expect(onDelete).not.toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('calls the edit handler for the selected expense', () => {
    const onEdit = vi.fn()
    render(<ExpenseList expenses={[expense]} categories={[]} onEdit={onEdit} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edytuj wydatek Biedronka' }))

    expect(onEdit).toHaveBeenCalledWith(expense)
  })
})
