import { describe, expect, it } from 'vitest'
import { hasUncategorizedReceiptItems } from './receiptValidation'

describe('hasUncategorizedReceiptItems', () => {
  it('does not block a receipt whose every item has a category', () => {
    expect(hasUncategorizedReceiptItems([{ categoryId: 'food' }, { categoryId: 'transport' }])).toBe(false)
  })

  it('blocks a receipt when at least one item has no category', () => {
    expect(hasUncategorizedReceiptItems([{ categoryId: 'food' }, { categoryId: null }])).toBe(true)
  })
})
