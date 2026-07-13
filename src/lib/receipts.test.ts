import { describe, expect, it } from 'vitest'
import { validateReceiptFile } from './receipts'

describe('receipt file validation', () => {
  it('accepts a JPEG image within the size limit', () => {
    expect(() => validateReceiptFile(new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }))).not.toThrow()
  })

  it('rejects unsupported formats', () => {
    expect(() => validateReceiptFile(new File(['document'], 'receipt.pdf', { type: 'application/pdf' }))).toThrow('JPEG, PNG i WebP')
  })

  it('rejects empty images', () => {
    expect(() => validateReceiptFile(new File([], 'empty.png', { type: 'image/png' }))).toThrow('od 1 bajta do 10 MB')
  })
})
