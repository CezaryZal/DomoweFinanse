import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExpenseList } from './ExpenseList'
import type { Expense } from '../../types'

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
  it('does not delete an expense without confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onDelete = vi.fn()
    render(<ExpenseList expenses={[expense]} categories={[]} onDelete={onDelete} />)

    fireEvent.click(screen.getByRole('button', { name: 'Usuń wydatek Biedronka' }))

    expect(confirm).toHaveBeenCalledOnce()
    expect(onDelete).not.toHaveBeenCalled()
    confirm.mockRestore()
  })
})
