import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())

vi.mock('./supabase', () => ({
  supabase: {
    functions: { invoke },
  },
}))

import { analyzeReceiptWithGemini } from './receipts'

describe('analyzeReceiptWithGemini', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes the authenticated Gemini Edge Function with a receipt id', async () => {
    invoke.mockResolvedValue({ data: { receiptId: 'receipt-1', status: 'needs_review' }, error: null })

    await expect(analyzeReceiptWithGemini('receipt-1')).resolves.toBe('receipt-1')
    expect(invoke).toHaveBeenCalledWith('analyze-receipt-gemini', { body: { receiptId: 'receipt-1' } })
  })

  it('rejects an unexpected Edge Function response', async () => {
    invoke.mockResolvedValue({ data: { status: 'needs_review' }, error: null })

    await expect(analyzeReceiptWithGemini('receipt-1')).rejects.toThrow('Gemini zwrócił niepoprawną odpowiedź.')
  })
})
