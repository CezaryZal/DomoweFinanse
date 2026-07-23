import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category, Receipt } from '../../types'
import { ReceiptsPage } from './ReceiptsPage'

const mocks = vi.hoisted(() => ({
  useReceipts: vi.fn(),
  saveReview: vi.fn(),
  approve: vi.fn(),
  analyzeWithGemini: vi.fn(),
}))

vi.mock('../../hooks/useReceipts', () => ({
  useReceipts: mocks.useReceipts,
}))

const categories: Category[] = [{ id: 'category-1', name: 'Żywność', color: '#fff', icon: 'basket' }]

function makeReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: 'receipt-1',
    expenseId: null,
    categoryId: null,
    status: 'needs_review',
    analysisMethod: 'ocr',
    storagePath: 'user/receipt.jpg',
    originalFilename: 'paragon.jpg',
    merchant: 'Sklep testowy',
    purchasedAt: '2026-07-19',
    totalAmount: 12.5,
    currency: 'PLN',
    confidence: null,
    validationErrors: [],
    parserVersion: 'rules',
    createdAt: '2026-07-19T10:00:00.000Z',
    jobStatus: 'completed',
    processingError: null,
    items: [{ id: 'item-1', categoryId: 'category-1', lineNumber: 0, name: 'Mleko', quantity: 1, unitPrice: 12.5, totalPrice: 12.5, confidence: 1, sourceText: 'MLEKO' }],
    ...overrides,
  }
}

function receiptApi(receipts: Receipt[]) {
  return {
    receipts,
    imageUrls: {},
    isLoading: false,
    isSaving: false,
    feedback: null,
    upload: vi.fn(),
    analyzeWithGemini: mocks.analyzeWithGemini,
    saveReview: mocks.saveReview,
    approve: mocks.approve,
    remove: vi.fn(),
    clearFeedback: vi.fn(),
  }
}

function page(parserVariant: 'rules' | 'qwen' | 'gemini' = 'rules') {
  return <ReceiptsPage userId="user-1" categories={categories} parserVariant={parserVariant} onExpenseCreated={vi.fn()} />
}

