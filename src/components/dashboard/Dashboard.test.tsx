import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dashboard } from './Dashboard'

describe('Dashboard', () => {
  it('shows an actionable empty state without invalid numeric values', () => {
    const onAddExpense = vi.fn()
    render(<Dashboard expenses={[]} categories={[]} total={0} categoryTotals={[]} onNavigate={vi.fn()} onAddExpense={onAddExpense} />)

    expect(screen.getByText('Brak wydatków')).toBeInTheDocument()
    expect(screen.getByText('Średnio —')).toBeInTheDocument()
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj pierwszy wydatek' }))
    expect(onAddExpense).toHaveBeenCalledOnce()
  })
})
