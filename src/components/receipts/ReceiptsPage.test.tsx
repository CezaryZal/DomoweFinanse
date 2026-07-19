import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReceiptsPage } from './ReceiptsPage'

const saveReview = vi.fn().mockResolvedValue(true)

vi.mock('../../hooks/useReceipts', () => ({
  useReceipts: () => ({
    receipts: [{
      id: 'receipt-1', expenseId: 'expense-1', categoryId: 'category-1', status: 'approved', storagePath: 'user/receipt.jpg',
      originalFilename: 'paragon.jpg', merchant: 'Sklep testowy', purchasedAt: '2026-07-19', totalAmount: 12.5, currency: 'PLN',
      confidence: null, validationErrors: [], parserVersion: 'rules', createdAt: '2026-07-19T10:00:00.000Z', jobStatus: 'completed', processingError: null,
      items: [{ id: 'item-1', categoryId: 'category-1', lineNumber: 0, name: 'Mleko', quantity: 1, unitPrice: 12.5, totalPrice: 12.5, confidence: 1, sourceText: 'MLEKO' }],
    }], imageUrls: {}, isLoading: false, isSaving: false, feedback: null, upload: vi.fn(), saveReview, approve: vi.fn(), remove: vi.fn(), clearFeedback: vi.fn(),
  }),
}))

describe('ReceiptsPage', () => {
  it('collapses an approved receipt and expands it for details and editing', () => {
    render(<ReceiptsPage userId="user-1" categories={[{ id: 'category-1', name: 'Żywność', color: '#fff', icon: 'basket' }]} onExpenseCreated={vi.fn()} />)

    expect(screen.queryByText('Mleko')).not.toBeInTheDocument()
    expect(screen.getAllByText((content) => content.includes('12,50'))).toHaveLength(2)
    expect(screen.getByText((content, element) => element?.tagName === 'SMALL' && content.includes('1 produkt') && content.includes('12,50'))).toBeInTheDocument()

    fireEvent.click(screen.getByText('Sklep testowy'))
    expect(screen.getByText('Mleko')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^edytuj$/i }))
    expect(screen.getByDisplayValue('Mleko')).toBeEnabled()
    expect(screen.getByRole('button', { name: /^zapisz$/i })).toBeInTheDocument()
  })
})
