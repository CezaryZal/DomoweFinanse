import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CategoriesPage } from './CategoriesPage'
import type { Category } from '../../types'

const category: Category = { id: 'food', name: 'Żywność', color: '#2f91ed', icon: 'basket' }

describe('CategoriesPage', () => {
  it('opens category editing for the selected category', () => {
    const onEdit = vi.fn()
    render(<CategoriesPage categories={[category]} categoryTotals={[{ ...category, total: 12 }]} onAdd={vi.fn()} onEdit={onEdit} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edytuj' }))

    expect(onEdit).toHaveBeenCalledWith(category)
  })
})