describe('ReceiptsPage', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.saveReview.mockResolvedValue(true)
    mocks.approve.mockResolvedValue(true)
    mocks.analyzeWithGemini.mockResolvedValue(true)
  })

  it('collapses an approved receipt and expands it for details and editing', () => {
    mocks.useReceipts.mockReturnValue(receiptApi([makeReceipt({ status: 'approved', expenseId: 'expense-1' })]))
    render(page())

    expect(screen.queryByText('Mleko')).not.toBeInTheDocument()
    expect(screen.getAllByText((content) => content.includes('12,50'))).toHaveLength(2)
    expect(screen.getByText((content, element) => element?.tagName === 'SMALL' && content.includes('1 produkt') && content.includes('12,50'))).toBeInTheDocument()

    fireEvent.click(screen.getByText('Sklep testowy'))
    expect(screen.getByText('Mleko')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^edytuj$/i }))
    expect(screen.getByDisplayValue('Mleko')).toBeEnabled()
    expect(screen.getByRole('button', { name: /^zapisz$/i })).toBeInTheDocument()
  })

  it('shows lifecycle states and synchronizes the completed OCR result', () => {
    let currentReceipt = makeReceipt({ status: 'queued', merchant: null, purchasedAt: null, totalAmount: null, jobStatus: 'pending', items: [] })
    mocks.useReceipts.mockImplementation(() => receiptApi([currentReceipt]))
    const view = render(page())

    expect(screen.getByText('Oczekuje na OCR')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /zatwierdź jako wydatek/i })).not.toBeInTheDocument()

    currentReceipt = makeReceipt({ status: 'processing', merchant: null, purchasedAt: null, totalAmount: null, jobStatus: 'processing', items: [] })
    view.rerender(page())
    expect(screen.getByText('Analiza OCR')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /zapisz korektę/i })).not.toBeInTheDocument()

    currentReceipt = makeReceipt({ status: 'needs_review' })
    view.rerender(page())
    expect(screen.getByText('Do weryfikacji')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Sklep testowy')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Mleko')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /zapisz korektę/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /zatwierdź jako wydatek/i })).toBeEnabled()
  })

  it('shows Gemini analysis only for a new, not yet analyzed receipt when Gemini is selected', async () => {
    mocks.useReceipts.mockReturnValue(receiptApi([makeReceipt({ analysisMethod: 'gemini', status: 'ready_for_analysis', merchant: null, purchasedAt: null, totalAmount: null, jobStatus: null, items: [] })]))
    render(page('gemini'))

    expect(screen.getByText('Gotowy do analizy Gemini')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /analizuj przez gemini/i }))
    await waitFor(() => expect(mocks.analyzeWithGemini).toHaveBeenCalledWith('receipt-1'))
  })

  it('hides Gemini analysis when the selected parser is not Gemini', () => {
    mocks.useReceipts.mockReturnValue(receiptApi([makeReceipt({ analysisMethod: 'gemini', status: 'ready_for_analysis', merchant: null, purchasedAt: null, totalAmount: null, jobStatus: null, items: [] })]))
    render(page('rules'))

    expect(screen.queryByRole('button', { name: /analizuj przez gemini/i })).not.toBeInTheDocument()
  })

  it('uses Gemini labels after a Gemini receipt is queued without changing OCR labels', () => {
    mocks.useReceipts.mockReturnValue(receiptApi([
      makeReceipt({ id: 'gemini-1', analysisMethod: 'gemini', status: 'queued', merchant: null, purchasedAt: null, totalAmount: null, jobStatus: 'pending', items: [] }),
      makeReceipt({ id: 'ocr-1', analysisMethod: 'ocr', status: 'queued', merchant: null, purchasedAt: null, totalAmount: null, jobStatus: 'pending', items: [] }),
    ]))
    render(page('gemini'))

    expect(screen.getByText('Gotowy do analizy Gemini')).toBeInTheDocument()
    expect(screen.getByText('Oczekuje na OCR')).toBeInTheDocument()
    expect(screen.getByText('Dodaj zdjęcie do analizy Gemini')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analizuj przez Gemini' })).toBeInTheDocument()
  })

  it('does not overwrite a draft changed by the user during polling', () => {
    let currentReceipt = makeReceipt({ merchant: 'Wynik OCR 1' })
    mocks.useReceipts.mockImplementation(() => receiptApi([currentReceipt]))
    const view = render(page())

    fireEvent.change(screen.getByDisplayValue('Wynik OCR 1'), { target: { value: 'Moja korekta' } })
    currentReceipt = makeReceipt({ merchant: 'Wynik OCR 2', items: [{ ...makeReceipt().items[0], name: 'Nowy wynik OCR' }] })
    view.rerender(page())

    expect(screen.getByDisplayValue('Moja korekta')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Mleko')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Wynik OCR 2')).not.toBeInTheDocument()
  })

  it('keeps the product input mounted and focused while its name changes', () => {
    mocks.useReceipts.mockReturnValue(receiptApi([makeReceipt()]))
    render(page())

    const input = screen.getByDisplayValue('Mleko')
    input.focus()
    fireEvent.change(input, { target: { value: 'Mleko bez laktozy' } })

    expect(input).toHaveFocus()
    expect(screen.getByDisplayValue('Mleko bez laktozy')).toBe(input)
  })

  it('shows a failed receipt as an error without review actions', () => {
    mocks.useReceipts.mockReturnValue(receiptApi([makeReceipt({ status: 'failed', jobStatus: 'failed', processingError: 'Brak tekstu na zdjęciu', items: [] })]))
    render(page())

    expect(screen.getByText('Błąd OCR')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Brak tekstu na zdjęciu')
    expect(screen.getByRole('button', { name: /popraw ręcznie/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /zapisz korektę/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /zatwierdź jako wydatek/i })).not.toBeInTheDocument()
  })

  it('lets the user recover a failed receipt without approving it immediately', async () => {
    let currentReceipt = makeReceipt({ status: 'failed', jobStatus: 'failed', processingError: 'OCR przerwany' })
    mocks.useReceipts.mockImplementation(() => receiptApi([currentReceipt]))
    const view = render(page())

    fireEvent.click(screen.getByRole('button', { name: /popraw ręcznie/i }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Mleko')).toBeEnabled()
    expect(screen.getByRole('button', { name: /anuluj/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /zatwierdź jako wydatek/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /zapisz korektę/i }))

    await waitFor(() => expect(mocks.saveReview).toHaveBeenCalledOnce())
    expect(mocks.approve).not.toHaveBeenCalled()

    currentReceipt = makeReceipt({ status: 'needs_review', jobStatus: 'failed', processingError: 'OCR przerwany' })
    view.rerender(page())
    expect(screen.getByText('Do weryfikacji')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /zatwierdź jako wydatek/i })).toBeInTheDocument()
  })

  it('opens an empty failed receipt for manual item entry and can cancel it', () => {
    mocks.useReceipts.mockReturnValue(receiptApi([makeReceipt({ status: 'failed', jobStatus: 'failed', items: [] })]))
    render(page())

    fireEvent.click(screen.getByRole('button', { name: /popraw ręcznie/i }))
    fireEvent.change(screen.getByDisplayValue('Sklep testowy'), { target: { value: 'Niezapisany sklep' } })
    fireEvent.click(screen.getByRole('button', { name: /dodaj produkt/i }))
    expect(screen.getByRole('button', { name: /dodaj produkt/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /anuluj/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(mocks.saveReview).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /popraw ręcznie/i }))
    expect(screen.getByDisplayValue('Sklep testowy')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Niezapisany sklep')).not.toBeInTheDocument()
    expect(screen.getByText('Brak rozpoznanych produktów.')).toBeInTheDocument()
  })

  it('shows a total difference as a warning without blocking approval', () => {
    mocks.useReceipts.mockReturnValue(receiptApi([makeReceipt({ totalAmount: 20 })]))
    render(page())

    expect(screen.getByText('Sprawdź różnicę sum')).toBeInTheDocument()
    expect(screen.getByText('Różnica nie blokuje zatwierdzenia paragonu.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /zatwierdź jako wydatek/i })).toBeEnabled()
  })
})
