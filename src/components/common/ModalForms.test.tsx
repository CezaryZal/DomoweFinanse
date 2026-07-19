import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CategoryModal } from './ModalForms'

describe('CategoryModal', () => {
  it('keeps the existing icon and saves the selected color', () => {
    const onSubmit = vi.fn()
    render(<CategoryModal initialCategory={{ id: 'food', name: 'Żywność', color: '#2f91ed', icon: 'basket' }} isSaving={false} onClose={vi.fn()} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText('Kolor kategorii'), { target: { value: '#37b86b' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Żywność', color: '#37b86b', icon: 'basket' })
  })
})
