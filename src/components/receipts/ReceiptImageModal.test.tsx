import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReceiptImageModal } from './ReceiptImageModal'

describe('ReceiptImageModal', () => {
  it('renders the original image and closes on Escape', () => {
    const onClose = vi.fn()

    render(<ReceiptImageModal filename="paragon.jpg" imageUrl="https://example.test/paragon.jpg" onClose={onClose} />)

    expect(screen.getByRole('img', { name: 'Oryginał paragonu paragon.jpg' })).toHaveAttribute('src', 'https://example.test/paragon.jpg')

    fireEvent.click(screen.getByRole('button', { name: 'Powiększ zdjęcie' }))

    expect(screen.getByText('Skala 125%')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
  })
})
